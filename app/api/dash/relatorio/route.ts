import { descreverRegra, lerTermos, regraDoSorteio } from "@/lib/dash/calculos";
import type { EmocaoSomada, EntradaRelatorio, GanhadorDoRelatorio, LiveDoRelatorio, VendaDoRelatorio } from "@/lib/dash/relatorio";
import { acessoALive, configDaConta, db, erro, membroDaRequisicao, ok, periodo, todas } from "@/lib/dash/servidor";

// Os dados dos relatórios em PDF (o desenho é feito no navegador):
//   ?show=<id>            -> Relatório da live
//   ?de=&ate=[&q=filtro]  -> Relatório do período (as lives da lista de
//                            "Lives & Relatórios", com o mesmo filtro)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Linha = Record<string, unknown>;
const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : null);

async function montar(conta: string, lives: LiveDoRelatorio[], tipo: EntradaRelatorio["tipo"], termos: string): Promise<EntradaRelatorio> {
  const ids = lives.map((l) => l.showId);
  if (!ids.length) return { tipo, conta, lives, vendas: [], emocoes: [], ganhadores: [], icones: {} };
  const vendedorDe = new Map(lives.map((l) => [l.showId, l.vendedor]));
  const [vendas, emocoes, ganhadores, icones] = await Promise.all([
    todas<Linha>((a, b) => db().from("dash_vendas").select("*").in("show_id", ids).order("ts").range(a, b) as never),
    todas<Linha>((a, b) => db().rpc("dash_emocoes_somadas", { p_shows: ids }).range(a, b) as never),
    todas<Linha>((a, b) => db().from("dash_ganhadores").select("*").in("show_id", ids).order("ts").range(a, b) as never),
    db().from("dash_icones").select("id, url, nome"),
  ]);
  const sorteioIds = [...new Set(ganhadores.map((g) => String(g.sorteio_id)))];
  const { data: sorteios } = sorteioIds.length
    ? await db().from("dash_sorteios").select("*").in("id", sorteioIds)
    : { data: [] as Linha[] };
  const sorteioDe = new Map((sorteios ?? []).map((s) => [String(s.id), s as Linha]));
  const lista = lerTermos(termos);

  return {
    tipo,
    conta,
    lives,
    vendas: vendas.map(
      (v): VendaDoRelatorio => ({
        id: String(v.id),
        showId: String(v.show_id),
        titulo: (v.titulo as string) ?? "",
        imagem: (v.imagem as string) ?? null,
        comprador: (v.comprador as string) ?? null,
        foto: null,
        preco: Number(v.preco) || 0,
        quantidade: Number(v.quantidade) || 1,
        total: Number(v.total) || 0,
        tipo: (v.tipo as string) ?? null,
        pago: typeof v.pago === "boolean" ? v.pago : null,
        cancelado: v.cancelado === true,
        ts: ms(v.ts) ?? 0,
      }),
    ),
    emocoes: emocoes.map((e): EmocaoSomada => ({ handle: String(e.handle ?? ""), icone: String(e.icone ?? ""), qtd: Number(e.qtd) || 0, gemas: Number(e.gemas) || 0 })),
    ganhadores: ganhadores.map((g): GanhadorDoRelatorio => {
      const s = sorteioDe.get(String(g.sorteio_id));
      const regra = s
        ? String(s.nome ?? "").trim() ||
          descreverRegra(
            regraDoSorteio(
              {
                regra: s.regra as never,
                fonte: s.fonte as string,
                peso: s.peso as string,
                repetir: s.repetir as boolean,
                excluirSuspeitos: s.excluir_suspeitos as boolean,
                excluir: (s.excluir as string[]) ?? [],
                modo: s.modo as string,
                aCada: s.a_cada as number | null,
              },
              lista,
            ),
          )
        : "";
      return {
        ts: ms(g.ts) ?? 0,
        vendedor: vendedorDe.get(String(g.show_id)) ?? null,
        regra,
        premio: (s?.premio as string) ?? null,
        handle: String(g.handle ?? ""),
        presente: typeof g.presente === "boolean" ? g.presente : null,
        status: String(g.status ?? "valido"),
      };
    }),
    icones: Object.fromEntries((icones.data ?? []).map((i) => [String(i.id), { url: (i.url as string) ?? null, nome: (i.nome as string) ?? null }])),
  };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const show = u.searchParams.get("show");

  if (show) {
    const acesso = await acessoALive(req, show);
    if (!acesso) return erro(404, "live não encontrada");
    // A chave do link da tela do OBS não abre o relatório (tem compradores e valores).
    if (!acesso.membro) return erro(401, "entre no Dash para ver o relatório");
    const l = acesso.live;
    const m = (l.metricas ?? {}) as Linha;
    const config = await configDaConta(acesso.conta);
    const live: LiveDoRelatorio = {
      showId: l.show_id,
      vendedor: l.vendedor,
      titulo: l.titulo,
      inicio: ms(l.inicio),
      fim: ms(l.fim),
      codigo: typeof m.codigo === "string" ? m.codigo : null,
      emocoes: 0,
    };
    const entrada = await montar(acesso.conta, [live], "live", config.termos_carpa);
    live.emocoes = entrada.emocoes.reduce((s, e) => s + e.qtd, 0);
    return ok(entrada);
  }

  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const p = periodo(u);
  const busca = (u.searchParams.get("q") ?? "").trim().replace(/^@/, "").toLowerCase();
  // ?minhas=1: só as lives da própria conta (sem as de outros vendedores que o
  // robô ou a extensão acompanharam), como a lista de "Lives & Relatórios".
  const minhas = u.searchParams.get("minhas") === "1";
  const linhas = await todas<Linha>((a, b) => db().rpc("dash_lives_resumo", { p_conta: membro.conta, p_de: p.de, p_ate: p.ate }).range(a, b) as never);
  const lives: LiveDoRelatorio[] = linhas
    .filter((l) => !minhas || String(l.vendedor ?? "").toLowerCase() === membro.conta.toLowerCase())
    .filter((l) => !busca || String(l.titulo ?? "").toLowerCase().includes(busca) || String(l.vendedor ?? "").toLowerCase().includes(busca))
    .map((l) => ({
      showId: String(l.show_id),
      vendedor: (l.vendedor as string) ?? null,
      titulo: (l.titulo as string) ?? null,
      inicio: ms(l.inicio),
      fim: null,
      codigo: null,
      emocoes: Number(l.emocoes) || 0,
    }));
  const config = await configDaConta(membro.conta);
  const entrada = await montar(membro.conta, lives, "periodo", config.termos_carpa);
  const de = Number(u.searchParams.get("de")) || 0;
  const ate = Number(u.searchParams.get("ate")) || Date.now();
  return ok({ ...entrada, periodo: { de, ate } });
}
