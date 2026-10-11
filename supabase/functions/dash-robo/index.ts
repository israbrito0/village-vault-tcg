// Robô do Dash Village: acompanha lives da Jamble só pelo link, sem a extensão.
//
// Entra como visitante -- o mesmo acesso de quem abre a Jamble sem login --,
// abre os canais da live (show e chat) e escuta por ~80 s, gravando no banco
// as emotions, o chat, o leilão, a batalha e a audiência; e lê pela API da
// live os vendidos (com comprador e se pagou) e quem está assistindo.
// O pg_cron chama a cada minuto; as rodadas se sobrepõem um pouco para não
// perder nada entre uma e outra, e tudo é gravado pelo id da Jamble.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const BASE = "https://www.jamble.com";
const WS = "wss://ws.jamble.com/websocket";
const UA = { "user-agent": "Mozilla/5.0 (Village Dash)", accept: "application/json" };
const NAVEGADOR = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36" };
const OUVIR_MS = 80_000;
const GRAVAR_A_CADA_MS = 6_000;
const MAX_MONITORES = 8;
// A conta dona do Dash: a live dela é acompanhada sozinha quando começa.
const CONTA = "israelbrito";
const CONTA_SELLER_ID = "8wzVnl8IpOhixyX23yNplYK3XGn2";

type Obj = Record<string, unknown>;
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ms = (v: unknown) => (v ? Math.round(Number(v) * 1000) : null);
const iso = (t: number | null | undefined) => new Date(t && t > 1.5e12 && t < 4.2e12 ? t : Date.now()).toISOString();
const semArroba = (h: unknown) => String(h ?? "").replace(/^@/, "").trim();
const fotoDe = (p: Obj | undefined | null) => {
  const img = p?.profile_image as unknown;
  const u = typeof img === "string" ? img : (img as Obj | undefined)?.low ?? (img as Obj | undefined)?.medium ?? (img as Obj | undefined)?.original_url;
  return typeof u === "string" && u.startsWith("https://") ? u : null;
};

async function visitante() {
  const r = await fetch(`${BASE}/api/visitor-token`, { method: "POST", headers: UA });
  const j = await r.json();
  if (!j?.visitor_token) throw new Error("sem acesso de visitante");
  return j.visitor_token as string;
}

async function api(token: string, caminho: string) {
  const r = await fetch(`${BASE}${caminho}`, { headers: { ...UA, authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.success === false) return null;
  return (j.data ?? j) as Obj;
}

async function emLotes<T>(linhas: T[], tam: number, fazer: (l: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let i = 0; i < linhas.length; i += tam) {
    const { error } = await fazer(linhas.slice(i, i + tam));
    if (error) throw new Error(error.message);
  }
}

// ---------- a live da própria conta liga sozinha ----------

// A página de perfil (/u/<@>) diz a live em andamento ("ongoingShow") e as
// agendadas ("upcomingShows"). Se a live já começou, liga o robô nela; senão
// devolve a próxima agendada (o Início mostra, como no Dash TCG).
async function verificarPropriaLive(token: string) {
  const r = await fetch(`${BASE}/u/${CONTA}`, { headers: NAVEGADOR });
  const h = r.ok ? (await r.text()).replace(/\\+"/g, '"') : "";
  let showId = h.match(/"ongoingShow":\{"id":"([A-Za-z0-9]+)"/)?.[1] ?? null;
  if (!showId) {
    // Se a página mudar: o endereço /live/<@> leva para a live de agora.
    const rr = await fetch(`${BASE}/live/${CONTA}`, { headers: UA, redirect: "manual" });
    showId = (rr.headers.get("location") ?? "").match(/\/live\/[^/]+\/([A-Za-z0-9]+)/)?.[1] ?? null;
  }
  if (showId) {
    const s = await api(token, `/api/live/show?seller_id=${CONTA_SELLER_ID}&show_id=${showId}`);
    const show = (s?.show ?? {}) as Obj;
    if (show.id && show.hasStarted && !show.isOver) {
      await db
        .from("dash_monitores")
        .upsert(
          { conta: CONTA, show_id: showId, seller_id: CONTA_SELLER_ID, vendedor: CONTA, titulo: show.title ?? null, ativo: true, automatico: true, ate: new Date(Date.now() + 14 * 3600e3).toISOString() },
          { onConflict: "conta,show_id", ignoreDuplicates: true },
        );
      return null;
    }
  }
  const p = h.indexOf('"upcomingShows":[{');
  if (p < 0) return null;
  const t = h.slice(p, p + 3000);
  const id = t.match(/"id":"([A-Za-z0-9]+)"/)?.[1];
  if (!id) return null;
  const inicio = ms(t.match(/"startingAt":([\d.]+)/)?.[1]);
  return {
    conta: CONTA,
    showId: id,
    titulo: t.match(/"title":"([^"]*)"/)?.[1] ?? null,
    inicio: inicio ? new Date(inicio).toISOString() : null,
    capa: t.match(/"coverUrl":"(https:[^"]+)"/)?.[1] ?? null,
  };
}

// ---------- acompanhar uma live ----------

type Monitor = { id: string; conta: string; show_id: string; seller_id: string; vendedor: string | null; ate: string };

// Live agendada colada no Dash: o robô só entra a partir de 10 min antes do
// horário (sem ficar conectado dias numa live que não começou).
const jaPodeComecar = () => `comeca_em.is.null,comeca_em.lte.${new Date(Date.now() + 10 * 60e3).toISOString().slice(0, 19)}Z`;

// A lista Vendidos inteira, de página em página. "completa" diz se veio até
// o fim: só uma lista completa pode tirar do banco o que sumiu dela.
async function vendidos(token: string, m: Monitor) {
  const itens: Obj[] = [];
  let depois: string | null = null;
  for (let i = 0; i < 60; i++) {
    const q = new URLSearchParams({ seller_id: m.seller_id, show_id: m.show_id, section: "sold" });
    if (depois) q.set("after", depois);
    const p = await api(token, `/api/live/products?${q}`);
    if (!p) return { itens, completa: false };
    itens.push(...((p.items as Obj[]) ?? []));
    if (!p.hasNextPage || !p.nextCursor || p.nextCursor === depois) return { itens, completa: true };
    depois = String(p.nextCursor);
  }
  return { itens, completa: false };
}

async function assistindo(token: string, m: Monitor) {
  const lista: { handle: string; foto: string | null }[] = [];
  let depois: string | null = null;
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ seller_id: m.seller_id, show_id: m.show_id });
    if (depois) q.set("after", depois);
    const p = await api(token, `/api/live/viewers?${q}`);
    if (!p) break;
    for (const v of (p.items as Obj[]) ?? []) {
      const h = semArroba(v.username);
      if (h) lista.push({ handle: h, foto: typeof v.avatarUrl === "string" ? v.avatarUrl : null });
    }
    if (!p.hasNextPage || !p.nextCursor) break;
    depois = String(p.nextCursor);
  }
  return lista;
}

async function monitorar(m: Monitor, token: string) {
  const showId = m.show_id;
  const emocoes = new Map<string, Obj>();
  const chat = new Map<string, Obj>();
  const apagadas = new Set<string>();
  const icones = new Map<string, string>();
  let show: Obj = {};
  let vendedor: Obj = {};
  let leilao: Obj | null = null;
  let leilaoId: string | null = null;
  const disputantes = new Set<string>();
  let batalha: Obj | null = null;
  let grupo: string | null = null;
  let mudou = true;
  let acabou = false;

  const q = (extra = "") => `device_uuid=${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}&accept_language=pt-BR&timezone=America%2FSao_Paulo&token=${encodeURIComponent(token)}${extra}`;

  const tratarShow = (j: Obj) => {
    const d = (j.data ?? {}) as Obj;
    if (d.show && typeof d.show === "object") {
      show = { ...show, ...(d.show as Obj) };
      if (typeof show.group_message_id === "string" && !grupo) abrirChat(String(show.group_message_id));
      if (show.is_over === true) acabou = true;
      mudou = true;
    }
    if (d.seller && typeof d.seller === "object") vendedor = d.seller as Obj;
    // Leilão (o item, o melhor lance e quem disputa chegam em pedaços).
    const s = d.sale as Obj | undefined;
    const best = d.sale_best_entry as Obj | undefined;
    const id = (s?.id as string) || (best?.sale_id as string) || (d.sale_entry_count != null || d.sale_entry_user_ids ? leilaoId : null);
    if (id) {
      if (id !== leilaoId) {
        leilaoId = id;
        disputantes.clear();
        leilao = { id };
      }
      const l = { ...(leilao ?? { id }) } as Obj;
      if (s) {
        const cfg = (s.settings ?? {}) as Obj;
        l.tipo = cfg.type ?? l.tipo ?? null;
        if (cfg.starting_price != null) l.inicial = n(cfg.starting_price);
        if (s.price != null && l.tipo === "BUY_IT_NOW") l.melhor = n(s.price);
        if (s.available_count != null) l.restam = n(s.available_count);
        if (s.sold_count != null) l.vendidas = n(s.sold_count);
        l.inicio = ms(s.created_at) ?? l.inicio ?? null;
        const fim = ms(s.ended_at);
        l.termina = fim && fim > Date.now() ? fim : null;
        l.situacao = s.is_canceled ? "cancelado" : s.is_sold ? "vendido" : s.status === "FINISHED" ? "sem venda" : "rolando";
        if (s.sold_price != null) l.melhor = Math.max(n(l.melhor), n(s.sold_price));
      }
      const produto = d.sale_product as Obj | undefined;
      if (produto?.title) l.titulo = String(produto.title);
      if (best && (!best.sale_id || best.sale_id === id)) {
        l.melhor = Math.max(n(l.melhor), n(best.price));
        const bp = best.buyer_profile as Obj | undefined;
        if (bp?.username) l.vencedor = semArroba(bp.username);
      }
      if (d.sale_entry_count != null) l.lances = Math.max(n(l.lances), n(d.sale_entry_count));
      if (Array.isArray(d.sale_entry_user_ids)) for (const u of d.sale_entry_user_ids) disputantes.add(String(u));
      l.disputaram = disputantes.size;
      leilao = l;
      mudou = true;
    }
    // Batalha (vermelho x azul).
    const b = d.battle as Obj | undefined;
    if (b?.id) {
      const pv = n(b.red_team_participant_total_entry_count);
      const pa = n(b.blue_team_participant_total_entry_count);
      batalha = {
        lider: pv === pa ? "empate" : pv > pa ? "vermelho" : "azul",
        diferenca: Math.abs(pv - pa),
        vermelho: { pessoas: n(b.red_team_participant_count), pontos: pv },
        azul: { pessoas: n(b.blue_team_participant_count), pontos: pa },
        acabou: b.is_over === true,
        termina: ms(b.ending_at),
      };
      mudou = true;
    }
    // Emotions: cada envio é um evento LIKE com quem mandou e qual ícone.
    for (const e of (Array.isArray(d.events) ? d.events : []) as Obj[]) {
      if (e?.event_type !== "LIKE" || !e.id) continue;
      const p = (e.liker_profile ?? {}) as Obj;
      const icone = String(e.like_icon_id ?? "");
      if (icone && typeof e.like_icon_url === "string") icones.set(icone, e.like_icon_url);
      emocoes.set(String(e.id), {
        id: `${showId}:${e.id}`,
        show_id: showId,
        handle: semArroba(p.username),
        nome: (p.display_name as string) || (p.username as string) || null,
        foto: fotoDe(p) ?? (typeof e.user_profile_picture === "string" ? e.user_profile_picture : null),
        icone,
        gemas: n(e.like_icon_battle_entry_count),
        time: e.battle_team === "red" || e.battle_team === "blue" ? e.battle_team : null,
        ts: iso(ms(e.created_at)),
      });
    }
  };

  const tratarChat = (j: Obj) => {
    const d = (j.data ?? {}) as Obj;
    for (const msg of (Array.isArray(d.messages) ? d.messages : []) as Obj[]) {
      const p = (msg.sender_profile ?? {}) as Obj;
      if (!msg.id || !p.username || (grupo && msg.group_message_id !== grupo)) continue;
      if (msg.is_visible === false) continue;
      chat.set(String(msg.id), {
        id: `${showId}:${msg.id}`,
        show_id: showId,
        handle: semArroba(p.username),
        nome: (p.display_name as string) || null,
        foto: fotoDe(p),
        texto: typeof msg.content === "string" ? msg.content.slice(0, 500) : "",
        ts: iso(ms(msg.created_at)),
      });
    }
    for (const u of (Array.isArray(d.updated_messages) ? d.updated_messages : []) as Obj[]) {
      if (u?.id && u.is_visible === false) apagadas.add(`${showId}:${u.id}`);
    }
  };

  const sockets: WebSocket[] = [];
  const abrir = (url: string, tratar: (j: Obj) => void) => {
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        tratar(JSON.parse(String(ev.data)));
      } catch {
        // quadro que não é JSON: ignora
      }
    };
    sockets.push(ws);
  };
  function abrirChat(id: string) {
    grupo = id;
    abrir(`${WS}/group_message/${id}?${q()}`, tratarChat);
  }
  abrir(`${WS}/show/${m.seller_id}/${showId}?${q()}`, tratarShow);

  const gravarLive = async (extra: { metricas?: Obj } = {}) => {
    const linha: Obj = { show_id: showId, conta: m.conta, visto_em: new Date().toISOString() };
    if (vendedor.username) linha.vendedor = semArroba(vendedor.username);
    const fv = fotoDe(vendedor);
    if (fv) linha.vendedor_foto = fv;
    if (show.title) linha.titulo = String(show.title);
    const capa = (show.cover_image ?? {}) as Obj;
    if (typeof capa.medium === "string") linha.capa_url = capa.medium;
    if (show.started_at) linha.inicio = iso(ms(show.started_at));
    if (show.has_started !== undefined || show.is_over !== undefined) linha.ao_vivo = show.has_started === true && show.is_over !== true;
    if (show.audience_count != null) linha.audiencia = n(show.audience_count);
    if (show.like_count != null) linha.likes = n(show.like_count);
    if (leilao) linha.leilao = leilao;
    if (batalha) linha.batalha = batalha;
    const { data: atual } = await db.from("dash_lives").select("metricas, audiencia_pico, fim").eq("show_id", showId).maybeSingle();
    // Uma live antiga colada no Dash não ganha "acabou agora".
    if (show.is_over === true && !atual?.fim) linha.fim = show.ended_at ? iso(ms(show.ended_at)) : new Date().toISOString();
    linha.metricas = { ...((atual?.metricas as Obj) ?? {}), ...(extra.metricas ?? {}) };
    if (show.id) {
      const pico = Math.max(n(atual?.audiencia_pico), n(show.audience_count));
      linha.audiencia_pico = pico;
      linha.metricas = {
        ...(linha.metricas as Obj),
        audienciaAgora: n(show.audience_count),
        likes: n(show.like_count),
        pico,
        faturamento: n(show.total_sale_product_price),
        vendas: n(show.sold_sale_count),
        produtosVendidos: n(show.sold_product_count),
        produtosDisponiveis: n(show.available_product_count),
        compartilhamentos: n(show.share_count),
        comecouEm: ms(show.started_at),
        acabou: show.is_over === true,
        titulo: show.title ?? null,
        robo: true,
        quando: Date.now(),
      };
    }
    const { error } = await db.from("dash_lives").upsert(linha, { onConflict: "show_id" });
    if (error) throw new Error(error.message);
  };

  const gravarEventos = async () => {
    const e = [...emocoes.values()].filter((x) => x.handle);
    emocoes.clear();
    await emLotes(e, 500, (l) => db.from("dash_emocoes").upsert(l, { onConflict: "id", ignoreDuplicates: true }));
    const c = [...chat.values()];
    chat.clear();
    await emLotes(c, 500, (l) => db.from("dash_chat").upsert(l, { onConflict: "id" }));
    if (apagadas.size) {
      await db.from("dash_chat").delete().in("id", [...apagadas]);
      apagadas.clear();
    }
    if (icones.size) {
      const linhas = [...icones.entries()].map(([id, url]) => ({ id, url, atualizado_em: new Date().toISOString() }));
      icones.clear();
      await db.from("dash_icones").upsert(linhas, { onConflict: "id", ignoreDuplicates: true });
    }
  };

  const gravarVendas = async () => {
    const { itens, completa } = await vendidos(token, m);
    if (!itens.length) return;
    const agora = new Date().toISOString();
    const vend = semArroba(vendedor.username) || m.vendedor;
    const linhas = itens
      .filter((i) => (i.sold as Obj | undefined)?.saleId)
      .map((i) => {
        const s = i.sold as Obj;
        const qtd = n(i.soldCount) || 1;
        return {
          id: `${showId}:${s.saleId}`,
          show_id: showId,
          conta: m.conta,
          vendedor: vend,
          titulo: typeof i.title === "string" ? i.title.slice(0, 200) : null,
          imagem: typeof i.imageUrl === "string" ? i.imageUrl : null,
          comprador: semArroba(s.buyerUsername) || null,
          foto: typeof s.buyerAvatarUrl === "string" ? s.buyerAvatarUrl : null,
          preco: n(s.soldPrice),
          quantidade: qtd,
          total: n(s.totalSoldPrice) || n(s.soldPrice) * qtd,
          tipo: typeof i.saleType === "string" ? i.saleType : null,
          pago: typeof s.isPaid === "boolean" ? s.isPaid : null,
          cancelado: s.isCanceled === true,
          ts: iso(ms(s.createdAt)),
          atualizado_em: agora,
          origem: "robo",
        };
      });
    await emLotes(linhas, 500, (l) => db.from("dash_vendas").upsert(l, { onConflict: "id" }));
    // O que o próprio robô gravou antes e sumiu da lista saiu da live.
    if (!completa) return;
    const ficam = new Set(linhas.map((l) => l.id));
    const { data: antes } = await db.from("dash_vendas").select("id").eq("show_id", showId).eq("origem", "robo").limit(5000);
    const sobram = (antes ?? []).map((x) => x.id as string).filter((id) => !ficam.has(id));
    await emLotes(sobram, 100, (l) => db.from("dash_vendas").delete().in("id", l));
  };

  // Quem está assistindo: a Jamble dá a lista para qualquer visitante.
  const lerAssistindo = async () => {
    const pessoas = await assistindo(token, m).catch(() => null);
    if (!pessoas) return {};
    return { assistindo: pessoas.slice(0, 300), assistindoTotal: pessoas.length, assistindoEm: Date.now() };
  };

  const inicio = Date.now();
  // Primeiro a live existe no banco (o painel abre na hora); depois o resto.
  await new Promise((r) => setTimeout(r, 2500));
  await gravarLive();
  const [, pessoas] = await Promise.all([gravarVendas().catch(() => {}), lerAssistindo()]);
  await gravarLive({ metricas: pessoas });

  let ultimaVenda = Date.now();
  while (Date.now() - inicio < OUVIR_MS && !acabou) {
    await new Promise((r) => setTimeout(r, GRAVAR_A_CADA_MS));
    await gravarEventos();
    // Vendidos e quem assiste de novo a cada ~25 s (uma venda nova aparece
    // no painel logo).
    let extra = {};
    if (Date.now() - ultimaVenda > 25_000) {
      ultimaVenda = Date.now();
      const [, p] = await Promise.all([gravarVendas().catch(() => {}), lerAssistindo()]);
      extra = p;
      mudou = true;
    }
    if (mudou) {
      mudou = false;
      await gravarLive({ metricas: extra });
    }
  }
  for (const ws of sockets) ws.close();
  await gravarEventos();
  await gravarVendas().catch(() => {});
  await gravarLive();

  const fim: Obj = { ultimo_ciclo: new Date().toISOString(), ultimo_erro: null, titulo: show.title ?? null, vendedor: semArroba(vendedor.username) || m.vendedor };
  if (acabou || new Date(m.ate).getTime() < Date.now()) fim.ativo = false;
  await db.from("dash_monitores").update(fim).eq("id", m.id);
}

async function ciclo() {
  const detalhes: Obj = {};
  // Uma rodada a cada ~50 s, quem quer que chame: a vaga é pega no banco.
  const { data: vaga } = await db.rpc("dash_robo_vaga");
  if (!vaga) return;
  try {
    const token = await visitante();
    detalhes.agendada = await verificarPropriaLive(token).catch((e) => {
      detalhes.propria = String(e);
      return null;
    });
    await db.from("dash_monitores").update({ ativo: false }).eq("ativo", true).lt("ate", new Date().toISOString());
    const { data } = await db
      .from("dash_monitores")
      .select("*")
      .eq("ativo", true)
      .or(jaPodeComecar())
      .order("criado_em", { ascending: false })
      .limit(MAX_MONITORES);
    const lista = (data ?? []) as Monitor[];
    await Promise.all(
      lista.map((m) =>
        monitorar(m, token).catch(async (e) => {
          await db.from("dash_monitores").update({ ultimo_erro: String(e?.message ?? e).slice(0, 300), ultimo_ciclo: new Date().toISOString() }).eq("id", m.id);
        }),
      ),
    );
    await db.from("dash_robo").update({ ultimo_ciclo: new Date().toISOString(), ultimo_erro: null, monitores: lista.length, detalhes }).eq("id", 1);
  } catch (e) {
    await db.from("dash_robo").update({ ultimo_erro: String((e as Error)?.message ?? e).slice(0, 300), detalhes }).eq("id", 1);
  }
}

// Uma live que acabou de ser colada no Dash começa na hora, sem esperar o
// minuto do pg_cron. Só vale uma vez por live nova (quem pega a vaga marca
// ultimo_ciclo), então chamar isso de fora não faz o robô trabalhar a mais.
async function primeiraRodada(id: string) {
  const { data } = await db
    .from("dash_monitores")
    .update({ ultimo_ciclo: new Date().toISOString() })
    .eq("id", id)
    .eq("ativo", true)
    .is("ultimo_ciclo", null)
    .gte("criado_em", new Date(Date.now() - 5 * 60e3).toISOString())
    .or(jaPodeComecar())
    .select("*");
  const m = (data ?? [])[0] as Monitor | undefined;
  if (!m) return;
  const token = await visitante();
  await monitorar(m, token).catch(async (e) => {
    await db.from("dash_monitores").update({ ultimo_erro: String(e?.message ?? e).slice(0, 300) }).eq("id", m.id);
  });
}

Deno.serve(async (req) => {
  const corpo = (await req.json().catch(() => ({}))) as { monitor?: unknown };
  const id = typeof corpo.monitor === "string" && /^[0-9a-f-]{36}$/.test(corpo.monitor) ? corpo.monitor : null;
  // Responde na hora e segue trabalhando em segundo plano (até ~150 s).
  EdgeRuntime.waitUntil(id ? primeiraRodada(id) : ciclo());
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
