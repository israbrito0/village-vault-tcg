import { createClient } from "@supabase/supabase-js";
import type { Lance, Lote } from "./leilao";

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
  mensagens: { id: string; nome: string; texto: string; em: number }[];
};

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
  if (!leilao) return { leilao: null, lotes: [], lances: [], mensagens: [] };

  let [{ data: lotes }, { data: mensagens }] = await Promise.all([
    db.from("lotes").select("*").eq("leilao_id", leilao.id).order("ordem"),
    db
      .from("mensagens")
      .select("id, nome, texto, em")
      .eq("leilao_id", leilao.id)
      .eq("oculta", false)
      .order("em", { ascending: false })
      .limit(60),
  ]);

  // Se algum lote passou da hora, fecha e lê de novo para devolver o vencedor.
  if (await fecharVencidos((lotes ?? []) as { id: string; estado: string; fecha_em: string | null }[])) {
    const { data: atualizados } = await db.from("lotes").select("*").eq("leilao_id", leilao.id).order("ordem");
    lotes = atualizados;
  }

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
      .map((m) => ({ id: m.id, nome: m.nome, texto: m.texto, em: new Date(m.em).getTime() }))
      .reverse(),
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

export async function darLance(loteId: string, participanteId: string, nome: string, centavos: number) {
  const db = cliente();
  const { data, error } = await db.rpc("dar_lance", {
    p_lote: loteId,
    p_participante: participanteId,
    p_nome: nome,
    p_centavos: centavos,
  });
  if (error) throw error;
  return data as { ok: boolean; erro?: string; minimo?: number; fecha_em?: string; proximo_minimo?: number };
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

export async function lerCartas(ids: string[]) {
  if (!ids.length) return [];
  const db = cliente();
  const { data } = await db.from("cartas").select("*").in("id", ids);
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

  const porPessoa = new Map<string, { nome: string; centavos: number; lotes: string[] }>();
  for (const lote of data ?? []) {
    const atual = porPessoa.get(lote.vencedor_id!) ?? {
      nome: (lote.vencedor_nome as string) ?? "",
      centavos: 0,
      lotes: [] as string[],
    };
    atual.centavos += lote.vencedor_centavos ?? 0;
    atual.lotes.push(String(lote.titulo));
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
