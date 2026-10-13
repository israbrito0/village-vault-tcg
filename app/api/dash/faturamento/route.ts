import { db, erro, membroDaRequisicao, ok, todas } from "@/lib/dash/servidor";

// Faturamento da Jamble inteira por mês, lido das listas de vendidos de cada
// live (vendas pagas, sem canceladas, no mês em que aconteceram, horário de
// Brasília). A função dash-jamble lê sem parar: lives no ar a cada 10 min e as
// que acabaram há menos de 4 dias a cada 3 h.
//   ?aba=vendedores   -> quanto cada vendedor faturou no mês
//   ?aba=compradores  -> quanto cada comprador gastou no mês, onde e com a conta
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIMEIRO_MES = "2026-09";
type Linha = Record<string, unknown>;

const mesDeHoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
const mesesAte = (ate: string) => {
  const lista: string[] = [];
  let [a, m] = PRIMEIRO_MES.split("-").map(Number);
  for (let i = 0; i < 36; i++) {
    const s = `${a}-${String(m).padStart(2, "0")}`;
    lista.push(s);
    if (s >= ate) break;
    [a, m] = m === 12 ? [a + 1, 1] : [a, m + 1];
  }
  return lista.reverse();
};
// 00:00 de Brasília do dia 1º (03:00 UTC).
const comecoDoMes = (mes: string) => Date.parse(`${mes}-01T03:00:00Z`);

export async function GET(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const u = new URL(req.url);
  const meses = mesesAte(mesDeHoje());
  const mes = meses.includes(u.searchParams.get("mes") ?? "") ? String(u.searchParams.get("mes")) : meses[0];
  const aba = u.searchParams.get("aba") === "compradores" ? "compradores" : "vendedores";

  const [estado, rankingMes] = await Promise.all([
    db().from("dash_jamble_estado").select("ultimo_ciclo").eq("id", 1).maybeSingle(),
    db().from("dash_ranking_jamble_meses").select("mes").order("mes", { ascending: false }).limit(1),
  ]);
  const ultimoRanking = (rankingMes.data?.[0]?.mes as string | undefined) ?? null;
  const base = {
    meses,
    mes,
    aba,
    conta: membro.conta,
    atualizadoEm: estado.data?.ultimo_ciclo ? new Date(String(estado.data.ultimo_ciclo)).getTime() : null,
  };

  if (aba === "compradores") {
    const [compradores, pendentes] = await Promise.all([
      todas<Linha>((a, b) => db().rpc("dash_jamble_compradores", { p_mes: mes, p_conta: membro.conta, p_limite: 3000 }).range(a, b) as never),
      // Lives com venda cujos compradores ainda não foram gravados (a fila do coletor).
      db().from("dash_jamble_lives").select("show_id", { count: "exact", head: true }).eq("compras_lidas", false).or("vendas.gt.0,acabou.eq.false"),
    ]);
    const lista = compradores.map((c) => ({
      chave: String(c.chave),
      handle: String(c.username ?? "?"),
      foto: (c.foto as string) ?? null,
      total: Number(c.total) || 0,
      compras: Number(c.compras) || 0,
      itens: Number(c.itens) || 0,
      vendedores: Number(c.vendedores) || 0,
      lives: Number(c.lives) || 0,
      onde: (c.top_vendedor as string) ?? null,
      ondeValor: Number(c.top_valor) || 0,
      comigo: Number(c.comigo) || 0,
      ultima: c.ultima ? new Date(String(c.ultima)).getTime() : null,
    }));
    return ok({ ...base, livesFaltando: pendentes.count ?? 0, compradores: lista });
  }

  const [vendidos, vendedores, pontos, fotos, noAr] = await Promise.all([
    todas<Linha>((a, b) => db().rpc("dash_jamble_vendido", { p_mes: mes }).range(a, b) as never),
    todas<Linha>((a, b) => db().from("dash_jamble_vendedores").select("seller_id, completo_desde").range(a, b) as never),
    mes === ultimoRanking
      ? todas<Linha>((a, b) => db().from("dash_ranking_jamble").select("seller_id, posicao, pontos").eq("mes", mes).range(a, b) as never)
      : Promise.resolve([] as Linha[]),
    ultimoRanking
      ? todas<Linha>((a, b) => db().from("dash_ranking_jamble").select("seller_id, foto").eq("mes", ultimoRanking).range(a, b) as never)
      : Promise.resolve([] as Linha[]),
    todas<Linha>((a, b) => db().from("dash_jamble_lives").select("seller_id").eq("acabou", false).range(a, b) as never),
  ]);
  const desdeDe = new Map(vendedores.map((v) => [String(v.seller_id), v.completo_desde ? Date.parse(String(v.completo_desde)) : null]));
  const pontosDe = new Map(pontos.map((p) => [String(p.seller_id), p]));
  const fotoDe = new Map(fotos.map((f) => [String(f.seller_id), (f.foto as string) ?? null]));
  const noArDe = new Set(noAr.map((l) => String(l.seller_id)));
  const inicio = comecoDoMes(mes);
  const lista = vendidos
    .filter((v) => Number(v.vendido) > 0)
    .map((v) => {
      const id = String(v.seller_id);
      const vendido = Number(v.vendido) || 0;
      const lives = Number(v.lives) || 0;
      const desde = desdeDe.get(id) ?? null;
      const p = pontosDe.get(id);
      return {
        id,
        handle: String(v.handle ?? ""),
        foto: fotoDe.get(id) ?? null,
        vendido,
        vendas: Number(v.vendas) || 0,
        itens: Number(v.itens) || 0,
        lives,
        porLive: lives ? vendido / lives : 0,
        posicaoPontos: p ? Number(p.posicao) || null : null,
        pontos: p ? Number(p.pontos) || null : null,
        // O perfil só mostra as 20 lives mais recentes: as de antes desta data não entraram.
        parcialDesde: desde && desde > inicio ? desde : null,
        noAr: noArDe.has(id),
        pendentes: Number(v.pendentes) || 0,
      };
    })
    .sort((a, b) => b.vendido - a.vendido);
  return ok({ ...base, temPontos: mes === ultimoRanking, total: lista.reduce((t, l) => t + l.vendido, 0), vendedores: lista });
}
