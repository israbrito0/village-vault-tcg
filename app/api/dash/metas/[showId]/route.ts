import { metaDaLinha } from "@/lib/dash/api";
import { TIPOS_DE_META } from "@/lib/dash/calculos";
import { db, erro, liveDoMembro, membroDaRequisicao, ok } from "@/lib/dash/servidor";

// Metas de uma live: criar, editar, excluir e marcar como batida (o painel
// avisa quando vê o número passar do alvo; a tela do OBS também calcula).
export const dynamic = "force-dynamic";

type Corpo = {
  acao?: string;
  id?: string;
  nome?: string;
  tipo?: string;
  escopo?: string;
  alvo?: number;
  premio?: string | null;
  ativo?: boolean;
};

function campos(c: Corpo) {
  const m: Record<string, unknown> = {};
  if (typeof c.nome === "string") m.nome = c.nome.trim().slice(0, 80);
  if (typeof c.tipo === "string" && TIPOS_DE_META.some((t) => t.id === c.tipo)) m.tipo = c.tipo;
  if (c.escopo === "live" || c.escopo === "pessoa") m.escopo = c.escopo;
  if (c.alvo !== undefined && Number(c.alvo) > 0) m.alvo = Number(c.alvo);
  if (c.premio !== undefined) m.premio = typeof c.premio === "string" && c.premio.trim() ? c.premio.trim().slice(0, 120) : null;
  if (typeof c.ativo === "boolean") m.ativo = c.ativo;
  return m;
}

async function listar(showId: string) {
  const { data } = await db().from("dash_metas").select("*").eq("show_id", showId).order("ordem").order("criado_em");
  return (data ?? []).map(metaDaLinha);
}

export async function POST(req: Request, { params }: { params: { showId: string } }) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const showId = decodeURIComponent(params.showId);
  if (!(await liveDoMembro(showId, membro.conta))) return erro(404, "live não encontrada");
  const c = (await req.json().catch(() => ({}))) as Corpo;

  // A meta da live, do topo da página de sorteios: "X pontos de ranking
  // mensal" ou "de emotions desta live". Uma só por live; alvo vazio apaga.
  if (c.acao === "meta-live") {
    await db().from("dash_metas").delete().eq("show_id", showId).eq("escopo", "live").in("tipo", ["ranking", "emocoes"]);
    if (Number(c.alvo) > 0) {
      const { error } = await db()
        .from("dash_metas")
        .insert({ show_id: showId, conta: membro.conta, nome: "Meta da live", tipo: c.tipo === "emocoes" ? "emocoes" : "ranking", escopo: "live", alvo: Number(c.alvo) });
      if (error) return erro(500, "não consegui salvar a meta");
    }
    return ok({ metas: await listar(showId) });
  }

  if (c.acao === "criar") {
    const m = campos(c);
    if (!m.tipo || !m.alvo) return erro(400, "diga o tipo e o alvo da meta");
    if (m.escopo === "pessoa" && !TIPOS_DE_META.find((t) => t.id === m.tipo)?.pessoa) return erro(400, "esse tipo não vale por pessoa");
    const { count } = await db().from("dash_metas").select("id", { count: "exact", head: true }).eq("show_id", showId);
    if ((count ?? 0) >= 20) return erro(400, "máximo de 20 metas por live");
    const { error } = await db().from("dash_metas").insert({ ...m, show_id: showId, conta: membro.conta, ordem: count ?? 0 });
    if (error) return erro(500, "não consegui criar");
    return ok({ metas: await listar(showId) });
  }
  if (!c.id) return erro(400, "qual meta?");
  if (c.acao === "editar") {
    await db().from("dash_metas").update({ ...campos(c), batida_em: null }).eq("id", c.id).eq("show_id", showId);
  } else if (c.acao === "excluir") {
    await db().from("dash_metas").delete().eq("id", c.id).eq("show_id", showId);
  } else if (c.acao === "bater") {
    await db().from("dash_metas").update({ batida_em: new Date().toISOString() }).eq("id", c.id).eq("show_id", showId).is("batida_em", null);
  } else if (c.acao === "reabrir") {
    await db().from("dash_metas").update({ batida_em: null }).eq("id", c.id).eq("show_id", showId);
  } else {
    return erro(400, "ação desconhecida");
  }
  return ok({ metas: await listar(showId) });
}
