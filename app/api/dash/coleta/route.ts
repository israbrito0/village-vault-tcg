import { NextResponse } from "next/server";
import { CONTA_PADRAO, db, extensaoAutorizada } from "@/lib/dash/servidor";

// Recebe da extensão do Edge o que a página da live recebeu: a live (título,
// audiência, métricas, leilão, batalha), as emotions, o chat, as vendas e a
// foto do ranking mensal. Pode chegar repetido: tudo é gravado pelo id da
// própria Jamble, então mandar duas vezes não conta duas vezes.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

const LIMITES = { lives: 6, emocoes: 5000, chat: 3000, vendas: 2000 };
// "@israelbrito ao vivo" é o nome que a Jamble dá à live depois que ela acaba.
const TITULO_GENERICO = /^(seller hub|jamble|painel do vendedor|live|@?[\w.]+ ao vivo)$/i;

type Obj = Record<string, unknown>;
const txt = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const handle = (v: unknown) => txt(String(v ?? "").replace(/^@/, ""), 60);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
const url = (v: unknown) => {
  const u = txt(v, 600);
  return u && /^https:\/\//.test(u) ? u : null;
};
const quando = (v: unknown) => {
  const n = Number(v);
  // Milissegundos de 2020 a 2100; qualquer outra coisa vira "agora".
  return new Date(n > 1.5e12 && n < 4.2e12 ? n : Date.now()).toISOString();
};
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function emLotes<T>(linhas: T[], tamanho: number, fazer: (lote: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let i = 0; i < linhas.length; i += tamanho) {
    const { error } = await fazer(linhas.slice(i, i + tamanho));
    if (error) throw new Error(error.message);
  }
}

export async function POST(req: Request) {
  if (!extensaoAutorizada(req)) return NextResponse.json({ erro: "token inválido" }, { status: 401, headers: CORS });

  let corpo: Obj;
  try {
    corpo = (await req.json()) as Obj;
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400, headers: CORS });
  }

  const conta = CONTA_PADRAO;
  const lives = Array.isArray(corpo.lives) ? (corpo.lives as Obj[]).slice(0, LIMITES.lives) : [];
  const resposta: Obj = { ok: true, lives: [] as Obj[] };

  try {
    // O sinal de vida da extensão (o menu do Dash mostra se ela está ligada).
    await db().from("dash_config").update({ extensao_em: new Date().toISOString() }).eq("conta", conta);

    for (const l of lives) {
      const showId = txt(l.showId, 80);
      if (!showId || showId === "sem-live") continue;

      // Só grava o que veio: um envio só de chat não apaga o título nem a audiência.
      const linha: Obj = { show_id: showId, conta, visto_em: new Date().toISOString() };
      if (l.vendedor !== undefined) linha.vendedor = handle(l.vendedor);
      if (l.vendedorFoto !== undefined) linha.vendedor_foto = url(l.vendedorFoto);
      // O título da aba do painel do vendedor ("Seller Hub") não é o da live.
      if (l.titulo !== undefined && !TITULO_GENERICO.test(String(l.titulo ?? "").trim())) linha.titulo = txt(l.titulo, 200);
      if (l.capa !== undefined) linha.capa_url = url(l.capa);
      if (l.inicio !== undefined && num(l.inicio)) linha.inicio = quando(l.inicio);
      if (typeof l.aoVivo === "boolean") {
        linha.ao_vivo = l.aoVivo;
        if (!l.aoVivo) linha.fim = new Date().toISOString();
      }
      if (l.audiencia !== undefined) linha.audiencia = num(l.audiencia);
      if (l.pico !== undefined) linha.audiencia_pico = num(l.pico);
      if (l.likes !== undefined) linha.likes = num(l.likes);
      if (obj(l.metricas)) {
        // Junta com o que já está lá (o código do link, o que o robô leu).
        const { data: antes } = await db().from("dash_lives").select("metricas").eq("show_id", showId).maybeSingle();
        linha.metricas = { ...(obj(antes?.metricas) ?? {}), ...(l.metricas as Obj) };
      }
      if (Array.isArray(l.participacao)) linha.participacao = (l.participacao as Obj[]).slice(0, 3000);
      if (l.leilao !== undefined) linha.leilao = obj(l.leilao);
      if (l.batalha !== undefined) linha.batalha = obj(l.batalha);

      const { error: e1 } = await db().from("dash_lives").upsert(linha, { onConflict: "show_id" });
      if (e1) throw new Error(e1.message);

      const emocoes = (Array.isArray(l.emocoes) ? (l.emocoes as Obj[]) : [])
        .slice(-LIMITES.emocoes)
        .filter((e) => txt(e.id, 80) && handle(e.handle))
        .map((e) => ({
          id: `${showId}:${txt(e.id, 80)}`,
          show_id: showId,
          handle: handle(e.handle),
          nome: txt(e.nome, 80),
          foto: url(e.foto),
          icone: txt(e.icone, 60) ?? "",
          gemas: Math.max(0, Math.round(num(e.gemas) ?? 0)),
          time: e.time === "red" || e.time === "blue" ? e.time : null,
          ts: quando(e.ts),
        }));
      await emLotes(emocoes, 500, (lote) => db().from("dash_emocoes").upsert(lote, { onConflict: "id", ignoreDuplicates: true }));

      const chat = (Array.isArray(l.chat) ? (l.chat as Obj[]) : [])
        .slice(-LIMITES.chat)
        .filter((m) => txt(m.id, 80) && handle(m.handle))
        .map((m) => ({
          id: `${showId}:${txt(m.id, 80)}`,
          show_id: showId,
          handle: handle(m.handle),
          nome: txt(m.nome, 80),
          foto: url(m.foto),
          texto: txt(m.texto, 500) ?? "",
          ts: quando(m.ts),
        }));
      await emLotes(chat, 500, (lote) => db().from("dash_chat").upsert(lote, { onConflict: "id" }));

      // Mensagens apagadas pela moderação saem do chat do painel também.
      const apagadas = (Array.isArray(l.chatApagadas) ? (l.chatApagadas as unknown[]) : [])
        .map((id) => txt(id, 80))
        .filter(Boolean)
        .slice(0, 500)
        .map((id) => `${showId}:${id}`);
      if (apagadas.length) await db().from("dash_chat").delete().in("id", apagadas);

      // De quem é a live: vem no envio só quando muda, então o resto lê do banco.
      let vendedor = handle(l.vendedor);
      if (vendedor) {
        await db().from("dash_vendas").update({ vendedor }).eq("show_id", showId).is("vendedor", null);
      } else if (Array.isArray(l.vendas)) {
        const { data: atual } = await db().from("dash_lives").select("vendedor").eq("show_id", showId).maybeSingle();
        vendedor = (atual?.vendedor as string | null) ?? null;
      }

      let vendasGravadas = 0;
      // A cópia das lives do Dash TCG chega marcada; o resto é da extensão.
      const origem = l.origem === "dashtcg" ? "dashtcg" : "extensao";
      if (Array.isArray(l.vendas)) {
        const agora = new Date().toISOString();
        const vendas = (l.vendas as Obj[])
          .slice(0, LIMITES.vendas)
          .filter((v) => txt(v.id, 80))
          .map((v) => {
            const quantidade = Math.max(0, Math.round(num(v.quantidade) ?? 1));
            const preco = num(v.preco) ?? 0;
            return {
              id: `${showId}:${txt(v.id, 80)}`,
              show_id: showId,
              conta,
              vendedor,
              titulo: txt(v.titulo, 200),
              imagem: url(v.imagem),
              comprador: handle(v.comprador),
              foto: url(v.foto),
              preco,
              quantidade,
              total: num(v.total) ?? preco * quantidade,
              tipo: txt(v.tipo, 30),
              pago: typeof v.pago === "boolean" ? v.pago : null,
              cancelado: v.cancelado === true,
              ts: quando(v.ts),
              atualizado_em: agora,
              origem,
            };
          });
        await emLotes(vendas, 500, (lote) => db().from("dash_vendas").upsert(lote, { onConflict: "id" }));
        vendasGravadas = vendas.length;

        // Lista completa: o que não veio mais saiu da live (uma compra direta
        // vista ao vivo que depois apareceu na lista Vendidos com outro código).
        // Só mexe no que a própria extensão mandou, e nunca com a lista vazia:
        // a aba do painel do vendedor manda a live sem vendas, e isso já
        // apagou a cópia do Dash TCG da live de 09/10.
        if (l.vendasCompletas === true && origem === "extensao" && vendas.length > 0) {
          const ficam = new Set(vendas.map((v) => v.id));
          const { data: existentes } = await db().from("dash_vendas").select("id").eq("show_id", showId).eq("origem", "extensao").limit(5000);
          const sobram = (existentes ?? []).map((x) => x.id as string).filter((id) => !ficam.has(id));
          await emLotes(sobram, 100, (lote) => db().from("dash_vendas").delete().in("id", lote));
        }
      }

      (resposta.lives as Obj[]).push({ showId, emocoes: emocoes.length, chat: chat.length, vendas: vendasGravadas });
    }

    // As figurinhas das emotions: o painel mostra a imagem em vez do código.
    const icones = obj(corpo.icones);
    if (icones) {
      const nomes = obj(corpo.nomesEmocoes) ?? {};
      const precos = obj(corpo.tabelaEmocoes) ?? {};
      const linhas = Object.entries(icones)
        .slice(0, 200)
        .map(([id, u]) => ({
          id: txt(id, 60),
          url: url(u),
          nome: txt(nomes[id], 60),
          gemas: num(precos[id]) != null ? Math.round(num(precos[id])!) : null,
          atualizado_em: new Date().toISOString(),
        }))
        .filter((l) => l.id && /^[a-z0-9_]+$/.test(l.id));
      if (linhas.length) await emLotes(linhas, 200, (lote) => db().from("dash_icones").upsert(lote, { onConflict: "id" }));
    }

    // Ranking mensal de vendedores: guarda a foto quando é nova.
    const r = obj(corpo.ranking);
    const lista = Array.isArray(r?.lista)
      ? (r!.lista as Obj[])
          .map((p) => ({ handle: handle(p.handle) ?? "", posicao: Math.round(num(p.posicao) ?? 0), pontos: Math.round(num(p.pontos) ?? 0) }))
          .filter((p) => p.handle && p.posicao > 0)
          .sort((a, b) => a.posicao - b.posicao)
          .slice(0, 200)
      : [];
    if (r && lista.length) {
      const ts = quando(r.ts);
      const { data: ultimo } = await db().from("dash_ranking").select("ts").eq("conta", conta).order("ts", { ascending: false }).limit(1);
      if (!ultimo?.[0] || new Date(ultimo[0].ts as string).getTime() < new Date(ts).getTime()) {
        const eu = lista.find((p) => p.handle.toLowerCase() === conta);
        const acima = eu ? lista.filter((p) => p.posicao < eu.posicao).pop() ?? null : null;
        const abaixo = eu ? lista.find((p) => p.posicao > eu.posicao) ?? null : null;
        const { error } = await db().from("dash_ranking").insert({
          conta,
          ts,
          mes: txt(r.mes, 80) ?? new Date(ts).toISOString().slice(0, 7),
          pontos: eu?.pontos ?? null,
          posicao: eu?.posicao ?? null,
          acima,
          abaixo,
          lista,
          regras: obj(r.regras),
        });
        if (error && !/duplicate/.test(error.message)) throw new Error(error.message);
        resposta.ranking = { posicao: eu?.posicao ?? null, pontos: eu?.pontos ?? null };
      }
    }
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message || e) }, { status: 500, headers: CORS });
  }

  return NextResponse.json(resposta, { headers: CORS });
}
