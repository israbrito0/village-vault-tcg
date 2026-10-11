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
import { lerTermos } from "@/lib/dash/calculos";
import { acessoALive, configDaConta, db, erro, ok, todas, ultimoRanking } from "@/lib/dash/servidor";

// Tudo de uma live para o painel e para as telas do OBS. Na primeira vez vem
// tudo; depois, a tela manda até onde já tem (e = emotions, c = chat,
// vs = assinatura das vendas) e só vem o que é novo.
// Entra o membro logado ou quem tem o link da tela (?k=), que só olha.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const iso = (v: string | null) => {
  const n = Number(v);
  return n > 0 ? new Date(n).toISOString() : null;
};

export async function GET(req: Request, { params }: { params: { showId: string } }) {
  const showId = decodeURIComponent(params.showId);
  const acesso = await acessoALive(req, showId);
  if (!acesso) return erro(401, "sem acesso a esta live");
  const { live: linha, conta, membro } = acesso;

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
    configDaConta(conta),
    ultimoRanking(conta),
    db().from("dash_sorteios").select("*").eq("show_id", showId).order("ordem").order("criado_em"),
    db().from("dash_ganhadores").select("*").eq("show_id", showId).order("ts"),
    db().from("dash_metas").select("*").eq("show_id", showId).order("ordem").order("criado_em"),
    db().from("dash_icones").select("id, url, nome, gemas").limit(500),
  ]);

  const live = liveDaLinha(linha);
  const termos = lerTermos(config.termos_carpa);
  const resposta: RespostaLive = {
    live,
    emocoes: emocoes.map(emocaoDaLinha),
    chat: chat.map(mensagemDaLinha),
    // Pela chave da tela vai só o que os sorteios por compra precisam (quem
    // comprou, quanto e se pagou): sem produto, foto nem preço unitário.
    vendas: vendas ? vendas.map(vendaDaLinha).map((v) => (membro ? v : { ...v, titulo: "", imagem: null, foto: null, preco: 0 })) : null,
    vendasSig,
    ranking: rankingDaLinha(ranking),
    sorteios: (sorteios.data ?? []).map((s) => sorteioDaLinha(s, ganhadores.data ?? [], termos)),
    metas: (metas.data ?? []).map(metaDaLinha),
    termos: config.termos_carpa,
    icones: Object.fromEntries((icones.data ?? []).map((i) => [i.id, { url: i.url, nome: i.nome, gemas: i.gemas }])),
    souVendedor: (live.vendedor ?? "").toLowerCase() === conta.toLowerCase(),
    podeEditar: !!membro,
    conta,
    agora: Date.now(),
  };
  return ok(resposta, membro ? undefined : { "access-control-allow-origin": "*" });
}
