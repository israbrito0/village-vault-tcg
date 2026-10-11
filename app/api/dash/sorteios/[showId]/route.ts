import { emocaoDaLinha, mensagemDaLinha, sorteioDaLinha, vendaDaLinha, type Sorteio } from "@/lib/dash/api";
import {
  lerTermos,
  liberacoes,
  participantesDaRegra,
  pontosDaLive,
  regraPadrao,
  resumoVendas,
  sortear,
  totaisDaRegra,
  type Regra,
} from "@/lib/dash/calculos";
import { aleatorio, configDaConta, dadosDaLive, db, erro, liveDoMembro, membroDaRequisicao, ok, ultimoRanking } from "@/lib/dash/servidor";

// Sorteios e metas individuais de uma live: criar, editar, excluir, sortear,
// re-sortear (o ganhador não respondeu), marcar se estava na live e zerar.
// Quem sorteia é o servidor, com a live inteira e um número aleatório de
// verdade -- a tela só mostra a roleta parando nele.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Corpo = {
  acao?: string;
  id?: string;
  ganhadorId?: string;
  presente?: boolean | null;
  ids?: string[];
  nome?: string;
  premio?: string | null;
  ativo?: boolean;
  regra?: Partial<Regra>;
};

const num = (v: unknown) => (Number(v) > 0 ? Math.round(Number(v)) : null);

// Só passa o que a regra pode ter, com os tipos certos.
function limparRegra(r: Partial<Regra> | undefined): Regra | null {
  if (!r) return null;
  const base = regraPadrao(r.tipo === "individual" ? "individual" : "sorteio");
  const icones = Array.isArray(r.icones) ? r.icones.map(String).filter((i) => /^[a-z0-9_]{1,60}$/.test(i)).slice(0, 80) : null;
  const m = r.metas ?? {};
  return {
    ...base,
    quem: r.quem === "compra" || r.quem === "ambos" ? r.quem : "emocao",
    icones,
    liberacao: r.liberacao === "livre" ? "livre" : "metas",
    metas: m.metaDaLive
      ? { metaDaLive: true }
      : { emocoes: num(m.emocoes), pontos: num(m.pontos), itens: num(m.itens), reais: num(m.reais), ranking: num(m.ranking) },
    chance: r.chance === "pontos" || r.chance === "igual" ? r.chance : "quantidade",
    repetir: r.repetir !== false,
    excluirSuspeitos: r.excluirSuspeitos !== false,
    excluir: (Array.isArray(r.excluir) ? r.excluir : []).map((h) => String(h).replace(/^@/, "").trim().toLowerCase()).filter(Boolean).slice(0, 300),
    alvo: base.tipo === "individual" ? num(r.alvo) ?? 10 : undefined,
    unidade: base.tipo === "individual" ? (r.unidade === "pontos" ? "pontos" : "emocoes") : undefined,
  };
}

async function listar(showId: string, termos: string[]): Promise<Sorteio[]> {
  const [s, g] = await Promise.all([
    db().from("dash_sorteios").select("*").eq("show_id", showId).order("ordem").order("criado_em"),
    db().from("dash_ganhadores").select("*").eq("show_id", showId).order("ts"),
  ]);
  return (s.data ?? []).map((x) => sorteioDaLinha(x, g.data ?? [], termos));
}

export async function POST(req: Request, { params }: { params: { showId: string } }) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const showId = decodeURIComponent(params.showId);
  const live = await liveDoMembro(showId, membro.conta);
  if (!live) return erro(404, "live não encontrada");
  const c = (await req.json().catch(() => ({}))) as Corpo;
  const config = await configDaConta(membro.conta);
  const termos = lerTermos(config.termos_carpa);
  const lista = () => listar(showId, termos);

  if (c.acao === "criar") {
    const regra = limparRegra(c.regra);
    if (!regra) return erro(400, "faltou a regra");
    const { count } = await db().from("dash_sorteios").select("id", { count: "exact", head: true }).eq("show_id", showId);
    if ((count ?? 0) >= 30) return erro(400, "máximo de 30 sorteios por live");
    const { error } = await db()
      .from("dash_sorteios")
      .insert({
        show_id: showId,
        conta: membro.conta,
        nome: (c.nome ?? "").trim().slice(0, 80) || (regra.tipo === "individual" ? "Nova meta" : "Novo sorteio"),
        premio: c.premio?.trim() ? c.premio.trim().slice(0, 120) : null,
        fonte: regra.quem === "compra" ? "compradores" : "emocoes",
        regra,
        ativo: c.ativo !== false,
        ordem: count ?? 0,
      });
    if (error) return erro(500, "não consegui criar");
    return ok({ sorteios: await lista() });
  }

  if (c.acao === "presente" && c.ganhadorId) {
    await db().from("dash_ganhadores").update({ presente: typeof c.presente === "boolean" ? c.presente : null }).eq("id", c.ganhadorId).eq("show_id", showId);
    return ok({ sorteios: await lista() });
  }

  if (!c.id) return erro(400, "qual sorteio?");
  const { data: s } = await db().from("dash_sorteios").select("*").eq("id", c.id).eq("show_id", showId).maybeSingle();
  if (!s) return erro(404, "sorteio não encontrado");

  if (c.acao === "editar") {
    const mudar: Record<string, unknown> = {};
    if (typeof c.nome === "string") mudar.nome = c.nome.trim().slice(0, 80) || "Sorteio";
    if (c.premio !== undefined) mudar.premio = c.premio?.trim() ? c.premio.trim().slice(0, 120) : null;
    if (typeof c.ativo === "boolean") mudar.ativo = c.ativo;
    const regra = limparRegra(c.regra);
    if (regra) mudar.regra = regra;
    const { error } = await db().from("dash_sorteios").update(mudar).eq("id", c.id);
    if (error) return erro(500, "não consegui salvar");
    return ok({ sorteios: await lista() });
  }
  if (c.acao === "excluir") {
    await db().from("dash_sorteios").delete().eq("id", c.id);
    return ok({ sorteios: await lista() });
  }
  if (c.acao === "zerar") {
    await db().from("dash_ganhadores").delete().eq("sorteio_id", c.id);
    return ok({ sorteios: await lista() });
  }

  if (c.acao === "sortear" || c.acao === "resortear") {
    const sorteio = sorteioDaLinha(s, [], termos);
    const regra = sorteio.regra;
    if (regra.tipo === "individual") return erro(400, "meta individual não tem sorteio");
    const { data: ganhadores } = await db().from("dash_ganhadores").select("*").eq("sorteio_id", c.id).order("ts");
    const todos = ganhadores ?? [];
    let validos = todos.filter((g) => g.status === "valido");
    let marco: number | null = null;
    // Re-sortear: o ganhador (o último, ou o escolhido) não respondeu; a vaga
    // dele vai para outra pessoa.
    if (c.acao === "resortear") {
      const alvo = c.ganhadorId ? validos.find((g) => g.id === c.ganhadorId) : validos[validos.length - 1];
      if (!alvo) return erro(400, "ainda não tem ganhador para re-sortear");
      await db().from("dash_ganhadores").update({ status: "resorteado", presente: false }).eq("id", alvo.id);
      alvo.status = "resorteado";
      marco = (alvo.marco as number | null) ?? null;
      validos = validos.filter((g) => g.id !== alvo.id);
    }
    const fora = todos.filter((g) => g.status !== "valido").map((g) => g.handle as string);

    const bruto = await dadosDaLive(showId);
    const dados = { emocoes: bruto.emocoes.map(emocaoDaLinha), mensagens: bruto.chat.map(mensagemDaLinha), vendas: bruto.vendas.map(vendaDaLinha) };

    if (c.acao === "sortear" && regra.liberacao === "metas") {
      const ranking = await ultimoRanking(membro.conta);
      const metaDaLive = await metaDaLiveBatida(showId, dados, ranking);
      const lib = liberacoes(regra, totaisDaRegra(regra, dados, { regrasRanking: ranking?.regras, metaDaLiveBatida: metaDaLive }), validos.length);
      if (lib.disponiveis <= 0) return erro(409, lib.proximo ? `ainda não liberou: faltam ${Math.ceil(lib.proximo.falta)} ${lib.proximo.unidade}` : "ainda não liberou");
    }

    const participantes = participantesDaRegra({ ...regra, excluir: [...regra.excluir, ...fora] }, dados, live.vendedor, validos.map((g) => g.handle as string));
    const ganhador = sortear(participantes, aleatorio());
    if (!ganhador) return erro(409, "ninguém concorrendo ainda");
    const concorrendo = participantes.filter((p) => !p.fora);
    const totalBilhetes = concorrendo.reduce((t, p) => t + p.bilhetes, 0);
    const { data: novo, error } = await db()
      .from("dash_ganhadores")
      .insert({
        sorteio_id: c.id,
        show_id: showId,
        handle: ganhador.handle,
        foto: ganhador.foto,
        bilhetes: ganhador.bilhetes,
        total_bilhetes: totalBilhetes,
        participantes: concorrendo.length,
        marco: marco ?? validos.length + 1,
      })
      .select("*")
      .single();
    if (error || !novo) return erro(500, "não consegui gravar o ganhador");
    return ok({
      sorteios: await lista(),
      ganhador: { ...ganhador, id: novo.id },
      // Para a roleta: quem estava concorrendo (os de mais bilhetes primeiro).
      roleta: concorrendo.slice(0, 60).map((p) => ({ handle: p.handle, foto: p.foto, bilhetes: p.bilhetes })),
    });
  }

  return erro(400, "ação desconhecida");
}

// A meta da live ("X pontos de ranking mensal" ou "de emotions desta live").
async function metaDaLiveBatida(
  showId: string,
  dados: { emocoes: { gemas: number }[]; vendas: Parameters<typeof resumoVendas>[0] },
  ranking: Awaited<ReturnType<typeof ultimoRanking>>,
) {
  const { data } = await db().from("dash_metas").select("tipo, alvo").eq("show_id", showId).eq("escopo", "live").in("tipo", ["ranking", "emocoes"]).limit(1);
  const meta = data?.[0];
  if (!meta) return false;
  const gemas = dados.emocoes.reduce((t, e) => t + (e.gemas || 0), 0);
  if (meta.tipo === "emocoes") return gemas >= Number(meta.alvo);
  if (ranking?.pontos == null) return false;
  const depois = ranking.ts ? new Date(ranking.ts).getTime() : 0;
  const vendido = dados.vendas.filter((v) => !v.cancelado && v.ts > depois).reduce((t, v) => t + v.total, 0);
  const g = (dados.emocoes as { gemas: number; ts?: number }[]).filter((e) => (e.ts ?? 0) > depois).reduce((t, e) => t + e.gemas, 0);
  return ranking.pontos + pontosDaLive(vendido, g, ranking.regras) >= Number(meta.alvo);
}
