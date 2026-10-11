// Vendido de verdade de cada vendedor da Jamble, só com dados públicos.
//
// A Jamble não diz quanto cada vendedor vendeu: o ranking mensal só traz
// pontos (vendas e gemas juntas), e só do mês que está correndo. Mas a lista
// de vendidos de cada live é aberta a qualquer visitante, com o preço, se foi
// pago e se foi cancelado. Então:
//   1. a cada rodada, as lives que estão no ar (/api/live/feed) entram na
//      lista -- daqui para frente nenhuma live escapa;
//   2. o perfil de cada vendedor do ranking (/api/profile/tab?tab=past) dá as
//      20 lives mais recentes dele -- o que dá para recuperar do passado;
//   3. a lista de vendidos de cada live (/api/live/products?section=sold) é
//      somada por mês, pela hora de cada venda (horário de Brasília).
// O pg_cron chama a cada minuto; cada rodada trabalha ~95 s, devagar (cerca
// de 5 consultas por segundo), e continua de onde parou na seguinte.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const BASE = "https://www.jamble.com";
const UA = { "user-agent": "Mozilla/5.0 (Village Dash)", accept: "application/json" };
const ORCAMENTO_MS = 95_000;
const PARALELO = 2;
const PAUSA_MS = 150;
const PERFIS_POR_RODADA = 12;
// Começo de setembro de 2026 em Brasília: o que vem antes não interessa.
const DESDE = Date.parse("2026-09-01T03:00:00Z");

type Obj = Record<string, unknown>;
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const semArroba = (h: unknown) => String(h ?? "").replace(/^@/, "").trim();
// A Jamble manda as horas em segundos (às vezes como texto ISO).
const quando = (v: unknown): number | null => {
  if (typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v)) return Date.parse(v) || null;
  const x = n(v);
  if (!x) return null;
  return x > 1e12 ? x : Math.round(x * 1000);
};
const iso = (t: number | null) => (t ? new Date(t).toISOString() : null);
const mesDe = (t: number) => new Date(t - 3 * 3600e3).toISOString().slice(0, 7);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

let token = "";
let pedidos = 0;

async function visitante() {
  const r = await fetch(`${BASE}/api/visitor-token`, { method: "POST", headers: UA });
  const j = await r.json();
  if (!j?.visitor_token) throw new Error("sem acesso de visitante");
  token = j.visitor_token as string;
}

async function api(caminho: string, tentativa = 0): Promise<Obj | null> {
  pedidos++;
  const r = await fetch(`${BASE}${caminho}`, { headers: { ...UA, authorization: `Bearer ${token}` } });
  if (r.status === 401 && tentativa === 0) {
    await visitante();
    return api(caminho, 1);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.success === false) return null;
  return (j.data ?? j) as Obj;
}

// Trabalha a lista com poucas consultas ao mesmo tempo, até acabar o tempo.
async function emFila<T>(itens: T[], ate: number, fazer: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: PARALELO }, async () => {
      while (i < itens.length && Date.now() < ate) {
        const t = itens[i++];
        await fazer(t).catch(() => {});
        await espera(PAUSA_MS);
      }
    }),
  );
}

// ---------- 1. as lives no ar ----------

async function lerFeed() {
  const shows: Obj[] = [];
  let depois: string | null = null;
  for (let i = 0; i < 10; i++) {
    const d = await api(`/api/live/feed${depois ? `?after=${encodeURIComponent(depois)}` : ""}`);
    if (!d) break;
    shows.push(...((d.shows as Obj[]) ?? []));
    if (!d.hasNextPage || !d.nextCursor || d.nextCursor === depois) break;
    depois = String(d.nextCursor);
  }
  const noAr = shows.filter((s) => s.id && s.sellerId && s.hasStarted !== false);
  if (noAr.length) {
    // Live nova entra com o que o feed sabe; a hora certa vem depois do perfil.
    await db.from("dash_jamble_lives").upsert(
      noAr.map((s) => ({
        show_id: String(s.id),
        seller_id: String(s.sellerId),
        handle: semArroba(s.sellerUsername) || null,
        titulo: (s.title as string) ?? null,
        inicio: iso(quando(s.startsAt) ?? Date.now()),
        no_feed: true,
      })),
      { onConflict: "show_id", ignoreDuplicates: true },
    );
    await db
      .from("dash_jamble_lives")
      .update({ acabou: false, no_feed: true })
      .in("show_id", noAr.map((s) => String(s.id)));
  }
  // O que estava no ar e saiu do feed acabou.
  let q = db.from("dash_jamble_lives").update({ acabou: true, fim: new Date().toISOString() }).eq("acabou", false).eq("no_feed", true);
  if (noAr.length) q = q.not("show_id", "in", `(${noAr.map((s) => String(s.id)).join(",")})`);
  await q;
  return noAr.length;
}

// ---------- 2. os perfis dos vendedores do ranking ----------

async function lerPerfis(ate: number) {
  const { data: meses } = await db.from("dash_ranking_jamble_meses").select("mes").order("mes", { ascending: false }).limit(1);
  const mes = meses?.[0]?.mes as string | undefined;
  if (!mes) return 0;
  const [{ data: ranking }, { data: lidos }] = await Promise.all([
    db.from("dash_ranking_jamble").select("seller_id, handle, posicao").eq("mes", mes).order("posicao").limit(3000),
    db.from("dash_jamble_vendedores").select("seller_id, perfil_lido_em").limit(5000),
  ]);
  const lidoEm = new Map((lidos ?? []).map((v) => [String(v.seller_id), v.perfil_lido_em ? Date.parse(String(v.perfil_lido_em)) : 0]));
  // Primeiro quem nunca foi lido (do topo para baixo); depois o mais antigo, a cada 6 h.
  const vez = (ranking ?? [])
    .map((r) => ({ id: String(r.seller_id), handle: String(r.handle ?? ""), posicao: n(r.posicao), lido: lidoEm.get(String(r.seller_id)) ?? 0 }))
    .filter((r) => !r.lido || r.lido < Date.now() - 6 * 3600e3)
    .sort((a, b) => a.lido - b.lido || a.posicao - b.posicao)
    .slice(0, PERFIS_POR_RODADA);
  let feitos = 0;
  await emFila(vez, ate, async (v) => {
    const d = await api(`/api/profile/tab?${new URLSearchParams({ user_id: v.id, tab: "past" })}`);
    if (!d || !Array.isArray(d.pastShows)) {
      await db.from("dash_jamble_vendedores").upsert({ seller_id: v.id, handle: v.handle, perfil_lido_em: new Date().toISOString(), erro: "perfil não respondeu" });
      return;
    }
    const shows = d.pastShows as Obj[];
    const inicios = shows.map((s) => quando(s.startedAt) ?? quando(s.startingAt) ?? 0).filter(Boolean);
    const linhas = shows
      .map((s) => ({ s, inicio: quando(s.startedAt) ?? quando(s.startingAt) }))
      .filter(({ s, inicio }) => s.id && inicio && inicio >= DESDE)
      .map(({ s, inicio }) => ({
        show_id: String(s.id),
        seller_id: String(s.sellerId ?? v.id),
        handle: v.handle || null,
        titulo: (s.title as string) ?? null,
        inicio: iso(inicio),
        fim: iso(quando(s.endedAt)),
        acabou: s.isOver === true,
      }));
    if (linhas.length) await db.from("dash_jamble_lives").upsert(linhas, { onConflict: "show_id" });
    await db.from("dash_jamble_vendedores").upsert({
      seller_id: v.id,
      handle: v.handle,
      perfil_lido_em: new Date().toISOString(),
      lives_no_perfil: shows.length,
      // Com 20 lives no perfil, as anteriores à mais antiga delas não aparecem.
      completo_desde: shows.length >= 20 && inicios.length ? iso(Math.min(...inicios)) : null,
      erro: null,
    });
    feitos++;
  });
  return feitos;
}

// ---------- 3. os vendidos de cada live ----------

async function somarLive(l: { show_id: string; seller_id: string }) {
  let depois: string | null = null;
  let vendido = 0, cancelado = 0, itens = 0, vendas = 0;
  const porMes: Record<string, { vendido: number; itens: number; vendas: number }> = {};
  let completa = false;
  for (let i = 0; i < 120; i++) {
    const q = new URLSearchParams({ seller_id: l.seller_id, show_id: l.show_id, section: "sold" });
    if (depois) q.set("after", depois);
    const d = await api(`/api/live/products?${q}`);
    if (!d) break;
    for (const it of (d.items as Obj[]) ?? []) {
      const s = it.sold as Obj | undefined;
      if (!s?.saleId) continue;
      const qtd = n(it.soldCount) || 1;
      const valor = n(s.totalSoldPrice) || n(s.soldPrice) * qtd;
      if (s.isCanceled === true) {
        cancelado += valor;
        continue;
      }
      if (s.isPaid === false) continue;
      vendido += valor;
      itens += qtd;
      vendas++;
      const mes = mesDe(quando(s.createdAt) ?? Date.now());
      const m = (porMes[mes] ??= { vendido: 0, itens: 0, vendas: 0 });
      m.vendido += valor;
      m.itens += qtd;
      m.vendas++;
    }
    if (!d.hasNextPage || !d.nextCursor || d.nextCursor === depois) {
      completa = true;
      break;
    }
    depois = String(d.nextCursor);
    await espera(PAUSA_MS);
  }
  if (!completa) {
    await db.from("dash_jamble_lives").update({ erro: "lista de vendidos não veio inteira", lido_em: new Date().toISOString() }).eq("show_id", l.show_id);
    return;
  }
  await db
    .from("dash_jamble_lives")
    .update({ vendido, cancelado, itens, vendas, por_mes: porMes, lido_em: new Date().toISOString(), erro: null })
    .eq("show_id", l.show_id);
}

async function lerVendidos(ate: number) {
  const agora = Date.now();
  const { data } = await db
    .from("dash_jamble_lives")
    .select("show_id, seller_id, acabou, fim, lido_em, inicio, erro")
    .or(`lido_em.is.null,acabou.eq.false,fim.gt.${new Date(agora - 4 * 86400e3).toISOString().slice(0, 19)}Z,erro.not.is.null`)
    .order("lido_em", { ascending: true, nullsFirst: true })
    .limit(500);
  const vez = (data ?? []).filter((l) => {
    const lido = l.lido_em ? Date.parse(String(l.lido_em)) : 0;
    const fim = l.fim ? Date.parse(String(l.fim)) : 0;
    if (!lido) return true;
    if (l.erro) return lido < agora - 30 * 60e3;
    // No ar: a cada 10 min. Acabou há menos de 4 dias: a cada 3 h (pagamentos que entram).
    if (!l.acabou) return lido < agora - 10 * 60e3;
    return fim > agora - 4 * 86400e3 && lido < agora - 3 * 3600e3;
  }) as { show_id: string; seller_id: string }[];
  let feitas = 0;
  await emFila(vez, ate, async (l) => {
    await somarLive(l);
    feitas++;
  });
  return { feitas, faltam: Math.max(0, vez.length - feitas) };
}

async function ciclo() {
  const { data: vaga } = await db.rpc("dash_jamble_vaga");
  if (!vaga) return;
  const inicio = Date.now();
  const ate = inicio + ORCAMENTO_MS;
  const detalhes: Obj = {};
  try {
    pedidos = 0;
    await visitante();
    detalhes.noAr = await lerFeed();
    detalhes.perfis = await lerPerfis(inicio + 30_000);
    Object.assign(detalhes, await lerVendidos(ate));
    detalhes.pedidos = pedidos;
    detalhes.segundos = Math.round((Date.now() - inicio) / 1000);
    await db.from("dash_jamble_estado").update({ ultimo_ciclo: new Date().toISOString(), detalhes }).eq("id", 1);
  } catch (e) {
    detalhes.erro = String((e as Error)?.message ?? e).slice(0, 300);
    await db.from("dash_jamble_estado").update({ detalhes }).eq("id", 1);
  }
}

Deno.serve(() => {
  // Responde na hora e segue trabalhando em segundo plano.
  EdgeRuntime.waitUntil(ciclo());
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
