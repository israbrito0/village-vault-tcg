import { atualizarRankingJamble } from "@/lib/dash/jamble";
import { db, erro, membroDaRequisicao, ok, todas } from "@/lib/dash/servidor";

// O ranking de vendedores da Jamble inteira, por mês. Ao abrir o mês atual,
// se a última leitura tiver mais de 15 minutos, lê de novo antes.
//
// Junto com os pontos vai o vendido de verdade de cada vendedor no mês: a
// soma das listas de vendidos das lives dele (a função dash-jamble lê). Meses
// que a Jamble não guarda mais (o ranking só existe no mês corrente) aparecem
// só com o vendido, ordenados por ele.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VELHO_MS = 15 * 60 * 1000;
// O primeiro mês com vendidos lidos.
const PRIMEIRO_MES = "2026-09";

type Linha = Record<string, unknown>;

const mesDeHoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
const mesesDesde = (de: string, ate: string) => {
  const lista: string[] = [];
  let [a, m] = de.split("-").map(Number);
  for (let i = 0; i < 36; i++) {
    const s = `${a}-${String(m).padStart(2, "0")}`;
    lista.push(s);
    if (s >= ate) break;
    if (m === 12) {
      a += 1;
      m = 1;
    } else m += 1;
  }
  return lista.reverse();
};
// Começo do mês em Brasília (00:00 de lá = 03:00 UTC).
const comecoDoMes = (mes: string) => Date.parse(`${mes}-01T03:00:00Z`);

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
  const comPontos = new Set((meses ?? []).map((m) => String(m.mes)));
  const todosMeses = mesesDesde(PRIMEIRO_MES, [mesDeHoje(), ...comPontos].sort().at(-1)!);
  const mes = pedido && todosMeses.includes(pedido) ? pedido : ((meses?.[0]?.mes as string | undefined) ?? todosMeses[0]);
  const mesPontos = comPontos.has(mes) ? mes : null;
  const ultimoMes = meses?.[0]?.mes ? String(meses[0].mes) : null;

  const [pontos, vendidos, vendedores, estado, ultimoRanking] = await Promise.all([
    mesPontos
      ? todas<Linha>((a, b) =>
          db().from("dash_ranking_jamble").select("seller_id, posicao, handle, foto, pontos, recompensado").eq("mes", mesPontos).order("posicao").range(a, b) as never,
        )
      : Promise.resolve([] as Linha[]),
    todas<Linha>((a, b) => db().rpc("dash_jamble_vendido", { p_mes: mes }).range(a, b) as never),
    todas<Linha>((a, b) => db().from("dash_jamble_vendedores").select("seller_id, handle, perfil_lido_em, completo_desde").range(a, b) as never),
    db().from("dash_jamble_estado").select("ultimo_ciclo").eq("id", 1).maybeSingle(),
    // As fotos e o @ de quem só aparece pelo vendido (meses sem ranking).
    ultimoMes
      ? todas<Linha>((a, b) => db().from("dash_ranking_jamble").select("seller_id, handle, foto").eq("mes", ultimoMes).range(a, b) as never)
      : Promise.resolve([] as Linha[]),
  ]);

  const vendidoDe = new Map(vendidos.map((v) => [String(v.seller_id), v]));
  const vendedorDe = new Map(vendedores.map((v) => [String(v.seller_id), v]));
  const fotoDe = new Map(ultimoRanking.map((r) => [String(r.seller_id), r]));
  const inicioMes = comecoDoMes(mes);

  const montar = (id: string, base: { posicao: number; handle: string; foto: string | null; pontos: number | null; recompensado: boolean }) => {
    const v = vendidoDe.get(id);
    const p = vendedorDe.get(id);
    const lido = !!p?.perfil_lido_em;
    // O perfil só mostra as 20 lives mais recentes: se a mais antiga delas é
    // depois do começo do mês, as lives de antes não entraram na soma.
    const desde = p?.completo_desde ? Date.parse(String(p.completo_desde)) : null;
    return {
      id,
      ...base,
      vendido: v ? Number(v.vendido) || 0 : lido ? 0 : null,
      itens: v ? Number(v.itens) || 0 : 0,
      lives: v ? Number(v.lives) || 0 : 0,
      pendentes: v ? Number(v.pendentes) || 0 : 0,
      parcialDesde: desde && desde > inicioMes ? desde : null,
      lido,
    };
  };

  const lista = mesPontos
    ? pontos.map((l) =>
        montar(String(l.seller_id), {
          posicao: Number(l.posicao) || 0,
          handle: String(l.handle ?? ""),
          foto: (l.foto as string) ?? null,
          pontos: Number(l.pontos) || 0,
          recompensado: l.recompensado === true,
        }),
      )
    : // Mês que a Jamble não mostra mais: posições pela soma das vendas.
      vendidos
        .filter((v) => Number(v.vendido) > 0)
        .sort((a, b) => Number(b.vendido) - Number(a.vendido))
        .map((v, i) => {
          const id = String(v.seller_id);
          const r = fotoDe.get(id);
          return montar(id, {
            posicao: i + 1,
            handle: String(v.handle ?? r?.handle ?? vendedorDe.get(id)?.handle ?? ""),
            foto: (r?.foto as string) ?? null,
            pontos: null,
            recompensado: false,
          });
        });

  return ok({
    meses: todosMeses.map((m) => {
      const info = (meses ?? []).find((x) => x.mes === m);
      return { mes: m, total: info ? Number(info.total) || 0 : 0, atualizadoEm: info ? new Date(info.atualizado_em as string).getTime() : null, temPontos: !!info };
    }),
    mes,
    temPontos: !!mesPontos,
    conta: membro.conta,
    leitura: {
      vendedoresLidos: vendedores.filter((v) => v.perfil_lido_em).length,
      vendedores: ultimoRanking.length,
      livesPendentes: vendidos.reduce((s, v) => s + (Number(v.pendentes) || 0), 0),
      ultimaRodada: estado.data?.ultimo_ciclo ? new Date(String(estado.data.ultimo_ciclo)).getTime() : null,
    },
    lista,
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
