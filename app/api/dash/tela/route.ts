import { metaDaLinha, sorteioDaLinha, type RespostaTela } from "@/lib/dash/api";
import {
  concorrendo,
  marcos,
  nomeDaFonte,
  participantesDeContagem,
  pontosDaLive,
  progressoMeta,
  rankingCompradores,
  tipoDeMeta,
  totalDaFonte,
  type RegraSorteio,
} from "@/lib/dash/calculos";
import { vendaDaLinha, type LiveInfo } from "@/lib/dash/api";
import { contagemDaFonte, contaDaChave, db, erro, liveAtual, ok, totaisDaLive, ultimoRanking } from "@/lib/dash/servidor";

// A tela limpa para o OBS (fonte "Navegador"). Abre sem login: a chave da
// conta vai no link (?k=...). Mostra a live atual da conta, ou a de ?show=.
// Só sai daqui o que já aparece na própria live: @, foto, contagens.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const config = await contaDaChave(u.searchParams.get("k"));
  if (!config) return erro(401, "link da tela inválido");
  const conta = config.conta;

  const pedida = u.searchParams.get("show");
  let live = pedida
    ? ((await db().from("dash_lives").select("*").eq("show_id", pedida).eq("conta", conta).maybeSingle()).data as Awaited<ReturnType<typeof liveAtual>>)
    : await liveAtual(conta);
  if (!live) live = null;

  const ranking = await ultimoRanking(conta);
  const vazio: RespostaTela = {
    conta,
    live: null,
    totais: { gemas: 0, carpas: 0, emocoes: 0, faturamento: 0, itens: 0, compradores: 0, pontosLive: 0 },
    ranking: ranking ? { posicao: ranking.posicao, pontos: ranking.pontos, acima: ranking.acima, ts: new Date(ranking.ts).getTime() } : null,
    sorteios: [],
    metas: [],
    topCarpas: [],
    topCompradores: [],
    agora: Date.now(),
  };
  if (!live) return ok(vazio);

  const showId = live.show_id;
  const [totais, sorteios, ganhadores, metas, carpas, vendas] = await Promise.all([
    totaisDaLive(showId, config.termos_carpa),
    db().from("dash_sorteios").select("*").eq("show_id", showId).eq("ativo", true).order("ordem").order("criado_em"),
    db().from("dash_ganhadores").select("*").eq("show_id", showId).order("ts"),
    db().from("dash_metas").select("*").eq("show_id", showId).eq("ativo", true).order("ordem").order("criado_em"),
    contagemDaFonte(showId, "carpas", config.termos_carpa),
    db().from("dash_vendas").select("comprador, foto, quantidade, total, cancelado, pago, ts, id, titulo, preco").eq("show_id", showId).limit(3000),
  ]);

  const regras = ranking?.regras ?? null;
  const t = {
    gemas: totais.gemas,
    carpas: totais.carpas,
    emocoes: totais.emocoes,
    faturamento: totais.total,
    itens: totais.itens,
    compradores: totais.compradores,
    pontosLive: pontosDaLive(totais.total, totais.gemas, regras),
    posicao: ranking?.posicao ?? null,
  };

  const listaSorteios = await Promise.all(
    (sorteios.data ?? []).map(async (linha) => {
      const s = sorteioDaLinha(linha, ganhadores.data ?? []);
      const contagem = s.fonte === "carpas" ? carpas : await contagemDaFonte(showId, s.fonte, config.termos_carpa);
      const regra: RegraSorteio = { fonte: s.fonte, peso: s.peso, repetir: s.repetir, excluirSuspeitos: s.excluirSuspeitos, excluir: s.excluir };
      const naoValidos = s.ganhadores.filter((g) => g.status !== "valido").map((g) => g.handle);
      const validos = s.ganhadores.filter((g) => g.status === "valido");
      const lista = concorrendo(
        participantesDeContagem({ ...regra, excluir: [...regra.excluir, ...naoValidos] }, contagem, live!.vendedor, validos.map((g) => g.handle)),
      );
      const fonte = nomeDaFonte(s.fonte);
      const totalFonte = totalDaFonte(contagem);
      const { excluir: _fora, ...publico } = s;
      return {
        ...publico,
        unidade: fonte.unidade,
        nomeFonte: fonte.nome,
        totalFonte,
        marcos: s.modo === "meta" && s.aCada ? marcos(s.aCada, totalFonte, validos.length) : null,
        participantes: lista.slice(0, 60).map((p) => ({ handle: p.handle, nome: p.nome, foto: p.foto, bilhetes: p.bilhetes })),
        totalParticipantes: lista.length,
        totalBilhetes: lista.reduce((x, p) => x + p.bilhetes, 0),
      };
    }),
  );

  const resposta: RespostaTela = {
    ...vazio,
    live: {
      showId,
      titulo: live.titulo,
      vendedor: live.vendedor,
      aoVivo: live.ao_vivo,
      audiencia: live.audiencia,
      likes: live.likes,
      leilao: (live.leilao as LiveInfo["leilao"]) ?? null,
      batalha: (live.batalha as LiveInfo["batalha"]) ?? null,
    },
    totais: t,
    sorteios: listaSorteios,
    metas: await Promise.all(
      (metas.data ?? []).map(async (m) => {
        const meta = metaDaLinha(m);
        const base = { ...meta, ...progressoMeta(meta, t), unidade: tipoDeMeta(meta.tipo).unidade };
        if (meta.escopo !== "pessoa") return base;
        // Meta por pessoa: quem já chegou ao alvo e quem está mais perto.
        const porPessoa =
          meta.tipo === "faturamento"
            ? rankingCompradores((vendas.data ?? []).map(vendaDaLinha)).map((p) => ({ handle: p.handle, foto: p.foto, atual: p.total }))
            : (meta.tipo === "carpas" ? carpas : await contagemDaFonte(showId, meta.tipo === "itens" ? "compradores" : "gemas", config.termos_carpa)).map(
                (p) => ({ handle: p.handle, foto: p.foto, atual: p.n }),
              );
        const vendedor = (live!.vendedor ?? "").toLowerCase();
        const ordem = porPessoa.filter((p) => p.handle.toLowerCase() !== vendedor).sort((a, b) => b.atual - a.atual);
        return {
          ...base,
          bateram: ordem.filter((p) => p.atual >= meta.alvo).slice(0, 30),
          perto: ordem.filter((p) => p.atual < meta.alvo).slice(0, 5),
        };
      }),
    ),
    topCarpas: carpas
      .filter((p) => p.handle.toLowerCase() !== (live!.vendedor ?? "").toLowerCase())
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
      .map((p) => ({ handle: p.handle, nome: p.nome, foto: p.foto, n: p.n })),
    topCompradores: rankingCompradores((vendas.data ?? []).map(vendaDaLinha))
      .slice(0, 10)
      .map((p) => ({ handle: p.handle, foto: p.foto, itens: p.itens, total: p.total })),
  };
  return ok(resposta, { "access-control-allow-origin": "*" });
}
