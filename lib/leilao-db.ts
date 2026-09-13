import { createClient } from "@supabase/supabase-js";
import type { Lance, Lote } from "./leilao";
import { criarLinkPagamento, temInfinitePay } from "./infinitepay";
import { SITE_URL } from "./site";

// Acesso ao banco do leilão pelo servidor, com a chave service_role: é aqui que
// se escreve. O navegador nunca usa esta chave — ele só lê pelo Realtime.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const TEM_BANCO = Boolean(URL && SERVICE);

function cliente() {
  if (!URL || !SERVICE) throw new Error("Supabase não configurado");
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

const msDe = (iso: string | null) => (iso ? new Date(iso).getTime() : undefined);

function paraLote(linha: Record<string, unknown>): Lote {
  return {
    id: String(linha.id),
    ordem: Number(linha.ordem),
    titulo: String(linha.titulo),
    descricao: (linha.descricao as string) ?? undefined,
    imagem: (linha.imagem as string) ?? undefined,
    lanceInicialCentavos: Number(linha.lance_inicial_centavos),
    incrementoCentavos: Number(linha.incremento_centavos),
    estado: linha.estado as Lote["estado"],
    abertoEm: msDe(linha.aberto_em as string | null),
    fechaEm: msDe(linha.fecha_em as string | null),
    vencedorId: (linha.vencedor_id as string) ?? undefined,
    vencedorNome: (linha.vencedor_nome as string) ?? undefined,
    vencedorCentavos: (linha.vencedor_centavos as number) ?? undefined,
    cartaId: (linha.carta_id as string) ?? undefined,
    precoRefCentavos: (linha.preco_ref_centavos as number) ?? undefined,
  };
}

function paraLance(linha: Record<string, unknown>): Lance {
  return {
    id: String(linha.id),
    loteId: String(linha.lote_id),
    participanteId: String(linha.participante_id),
    nome: String(linha.nome),
    centavos: Number(linha.centavos),
    em: new Date(String(linha.em)).getTime(),
  };
}

export type EstadoLeilao = {
  leilao: { id: string; titulo: string; descricao: string | null; estado: string } | null;
  lotes: Lote[];
  lances: Lance[];
  mensagens: { id: string; nome: string; texto: string; em: number; tipo: string }[];
  // Situação do pagamento de cada lote arrematado (sem link nem dado pessoal).
  pagamentos: { loteId: string; estado: string; pagarAte: number | null }[];
};

const reaisTexto = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Recado do próprio leilão no chat: aguardando pagamento, pagou, não pagou.
async function mensagemSistema(leilaoId: string, texto: string) {
  const db = cliente();
  await db.from("mensagens").insert({ leilao_id: leilaoId, nome: "Leilão", texto, tipo: "sistema" });
}

// Lote arrematado vira cobrança na hora, com prazo, e o chat avisa a sala.
async function abrirCobrancaDoLote(loteId: string) {
  const db = cliente();
  const { data: lote } = await db
    .from("lotes")
    .select("id, leilao_id, titulo, vencedor_id, vencedor_nome, vencedor_centavos")
    .eq("id", loteId)
    .single();
  if (!lote?.vencedor_id || !lote.vencedor_centavos) return;

  const { data: jaExiste } = await db.from("cobrancas").select("id").eq("lote_id", loteId).maybeSingle();
  if (jaExiste) return;

  const { data: leilao } = await db.from("leiloes").select("prazo_pagamento_min").eq("id", lote.leilao_id).single();
  const minutos = Number(leilao?.prazo_pagamento_min ?? 5);
  const pagarAte = new Date(Date.now() + minutos * 60000);

  const { data: cobranca, error } = await db
    .from("cobrancas")
    .insert({
      leilao_id: lote.leilao_id,
      participante_id: lote.vencedor_id,
      lote_id: lote.id,
      centavos: lote.vencedor_centavos,
      estado: "aberta",
      provedor: "infinitepay",
      pagar_ate: pagarAte.toISOString(),
    })
    .select("id")
    .single();
  // Outra leitura já criou a cobrança deste lote: não duplica o aviso.
  if (error || !cobranca) return;

  if (temInfinitePay()) {
    try {
      const link = await criarLinkPagamento({
        nsu: cobranca.id,
        itens: [{ nome: String(lote.titulo), centavos: lote.vencedor_centavos }],
        redirecionar: `${SITE_URL}/leiloes`,
        webhook: `${SITE_URL}/api/pagamento/infinitepay`,
      });
      await db.from("cobrancas").update({ link }).eq("id", cobranca.id);
    } catch {
      // Sem link agora; o comprador ainda vê o aviso e o leiloeiro cobra à mão.
    }
  }

  await mensagemSistema(
    lote.leilao_id,
    `⏳ Aguardando ${lote.vencedor_nome} pagar ${lote.titulo} (${reaisTexto(lote.vencedor_centavos)}) · prazo ${minutos} min`,
  );
}

// Quem não pagou no prazo: cobrança expira e o lote volta 20% mais barato.
async function processarPrazos(leilaoId: string) {
  const db = cliente();
  const { data: vencidas } = await db
    .from("cobrancas")
    .select("id, lote_id, centavos")
    .eq("leilao_id", leilaoId)
    .eq("estado", "aberta")
    .lt("pagar_ate", new Date().toISOString());

  let mudou = false;
  for (const cob of vencidas ?? []) {
    // Só segue quem conseguiu virar a cobrança: evita reprise em dobro.
    const { data: virou } = await db
      .from("cobrancas")
      .update({ estado: "expirada" })
      .eq("id", cob.id)
      .eq("estado", "aberta")
      .select("id");
    if (!virou?.length || !cob.lote_id) continue;
    mudou = true;

    const { data: original } = await db.from("lotes").select("*").eq("id", cob.lote_id).single();
    if (!original) continue;

    const { data: ultimo } = await db
      .from("lotes")
      .select("ordem")
      .eq("leilao_id", leilaoId)
      .order("ordem", { ascending: false })
      .limit(1)
      .single();

    const novoInicial = Math.max(100, Math.round(cob.centavos * 0.8));
    await db.from("lotes").insert({
      leilao_id: leilaoId,
      ordem: Number(ultimo?.ordem ?? 0) + 1,
      titulo: original.titulo,
      descricao: original.descricao,
      imagem: original.imagem,
      lance_inicial_centavos: novoInicial,
      incremento_centavos: original.incremento_centavos,
      carta_id: original.carta_id,
      preco_ref_centavos: original.preco_ref_centavos,
      reprise_de: original.id,
    });

    await mensagemSistema(
      leilaoId,
      `❌ ${original.vencedor_nome} não pagou. ${original.titulo} volta ao leilão por ${reaisTexto(novoInicial)} (20% abaixo)`,
    );
  }
  return mudou;
}

// Fecha, apurando o vencedor, todo lote cujo relógio já acabou. Roda a cada
// leitura: assim o lote não fica "aberto" no banco depois do tempo, mesmo que
// ninguém aperte nada no painel.
async function fecharVencidos(lotes: { id: string; estado: string; fecha_em: string | null }[]) {
  const agora = Date.now();
  const vencidos = lotes.filter(
    (l) => l.estado === "aberto" && l.fecha_em && new Date(l.fecha_em).getTime() <= agora,
  );
  for (const lote of vencidos) {
    try {
      await fecharLote(lote.id);
    } catch {
      // Se falhar, a próxima leitura tenta de novo.
    }
  }
  return vencidos.length > 0;
}

export async function lerLeilaoAtual(): Promise<EstadoLeilao> {
  const db = cliente();
  const { data: leiloes } = await db
    .from("leiloes")
    .select("id, titulo, descricao, estado")
    .in("estado", ["ao_vivo", "rascunho"])
    .order("criado_em", { ascending: false })
    .limit(1);

  const leilao = leiloes?.[0] ?? null;
  if (!leilao) return { leilao: null, lotes: [], lances: [], mensagens: [], pagamentos: [] };

  // Antes de ler: fecha lote vencido (que abre a cobrança) e resolve quem
  // passou do prazo de pagamento (que devolve o lote à fila). Assim a tela
  // já recebe o chat e os lotes com tudo isso aplicado.
  const { data: situacao } = await db.from("lotes").select("id, estado, fecha_em").eq("leilao_id", leilao.id);
  await fecharVencidos((situacao ?? []) as { id: string; estado: string; fecha_em: string | null }[]);
  await processarPrazos(leilao.id).catch(() => false);

  const [{ data: lotes }, { data: mensagens }, { data: cobrancas }] = await Promise.all([
    db.from("lotes").select("*").eq("leilao_id", leilao.id).order("ordem"),
    db
      .from("mensagens")
      .select("id, nome, texto, em, tipo")
      .eq("leilao_id", leilao.id)
      .eq("oculta", false)
      .order("em", { ascending: false })
      .limit(60),
    db.from("cobrancas").select("lote_id, estado, pagar_ate").eq("leilao_id", leilao.id).not("lote_id", "is", null),
  ]);

  const ids = (lotes ?? []).map((l) => l.id);
  let lances: Record<string, unknown>[] = [];
  if (ids.length) {
    const { data } = await db.from("lances").select("*").in("lote_id", ids).eq("cancelado", false).order("em");
    lances = (data ?? []) as Record<string, unknown>[];
  }

  return {
    leilao,
    lotes: (lotes ?? []).map(paraLote),
    lances: (lances ?? []).map(paraLance),
    mensagens: (mensagens ?? [])
      .map((m) => ({ id: m.id, nome: m.nome, texto: m.texto, em: new Date(m.em).getTime(), tipo: m.tipo ?? "chat" }))
      .reverse(),
    pagamentos: (cobrancas ?? []).map((c) => ({
      loteId: String(c.lote_id),
      estado: String(c.estado),
      pagarAte: c.pagar_ate ? new Date(c.pagar_ate).getTime() : null,
    })),
  };
}

// O botão "Pagar agora" do comprador. Só devolve o link para quem arrematou.
export async function pagamentoDoComprador(loteId: string, participanteId: string) {
  const db = cliente();
  const { data } = await db
    .from("cobrancas")
    .select("estado, link, pagar_ate, centavos, participante_id")
    .eq("lote_id", loteId)
    .maybeSingle();
  if (!data || data.participante_id !== participanteId) return null;
  return {
    estado: String(data.estado),
    link: data.estado === "aberta" ? (data.link as string | null) : null,
    pagarAte: data.pagar_ate ? new Date(data.pagar_ate).getTime() : null,
    centavos: Number(data.centavos),
  };
}

// Uma pessoa por número de WhatsApp. Voltar com outro nome só troca o nome.
export async function entrar(nome: string, whatsapp: string) {
  const db = cliente();
  const numero = whatsapp.replace(/\D/g, "");
  const { data, error } = await db
    .from("participantes")
    .upsert({ nome: nome.trim().slice(0, 40), whatsapp: numero }, { onConflict: "whatsapp" })
    .select("id, nome, bloqueado")
    .single();
  if (error) throw error;
  return data as { id: string; nome: string; bloqueado: boolean };
}

export async function darLance(
  loteId: string,
  participanteId: string,
  nome: string,
  centavos: number,
  confirmado = false,
) {
  const db = cliente();
  const { data, error } = await db.rpc("dar_lance", {
    p_lote: loteId,
    p_participante: participanteId,
    p_nome: nome,
    p_centavos: centavos,
    p_confirmado: confirmado,
  });
  if (error) throw error;
  return data as { ok: boolean; erro?: string; minimo?: number; fecha_em?: string; proximo_minimo?: number };
}

// Lance automático: guarda até quanto a pessoa quer ir. O banco disputa por
// ela, subindo só o necessário. O valor é secreto — ninguém mais lê.
export async function definirLimite(loteId: string, participanteId: string, nome: string, maximo: number) {
  const db = cliente();
  const { data, error } = await db.rpc("definir_limite", {
    p_lote: loteId,
    p_participante: participanteId,
    p_nome: nome,
    p_maximo: maximo,
  });
  if (error) throw error;
  return data as { ok: boolean; erro?: string; minimo?: number; ganhando?: boolean; centavos?: number };
}

export async function mandarMensagem(leilaoId: string, participanteId: string, nome: string, texto: string) {
  const db = cliente();
  const { error } = await db.from("mensagens").insert({
    leilao_id: leilaoId,
    participante_id: participanteId,
    nome,
    texto: texto.trim().slice(0, 400),
  });
  if (error) throw error;
}

// ------------------------------------------------------------------- painel

export async function abrirLote(loteId: string, duracaoMs: number) {
  const db = cliente();
  const agora = new Date();
  const { error } = await db
    .from("lotes")
    .update({
      estado: "aberto",
      aberto_em: agora.toISOString(),
      fecha_em: new Date(agora.getTime() + duracaoMs).toISOString(),
    })
    .eq("id", loteId);
  if (error) throw error;
}

export async function fecharLote(loteId: string) {
  const db = cliente();
  const { data: lances } = await db
    .from("lances")
    .select("*")
    .eq("lote_id", loteId)
    .eq("cancelado", false)
    .order("centavos", { ascending: false })
    .order("em", { ascending: true })
    .limit(1);

  const vencedor = lances?.[0];
  const { error } = await db
    .from("lotes")
    .update({
      estado: "encerrado",
      fecha_em: new Date().toISOString(),
      vencedor_id: vencedor?.participante_id ?? null,
      vencedor_nome: vencedor?.nome ?? null,
      vencedor_centavos: vencedor?.centavos ?? null,
    })
    .eq("id", loteId);
  if (error) throw error;
  if (vencedor) await abrirCobrancaDoLote(loteId).catch(() => {});
  return vencedor ?? null;
}

export async function cancelarLance(lanceId: string) {
  const db = cliente();
  const { error } = await db.from("lances").update({ cancelado: true }).eq("id", lanceId);
  if (error) throw error;
}

export async function bloquearParticipante(participanteId: string, bloqueado: boolean) {
  const db = cliente();
  const { error } = await db.from("participantes").update({ bloqueado }).eq("id", participanteId);
  if (error) throw error;
}

export async function ocultarMensagem(mensagemId: string) {
  const db = cliente();
  const { error } = await db.from("mensagens").update({ oculta: true }).eq("id", mensagemId);
  if (error) throw error;
}

export async function criarLeilao(titulo: string, descricao?: string) {
  const db = cliente();
  const { data, error } = await db
    .from("leiloes")
    .insert({ titulo, descricao, estado: "ao_vivo" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function criarLote(
  leilaoId: string,
  lote: {
    ordem: number;
    titulo: string;
    descricao?: string;
    imagem?: string;
    lanceInicialCentavos: number;
    incrementoCentavos: number;
    cartaId?: string;
    precoRefCentavos?: number;
  },
) {
  const db = cliente();
  const { error } = await db.from("lotes").insert({
    leilao_id: leilaoId,
    ordem: lote.ordem,
    titulo: lote.titulo,
    descricao: lote.descricao,
    imagem: lote.imagem,
    lance_inicial_centavos: lote.lanceInicialCentavos,
    incremento_centavos: lote.incrementoCentavos,
    carta_id: lote.cartaId,
    preco_ref_centavos: lote.precoRefCentavos,
  });
  if (error) throw error;
}

// Base própria de cartas: guarda o que já foi consultado e o preço que ele
// mesmo definiu, que vale mais que o preço internacional convertido.
export async function salvarCarta(carta: {
  id: string;
  nome: string;
  colecao?: string;
  colecaoId?: string;
  numero?: string;
  totalOficial?: number;
  raridade?: string;
  imagem?: string;
  precoRefCentavos?: number;
  fonte?: string;
}) {
  const db = cliente();
  const { error } = await db.from("cartas").upsert(
    {
      id: carta.id,
      nome: carta.nome,
      colecao: carta.colecao,
      colecao_id: carta.colecaoId,
      numero: carta.numero,
      total_oficial: carta.totalOficial,
      raridade: carta.raridade,
      imagem: carta.imagem,
      preco_ref_centavos: carta.precoRefCentavos,
      fonte: carta.fonte,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function definirPrecoManual(cartaId: string, centavos: number | null, fonte?: string) {
  const db = cliente();
  // A origem guarda de onde veio o preço e em que condição (ex.: "liga NM").
  const campos: Record<string, unknown> = { preco_manual_centavos: centavos, atualizado_em: new Date().toISOString() };
  if (fonte) campos.fonte = fonte;
  const { error } = await db.from("cartas").update(campos).eq("id", cartaId);
  if (error) throw error;
}

// Preço por condição: NM, SP, MP, HP, D. O NM é o que vira o preço da casa,
// porque é a referência que ele usa para abrir os lotes.
export const CONDICOES = ["NM", "SP", "MP", "HP", "D", "M"] as const;
export type Condicao = (typeof CONDICOES)[number];

export async function salvarPrecoCondicao(cartaId: string, condicao: Condicao, centavos: number, fonte?: string) {
  const db = cliente();
  const { error } = await db.from("precos_condicao").upsert(
    { carta_id: cartaId, condicao, centavos, fonte, atualizado_em: new Date().toISOString() },
    { onConflict: "carta_id,condicao" },
  );
  if (error) throw error;
}

export async function lerPrecosCondicao(ids: string[]) {
  if (!ids.length) return {} as Record<string, Record<string, number>>;
  const db = cliente();
  const { data } = await db.from("precos_condicao").select("carta_id, condicao, centavos").in("carta_id", ids);
  const mapa: Record<string, Record<string, number>> = {};
  for (const linha of data ?? []) {
    const id = String(linha.carta_id);
    mapa[id] = mapa[id] ?? {};
    mapa[id][String(linha.condicao)] = Number(linha.centavos);
  }
  return mapa;
}

export async function lerCartas(ids: string[]) {
  if (!ids.length) return [];
  const db = cliente();
  const { data } = await db.from("cartas").select("*").in("id", ids);
  return data ?? [];
}

// ------------------------------------------------------------- cobranças

// Painel: cada lote arrematado com a situação do pagamento, o link e o
// WhatsApp de quem arrematou, para cobrar à mão quem estiver enrolando.
export async function lerPagamentosDoLeilao(leilaoId: string) {
  const db = cliente();
  const { data: cobrancas } = await db
    .from("cobrancas")
    .select("id, lote_id, participante_id, centavos, estado, link, pagar_ate, paga_em")
    .eq("leilao_id", leilaoId)
    .not("lote_id", "is", null)
    .order("pagar_ate", { ascending: true });

  const loteIds = [...new Set((cobrancas ?? []).map((c) => c.lote_id as string))];
  const pessoaIds = [...new Set((cobrancas ?? []).map((c) => c.participante_id as string))];

  const [{ data: lotes }, { data: pessoas }] = await Promise.all([
    loteIds.length ? db.from("lotes").select("id, titulo").in("id", loteIds) : Promise.resolve({ data: [] }),
    pessoaIds.length ? db.from("participantes").select("id, nome, whatsapp").in("id", pessoaIds) : Promise.resolve({ data: [] }),
  ]);

  return (cobrancas ?? []).map((c) => {
    const lote = (lotes as { id: string; titulo: string }[] | null)?.find((l) => l.id === c.lote_id);
    const pessoa = (pessoas as { id: string; nome: string; whatsapp: string }[] | null)?.find(
      (p) => p.id === c.participante_id,
    );
    return {
      id: String(c.id),
      titulo: lote?.titulo ?? "",
      nome: pessoa?.nome ?? "",
      whatsapp: pessoa?.whatsapp ?? "",
      centavos: Number(c.centavos),
      estado: String(c.estado),
      link: (c.link as string | null) ?? null,
      pagarAte: c.pagar_ate ? new Date(c.pagar_ate).getTime() : null,
    };
  });
}

export async function marcarCobrancaPaga(cobrancaId: string) {
  const db = cliente();
  const { data, error } = await db
    .from("cobrancas")
    .update({ estado: "paga", paga_em: new Date().toISOString() })
    .eq("id", cobrancaId)
    .neq("estado", "paga")
    .select("id, leilao_id, lote_id");
  if (error) throw error;
  const cobranca = data?.[0];
  if (!cobranca) return false;

  // Avisa a sala que o arremate foi pago.
  if (cobranca.lote_id) {
    const { data: lote } = await db.from("lotes").select("titulo, vencedor_nome").eq("id", cobranca.lote_id).single();
    if (lote) await mensagemSistema(cobranca.leilao_id, `✅ ${lote.vencedor_nome} pagou ${lote.titulo}`).catch(() => {});
  }
  return true;
}

// Guarda o aviso cru da operadora, para conferência quando algo não bater.
export async function registrarAvisoPagamento(nsu: string, pago: boolean, corpo: unknown) {
  const db = cliente();
  await db.from("avisos_pagamento").insert({ nsu, pago, corpo });
}

export async function lerCobrancas(leilaoId: string) {
  const db = cliente();
  const { data } = await db
    .from("cobrancas")
    .select("id, participante_id, centavos, estado, link, paga_em")
    .eq("leilao_id", leilaoId);
  return data ?? [];
}

// Caixa de cada pessoa no leilão, para virar cobrança no fim.
export async function caixasDoLeilao(leilaoId: string) {
  const db = cliente();
  const { data } = await db
    .from("lotes")
    .select("id, titulo, vencedor_id, vencedor_nome, vencedor_centavos")
    .eq("leilao_id", leilaoId)
    .eq("estado", "encerrado")
    .not("vencedor_id", "is", null);

  const porPessoa = new Map<string, { nome: string; centavos: number; lotes: { titulo: string; centavos: number }[] }>();
  for (const lote of data ?? []) {
    const atual = porPessoa.get(lote.vencedor_id!) ?? {
      nome: (lote.vencedor_nome as string) ?? "",
      centavos: 0,
      lotes: [] as { titulo: string; centavos: number }[],
    };
    atual.centavos += lote.vencedor_centavos ?? 0;
    atual.lotes.push({ titulo: String(lote.titulo), centavos: lote.vencedor_centavos ?? 0 });
    porPessoa.set(lote.vencedor_id!, atual);
  }

  const ids = [...porPessoa.keys()];
  let pessoas: { id: string; whatsapp: string }[] = [];
  if (ids.length) {
    const { data: encontradas } = await db.from("participantes").select("id, whatsapp").in("id", ids);
    pessoas = (encontradas ?? []) as { id: string; whatsapp: string }[];
  }

  return [...porPessoa.entries()].map(([id, dados]) => ({
    participanteId: id,
    whatsapp: pessoas.find((p) => p.id === id)?.whatsapp ?? "",
    ...dados,
  }));
}
