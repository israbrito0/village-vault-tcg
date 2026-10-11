import {
  emocaoDaLinha,
  liveDaLinha,
  mensagemDaLinha,
  metaDaLinha,
  rankingDaLinha,
  sorteioDaLinha,
  vendaDaLinha,
  type RespostaLive,
} from "@/lib/dash/api";
import { configDaConta, db, erro, liveDoMembro, membroDaRequisicao, ok, todas, ultimoRanking } from "@/lib/dash/servidor";

// Tudo de uma live para o painel. Na primeira vez vem tudo; depois, o painel
// manda até onde já tem (e = emotions, c = chat, vs = assinatura das vendas)
// e só vem o que é novo.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const iso = (v: string | null) => {
  const n = Number(v);
  return n > 0 ? new Date(n).toISOString() : null;
};

export async function GET(req: Request, { params }: { params: { showId: string } }) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const showId = decodeURIComponent(params.showId);
  const linha = await liveDoMembro(showId, membro.conta);
  if (!linha) return erro(404, "essa live ainda não chegou pela extensão");

  const u = new URL(req.url);
  const desdeEmocao = iso(u.searchParams.get("e"));
  const desdeChat = iso(u.searchParams.get("c"));
  const sigAntiga = u.searchParams.get("vs") ?? "";

  // Assinatura das vendas: quantas e quando mudou a última. Se não mudou,
  // não manda a lista de novo.
  const [{ count }, { data: ultimaVenda }] = await Promise.all([
    db().from("dash_vendas").select("id", { count: "exact", head: true }).eq("show_id", showId),
    db().from("dash_vendas").select("atualizado_em").eq("show_id", showId).order("atualizado_em", { ascending: false }).limit(1),
  ]);
  const vendasSig = `${count ?? 0}:${ultimaVenda?.[0]?.atualizado_em ?? ""}`;

  const [emocoes, chat, vendas, config, ranking, sorteios, ganhadores, metas, icones] = await Promise.all([
    todas((de, ate) => {
      let q = db().from("dash_emocoes").select("id, handle, nome, foto, icone, gemas, time, ts").eq("show_id", showId);
      if (desdeEmocao) q = q.gte("ts", desdeEmocao);
      return q.order("ts", { ascending: true }).order("id").range(de, ate);
    }),
    todas((de, ate) => {
      let q = db().from("dash_chat").select("id, handle, nome, foto, texto, ts").eq("show_id", showId);
      if (desdeChat) q = q.gte("ts", desdeChat);
      return q.order("ts", { ascending: true }).order("id").range(de, ate);
    }),
    sigAntiga === vendasSig
      ? Promise.resolve(null)
      : todas((de, ate) => db().from("dash_vendas").select("*").eq("show_id", showId).order("ts", { ascending: true }).range(de, ate)),
    configDaConta(membro.conta),
    ultimoRanking(membro.conta),
    db().from("dash_sorteios").select("*").eq("show_id", showId).order("ordem").order("criado_em"),
    db().from("dash_ganhadores").select("*").eq("show_id", showId).order("ts"),
    db().from("dash_metas").select("*").eq("show_id", showId).order("ordem").order("criado_em"),
    db().from("dash_icones").select("id, url, nome, gemas").limit(500),
  ]);

  const live = liveDaLinha(linha);
  const resposta: RespostaLive = {
    live,
    emocoes: emocoes.map(emocaoDaLinha),
    chat: chat.map(mensagemDaLinha),
    vendas: vendas ? vendas.map(vendaDaLinha) : null,
    vendasSig,
    ranking: rankingDaLinha(ranking),
    sorteios: (sorteios.data ?? []).map((s) => sorteioDaLinha(s, ganhadores.data ?? [])),
    metas: (metas.data ?? []).map(metaDaLinha),
    termos: config.termos_carpa,
    icones: Object.fromEntries((icones.data ?? []).map((i) => [i.id, { url: i.url, nome: i.nome, gemas: i.gemas }])),
    souVendedor: (live.vendedor ?? "").toLowerCase() === membro.conta.toLowerCase(),
    conta: membro.conta,
    agora: Date.now(),
  };
  return ok(resposta);
}
