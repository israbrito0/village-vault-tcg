import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { lerTermos, type Contagem } from "@/lib/dash/calculos";

// O lado do servidor do Dash Village. Só a API fala com o banco, com a chave
// de serviço; quem pode ver o quê é decidido aqui:
//   - a extensão do Edge manda dados com o mesmo token do ranking;
//   - quem abre o painel entra com a conta do site (Supabase Auth) e precisa
//     estar em dash_membros;
//   - a tela do OBS abre sem login, com a chave da conta no link.

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;

// A conta (o @ de vendedor na Jamble) de quem é a extensão.
export const CONTA_PADRAO = "israelbrito";

let unico: SupabaseClient | null = null;
export function db() {
  if (!SUPA_URL || !SERVICE) throw new Error("Supabase não configurado");
  if (!unico) unico = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
  return unico;
}

export const SEM_CACHE = { "cache-control": "no-store" };

export function erro(status: number, mensagem: string) {
  return NextResponse.json({ erro: mensagem }, { status, headers: SEM_CACHE });
}

export function ok<T>(dados: T, extra?: HeadersInit) {
  return NextResponse.json(dados, { headers: { ...SEM_CACHE, ...(extra ?? {}) } });
}

const tokenDe = (req: Request) => (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

// A extensão: mesmo token que ela já usa para o ranking.
export function extensaoAutorizada(req: Request) {
  const esperado = process.env.RANKING_TOKEN;
  const enviado = tokenDe(req);
  return !!esperado && enviado.length > 0 && enviado === esperado;
}

export type Membro = { email: string; conta: string; papel: string; recursos: string[] };

// Quem está logado no site e de qual conta ele vê as lives.
export async function membroDaRequisicao(req: Request): Promise<Membro | null> {
  const token = tokenDe(req);
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return null;
  const { data: m } = await db().from("dash_membros").select("email, conta, papel, recursos").eq("email", email).maybeSingle();
  return (m as Membro | null) ?? null;
}

export type Config = { conta: string; tela_chave: string; termos_carpa: string; preferencias: Record<string, unknown> };

export async function configDaConta(conta: string): Promise<Config> {
  const { data } = await db().from("dash_config").select("conta, tela_chave, termos_carpa, preferencias").eq("conta", conta).maybeSingle();
  if (data) return data as Config;
  const { data: nova } = await db().from("dash_config").insert({ conta }).select("conta, tela_chave, termos_carpa, preferencias").single();
  return nova as Config;
}

// A tela do OBS: a chave do link diz de qual conta ela é.
export async function contaDaChave(chave: string | null) {
  if (!chave || chave.length < 16) return null;
  const { data } = await db().from("dash_config").select("conta, tela_chave, termos_carpa, preferencias").eq("tela_chave", chave).maybeSingle();
  return (data as Config | null) ?? null;
}

// Os termos da carpa dourada separados do jeito que as funções do banco pedem:
// ids de emotion de um lado, textos do chat do outro.
export function termosParaBanco(termos: string) {
  const lista = lerTermos(termos);
  return {
    lista,
    icones: lista.filter((t) => /^[a-z0-9_]+$/.test(t)),
    textos: lista.filter((t) => !/^[a-z0-9_]+$/.test(t)).map((t) => t.replace(/[%_\\]/g, (c) => "\\" + c)),
  };
}

// A live pode ser vista pelo membro se é da conta dele (a extensão dele que
// mandou). Lives de outros vendedores que ela assistiu também contam.
export async function liveDoMembro(showId: string, conta: string) {
  const { data } = await db().from("dash_lives").select("*").eq("show_id", showId).eq("conta", conta).maybeSingle();
  return data as LiveLinha | null;
}

// A live "atual" da conta: a que está no ar agora, senão a última vista.
export async function liveAtual(conta: string, soDaConta = true) {
  let q = db().from("dash_lives").select("*").eq("conta", conta);
  if (soDaConta) q = q.eq("vendedor", conta);
  const { data } = await q.order("ao_vivo", { ascending: false }).order("visto_em", { ascending: false }).limit(1);
  return ((data ?? [])[0] as LiveLinha | undefined) ?? null;
}

export type LiveLinha = {
  show_id: string;
  conta: string;
  vendedor: string | null;
  titulo: string | null;
  capa_url: string | null;
  inicio: string | null;
  fim: string | null;
  ao_vivo: boolean;
  audiencia: number | null;
  audiencia_pico: number | null;
  likes: number | null;
  metricas: Record<string, unknown>;
  participacao: unknown[];
  leilao: Record<string, unknown> | null;
  batalha: Record<string, unknown> | null;
  visto_em: string;
  criado_em: string;
};

// O PostgREST devolve no máximo 1000 linhas por pedido: busca de mil em mil.
export async function todas<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  limite = 50000,
): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; de < limite; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    saida.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return saida;
}

// Quantos bilhetes cada pessoa tem numa live, pela fonte do sorteio.
export async function contagemDaFonte(showId: string, fonte: string, termos: string): Promise<Contagem[]> {
  const t = termosParaBanco(termos);
  const linhas = await todas<{ handle: string; nome: string | null; foto: string | null; n: number; mensagens: number; compras: number }>(
    (de, ate) =>
      db()
        .rpc("dash_bilhetes", { p_show: showId, p_fonte: fonte, p_icones: t.icones, p_textos: t.textos })
        .range(de, ate) as unknown as PromiseLike<{ data: never[] | null; error: { message: string } | null }>,
  );
  return linhas.map((l) => ({
    handle: l.handle,
    nome: l.nome || l.handle,
    foto: l.foto,
    n: Number(l.n) || 0,
    mensagens: Number(l.mensagens) || 0,
    compras: Number(l.compras) || 0,
  }));
}

export type TotaisBanco = {
  emocoes: number;
  gemas: number;
  carpas: number;
  mensagens: number;
  vendas: number;
  itens: number;
  total: number;
  pago: number;
  compradores: number;
};

export async function totaisDaLive(showId: string, termos: string): Promise<TotaisBanco> {
  const t = termosParaBanco(termos);
  const { data, error } = await db().rpc("dash_totais", { p_show: showId, p_icones: t.icones, p_textos: t.textos });
  if (error) throw new Error(error.message);
  const l = (Array.isArray(data) ? data[0] : data) ?? {};
  const num = (k: string) => Number((l as Record<string, unknown>)[k]) || 0;
  return {
    emocoes: num("emocoes"),
    gemas: num("gemas"),
    carpas: num("carpas"),
    mensagens: num("mensagens"),
    vendas: num("vendas"),
    itens: num("itens"),
    total: num("total"),
    pago: num("pago"),
    compradores: num("compradores"),
  };
}

// A última foto do ranking mensal que a extensão viu.
export async function ultimoRanking(conta: string) {
  const { data } = await db().from("dash_ranking").select("*").eq("conta", conta).order("ts", { ascending: false }).limit(1);
  return ((data ?? [])[0] as RankingLinha | undefined) ?? null;
}

export type RankingLinha = {
  conta: string;
  ts: string;
  mes: string;
  pontos: number | null;
  posicao: number | null;
  acima: { handle: string; posicao: number; pontos: number } | null;
  abaixo: { handle: string; posicao: number; pontos: number } | null;
  lista: { handle: string; posicao: number; pontos: number }[] | null;
  regras: { porReal?: number | null; porGema?: number | null } | null;
};

// Quem pode abrir uma live: o membro logado (pode mexer) ou a tela do OBS,
// com a chave da conta no link (só olha).
export async function acessoALive(req: Request, showId: string) {
  const membro = await membroDaRequisicao(req);
  if (membro) {
    const live = await liveDoMembro(showId, membro.conta);
    return live ? { live, conta: membro.conta, membro } : null;
  }
  const chave = new URL(req.url).searchParams.get("k");
  const config = await contaDaChave(chave);
  if (!config) return null;
  const live = await liveDoMembro(showId, config.conta);
  return live ? { live, conta: config.conta, membro: null } : null;
}

// A live inteira (emotions, chat e vendas), para sortear com a mesma conta
// que o painel faz.
export async function dadosDaLive(showId: string) {
  const [emocoes, chat, vendas] = await Promise.all([
    todas<Record<string, unknown>>((de, ate) =>
      db().from("dash_emocoes").select("id, handle, nome, foto, icone, gemas, time, ts").eq("show_id", showId).order("ts").order("id").range(de, ate) as never,
    ),
    todas<Record<string, unknown>>((de, ate) =>
      db().from("dash_chat").select("id, handle, nome, foto, texto, ts").eq("show_id", showId).order("ts").order("id").range(de, ate) as never,
    ),
    todas<Record<string, unknown>>((de, ate) => db().from("dash_vendas").select("*").eq("show_id", showId).order("ts").range(de, ate) as never),
  ]);
  return { emocoes, chat, vendas };
}

// Período pedido na URL (?de=&ate= em milissegundos).
export function periodo(u: URL) {
  const de = Number(u.searchParams.get("de")) || 0;
  const ate = Number(u.searchParams.get("ate")) || Date.now() + 86400000;
  return { de: new Date(de).toISOString(), ate: new Date(ate).toISOString() };
}

// Chance aleatória de verdade (crypto), em [0, 1).
export function aleatorio() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}
