import type { MonitorInfo } from "@/lib/dash/api";
import { acessoDeVisitante, resolverLink, showPublico } from "@/lib/dash/jamble";
import { db, erro, membroDaRequisicao, ok } from "@/lib/dash/servidor";

// O robô que acompanha lives só pelo link, sem a extensão (a função dash-robo
// no Supabase, chamada pelo pg_cron a cada minuto):
//   GET            -> as lives que ele está acompanhando e se ele está rodando
//   POST {link}    -> começa a acompanhar a live do link
//   PATCH {id, ativo} -> para (ou volta a acompanhar) uma live
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Quanto tempo o robô fica numa live colada (uma live longa cabe folgado).
const HORAS = 14;


const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : null);

function monitorDaLinha(r: Record<string, unknown>): MonitorInfo {
  return {
    id: String(r.id),
    showId: String(r.show_id),
    vendedor: (r.vendedor as string) ?? null,
    titulo: (r.titulo as string) ?? null,
    ativo: r.ativo === true,
    automatico: r.automatico === true,
    criadoEm: ms(r.criado_em) ?? 0,
    ate: ms(r.ate) ?? 0,
    ultimoCiclo: ms(r.ultimo_ciclo),
    ultimoErro: (r.ultimo_erro as string) ?? null,
  };
}

export async function GET(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const [lista, robo] = await Promise.all([
    db()
      .from("dash_monitores")
      .select("*")
      .eq("conta", membro.conta)
      .or(`ativo.eq.true,criado_em.gte.${new Date(Date.now() - 24 * 3600e3).toISOString()}`)
      .order("criado_em", { ascending: false })
      .limit(20),
    db().from("dash_robo").select("ultimo_inicio, ultimo_ciclo, ultimo_erro").eq("id", 1).maybeSingle(),
  ]);
  return ok({
    monitores: (lista.data ?? []).map(monitorDaLinha),
    robo: {
      rodouEm: ms(robo.data?.ultimo_inicio),
      terminouEm: ms(robo.data?.ultimo_ciclo),
      erro: (robo.data?.ultimo_erro as string) ?? null,
    },
  });
}

// Chama o robô na hora para a live nova (sem esperar o minuto do pg_cron).
async function acordarRobo(id: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return;
  await fetch(`${base}/functions/v1/dash-robo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ monitor: id }),
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}

export async function POST(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const corpo = (await req.json().catch(() => ({}))) as { link?: unknown };
  const link = typeof corpo.link === "string" ? corpo.link.slice(0, 300) : "";
  if (!link.trim()) return erro(400, "Cole o link da live.");

  const alvo = await resolverLink(link).catch(() => null);
  if (!alvo) return erro(404, "Não achei essa live na Jamble. Confira o link (jamble.com/s/… ou jamble.com/live/…).");
  const token = await acessoDeVisitante().catch(() => null);
  const show = token ? await showPublico(token, alvo.sellerId, alvo.showId).catch(() => null) : null;
  if (!show) return erro(404, "A Jamble não mostrou essa live. Ela pode ter sido apagada.");

  const agora = new Date();
  // A live aparece no Dash na hora; o robô completa o resto em segundos.
  const { data: existente } = await db().from("dash_lives").select("show_id").eq("show_id", alvo.showId).maybeSingle();
  const live: Record<string, unknown> = { show_id: alvo.showId, conta: membro.conta, visto_em: agora.toISOString() };
  if (!existente) {
    Object.assign(live, {
      vendedor: alvo.vendedor,
      titulo: show.titulo,
      capa_url: show.capa,
      ao_vivo: show.comecou && !show.acabou,
      inicio: show.inicio,
    });
  }
  // O código do link de compartilhar vai no relatório (jamble.com/s/…).
  if (alvo.codigo) {
    const { data: antes } = await db().from("dash_lives").select("metricas").eq("show_id", alvo.showId).maybeSingle();
    live.metricas = { ...((antes?.metricas as Record<string, unknown>) ?? {}), codigo: alvo.codigo };
  }
  const { error: e1 } = await db().from("dash_lives").upsert(live, { onConflict: "show_id" });
  if (e1) return erro(500, "não consegui guardar a live");

  const { data: monitor, error: e2 } = await db()
    .from("dash_monitores")
    .upsert(
      {
        conta: membro.conta,
        show_id: alvo.showId,
        seller_id: alvo.sellerId,
        codigo: alvo.codigo,
        vendedor: alvo.vendedor,
        titulo: show.titulo,
        ativo: true,
        automatico: false,
        criado_em: agora.toISOString(),
        // Uma live que já acabou: uma rodada basta para puxar os vendidos.
        ate: new Date(agora.getTime() + (show.acabou ? 10 * 60e3 : HORAS * 3600e3)).toISOString(),
        ultimo_ciclo: null,
        ultimo_erro: null,
      },
      { onConflict: "conta,show_id" },
    )
    .select("*")
    .single();
  if (e2 || !monitor) return erro(500, "não consegui ligar o robô");
  await acordarRobo(String(monitor.id));
  return ok({ monitor: monitorDaLinha(monitor), showId: alvo.showId, acabou: show.acabou, comecou: show.comecou });
}

export async function PATCH(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const corpo = (await req.json().catch(() => ({}))) as { id?: unknown; ativo?: unknown };
  if (typeof corpo.id !== "string") return erro(400, "qual live?");
  const ativo = corpo.ativo === true;
  const mudar: Record<string, unknown> = { ativo };
  if (ativo) mudar.ate = new Date(Date.now() + HORAS * 3600e3).toISOString();
  const { data, error } = await db().from("dash_monitores").update(mudar).eq("id", corpo.id).eq("conta", membro.conta).select("*").maybeSingle();
  if (error || !data) return erro(404, "não achei");
  return ok({ monitor: monitorDaLinha(data) });
}
