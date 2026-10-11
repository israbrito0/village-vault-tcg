import { db } from "@/lib/dash/servidor";

// O Ranking Mensal de Vendedores da Jamble inteira. É público: a Jamble dá um
// acesso de visitante (o mesmo de quem abre o site sem login) e o ranking
// vem de 20 em 20, com um cursor para a próxima página. Só existe o mês atual
// -- por isso cada leitura fica guardada aqui, por mês.

const BASE = "https://www.jamble.com";
// O ranking pede o código de um vendedor só para incluir a posição dele; vale
// o da conta.
const VENDEDOR_ID = "8wzVnl8IpOhixyX23yNplYK3XGn2";
const MAX_PAGINAS = 150;

type Participante = { id?: string; sellerId?: string; rank?: number; points?: number; username?: string; avatarUrl?: string; isRewarded?: boolean };
type Pagina = {
  success?: boolean;
  title?: string;
  rules?: { rule?: string; icon?: string; entryPoints?: number }[];
  participants?: Participante[];
  hasNextPage?: boolean;
  nextCursor?: string;
};

const cabecalhos = { "user-agent": "Mozilla/5.0 (Village Dash)", accept: "application/json" };

export async function acessoDeVisitante() {
  const r = await fetch(`${BASE}/api/visitor-token`, { method: "POST", headers: cabecalhos, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { visitor_token?: string };
  if (!r.ok || !j.visitor_token) throw new Error("a Jamble não deu o acesso de visitante");
  return j.visitor_token;
}

// "sellers_leaderboards/2026-10-BR/..." -> "2026-10"
const mesDoCursor = (c?: string) => c?.match(/sellers_leaderboards\/(\d{4}-\d{2})/)?.[1] ?? null;
const mesDeHoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

export async function buscarRankingJamble() {
  const token = await acessoDeVisitante();
  const lista = new Map<string, Participante>();
  let depois: string | undefined;
  let titulo = "";
  let regras: Pagina["rules"] = [];
  let mes: string | null = null;
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const q = new URLSearchParams({ seller_id: VENDEDOR_ID });
    if (depois) q.set("after", depois);
    const r = await fetch(`${BASE}/api/live/seller-ranking?${q}`, { headers: { ...cabecalhos, authorization: `Bearer ${token}` }, cache: "no-store" });
    const p = (await r.json().catch(() => ({}))) as Pagina;
    if (!r.ok || !p.success) {
      if (i === 0) throw new Error("a Jamble não respondeu o ranking");
      break;
    }
    if (i === 0) {
      titulo = p.title ?? "";
      regras = p.rules ?? [];
    }
    mes = mes ?? mesDoCursor(p.nextCursor);
    for (const x of p.participants ?? []) {
      const id = x.sellerId ?? x.id;
      if (id && !lista.has(id)) lista.set(id, x);
    }
    if (!p.hasNextPage || !p.nextCursor || p.nextCursor === depois) break;
    depois = p.nextCursor;
    await new Promise((ok) => setTimeout(ok, 120));
  }
  return { mes: mes ?? mesDeHoje(), titulo, regras, lista: [...lista.values()] };
}

export async function atualizarRankingJamble() {
  const r = await buscarRankingJamble();
  const agora = new Date().toISOString();
  const linhas = r.lista.map((p) => ({
    mes: r.mes,
    seller_id: (p.sellerId ?? p.id)!,
    posicao: p.rank ?? null,
    handle: (p.username ?? "").replace(/^@/, ""),
    foto: p.avatarUrl ?? null,
    pontos: p.points ?? null,
    recompensado: p.isRewarded ?? null,
    atualizado_em: agora,
  }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db().from("dash_ranking_jamble").upsert(linhas.slice(i, i + 500), { onConflict: "mes,seller_id" });
    if (error) throw new Error(error.message);
  }
  // Quem saiu do ranking do mês desde a última leitura não fica para trás.
  await db().from("dash_ranking_jamble").delete().eq("mes", r.mes).lt("atualizado_em", agora);
  await db().from("dash_ranking_jamble_meses").upsert({ mes: r.mes, titulo: r.titulo, regras: r.regras, total: linhas.length, atualizado_em: agora });
  return { mes: r.mes, total: linhas.length };
}

// ---------- link de live -> a live na Jamble ----------
//
// O robô acompanha uma live pelo código dela e do vendedor. Quem usa o Dash
// cola o link do jeito que tiver:
//   - jamble.com/s/<código>            (o link de compartilhar)
//   - jamble.com/live/<@>/<show>       (o endereço da live aberta)
//   - jamble.com/live/<@> ou só @<@>   (a live de agora desse vendedor)
// A página da Jamble traz os dois códigos no HTML (com as aspas escapadas).

export type LiveDoLink = { showId: string; sellerId: string; vendedor: string | null; codigo: string | null };

const NAVEGADOR = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36" };
const ID = "[A-Za-z0-9]{12,40}";

async function pagina(caminho: string) {
  const r = await fetch(`${BASE}${caminho}`, { headers: NAVEGADOR, cache: "no-store", redirect: "manual" });
  if (r.status >= 300 && r.status < 400) return { destino: r.headers.get("location") ?? "", html: "" };
  if (!r.ok) return { destino: "", html: "" };
  return { destino: "", html: (await r.text()).replace(/\\+"/g, '"') };
}

type LinkLido = { codigo: string } | { vendedor: string; showId: string | null };

export function lerLink(texto: string): LinkLido | null {
  const t = texto.trim();
  const s = t.match(/jamble\.com\/s\/([A-Za-z0-9_-]{4,40})/i);
  if (s?.[1]) return { codigo: s[1] };
  const l = t.match(new RegExp(`jamble\\.com/live/@?([A-Za-z0-9_.-]{2,40})(?:/(${ID}))?`, "i"));
  if (l?.[1]) return { vendedor: l[1].toLowerCase(), showId: l[2] ?? null };
  const arroba = t.match(/^@?([A-Za-z0-9_.-]{2,40})$/);
  if (arroba?.[1]) return { vendedor: arroba[1].toLowerCase(), showId: null };
  return null;
}

export async function resolverLink(texto: string): Promise<LiveDoLink | null> {
  const lido = lerLink(texto);
  if (!lido) return null;
  if ("codigo" in lido) {
    const { html } = await pagina(`/s/${encodeURIComponent(lido.codigo)}`);
    const showId = html.match(new RegExp(`"show":\\{"id":"(${ID})"`))?.[1];
    const sellerId = html.match(new RegExp(`"sellerId":"(${ID})"`))?.[1];
    if (!showId || !sellerId) return null;
    const vendedor = html.match(/"sellerUsername":"([A-Za-z0-9_.-]{2,40})"/)?.[1]?.toLowerCase() ?? null;
    return { showId, sellerId, vendedor, codigo: lido.codigo };
  }
  let showId = lido.showId;
  if (!showId) {
    // Sem o código da live, a Jamble manda para a live de agora do vendedor.
    const { destino } = await pagina(`/live/${encodeURIComponent(lido.vendedor)}`);
    showId = destino.match(new RegExp(`/live/[^/]+/(${ID})`))?.[1] ?? null;
    if (!showId) return null;
  }
  const { html } = await pagina(`/live/${encodeURIComponent(lido.vendedor)}/${showId}`);
  const sellerId = html.match(new RegExp(`"sellerId":"(${ID})","showId":"${showId}"`))?.[1] ?? html.match(new RegExp(`"sellerId":"(${ID})"`))?.[1];
  if (!sellerId) return null;
  return { showId, sellerId, vendedor: lido.vendedor, codigo: null };
}

export type ShowPublico = { titulo: string | null; capa: string | null; comecou: boolean; acabou: boolean; inicio: string | null };

export async function showPublico(token: string, sellerId: string, showId: string): Promise<ShowPublico | null> {
  const q = new URLSearchParams({ seller_id: sellerId, show_id: showId });
  const r = await fetch(`${BASE}/api/live/show?${q}`, { headers: { ...cabecalhos, authorization: `Bearer ${token}` }, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean; show?: Record<string, unknown>; data?: { show?: Record<string, unknown> } };
  const s = j.show ?? j.data?.show;
  if (!r.ok || !s?.id) return null;
  return {
    titulo: typeof s.title === "string" ? s.title : null,
    capa: typeof s.coverUrl === "string" ? s.coverUrl : null,
    comecou: s.hasStarted === true,
    acabou: s.isOver === true,
    inicio: typeof s.startingAt === "string" ? s.startingAt : null,
  };
}
