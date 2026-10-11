import { atualizarRankingJamble } from "@/lib/dash/jamble";
import { db, erro, membroDaRequisicao, ok, todas } from "@/lib/dash/servidor";

// O ranking de vendedores da Jamble inteira, por mês. Ao abrir o mês atual,
// se a última leitura tiver mais de 15 minutos, lê de novo antes.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VELHO_MS = 15 * 60 * 1000;

export async function GET(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const pedido = new URL(req.url).searchParams.get("mes");

  let { data: meses } = await db().from("dash_ranking_jamble_meses").select("*").order("mes", { ascending: false });
  const atual = meses?.[0];
  if (!atual || Date.now() - new Date(atual.atualizado_em as string).getTime() > VELHO_MS) {
    try {
      await atualizarRankingJamble();
      meses = (await db().from("dash_ranking_jamble_meses").select("*").order("mes", { ascending: false })).data;
    } catch {
      // Sem a Jamble agora: mostra a última leitura guardada.
    }
  }
  const mes = pedido && meses?.some((m) => m.mes === pedido) ? pedido : (meses?.[0]?.mes as string | undefined);
  if (!mes) return ok({ meses: [], mes: null, lista: [] });
  const lista = await todas<Record<string, unknown>>((a, b) =>
    db().from("dash_ranking_jamble").select("seller_id, posicao, handle, foto, pontos, recompensado").eq("mes", mes).order("posicao").range(a, b) as never,
  );
  return ok({
    meses: (meses ?? []).map((m) => ({ mes: m.mes, total: m.total, atualizadoEm: new Date(m.atualizado_em as string).getTime(), regras: m.regras })),
    mes,
    conta: membro.conta,
    lista: lista.map((l) => ({ id: l.seller_id, posicao: l.posicao, handle: l.handle, foto: l.foto, pontos: Number(l.pontos) || 0, recompensado: l.recompensado === true })),
  });
}

// "Atualizar agora" na tela.
export async function POST(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  try {
    return ok(await atualizarRankingJamble());
  } catch (e) {
    return erro(502, String((e as Error).message));
  }
}
