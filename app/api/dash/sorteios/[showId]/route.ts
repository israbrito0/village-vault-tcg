import { sorteioDaLinha, type Sorteio } from "@/lib/dash/api";
import { concorrendo, marcos, participantesDeContagem, sortear, totalDaFonte, type RegraSorteio } from "@/lib/dash/calculos";
import {
  aleatorio,
  configDaConta,
  contagemDaFonte,
  db,
  erro,
  liveDoMembro,
  membroDaRequisicao,
  ok,
} from "@/lib/dash/servidor";

// Sorteios de uma live: criar, editar, excluir, sortear, re-sortear, marcar
// ausente e zerar. Quem sorteia é o servidor, com a contagem do banco e um
// número aleatório de verdade -- a tela só mostra a roleta parando nele.
export const dynamic = "force-dynamic";

type Corpo = {
  acao?: string;
  id?: string;
  ganhadorId?: string;
  ids?: string[];
  nome?: string;
  premio?: string | null;
  fonte?: string;
  peso?: string;
  repetir?: boolean;
  excluirSuspeitos?: boolean;
  excluir?: string[];
  modo?: string;
  aCada?: number | null;
  ativo?: boolean;
};

const FONTE_OK = /^(compradores|emocoes|gemas|carpas|chat|emocao:[a-z0-9_]{1,60})$/;

function campos(c: Corpo) {
  const m: Record<string, unknown> = {};
  if (typeof c.nome === "string") m.nome = c.nome.trim().slice(0, 80) || "Sorteio";
  if (c.premio !== undefined) m.premio = typeof c.premio === "string" && c.premio.trim() ? c.premio.trim().slice(0, 120) : null;
  if (typeof c.fonte === "string" && FONTE_OK.test(c.fonte)) m.fonte = c.fonte;
  if (c.peso === "igual" || c.peso === "quantidade") m.peso = c.peso;
  if (typeof c.repetir === "boolean") m.repetir = c.repetir;
  if (typeof c.excluirSuspeitos === "boolean") m.excluir_suspeitos = c.excluirSuspeitos;
  if (Array.isArray(c.excluir)) {
    m.excluir = c.excluir.map((h) => String(h).replace(/^@/, "").trim().toLowerCase()).filter(Boolean).slice(0, 300);
  }
  if (c.modo === "livre" || c.modo === "meta") m.modo = c.modo;
  if (c.aCada !== undefined) m.a_cada = c.aCada && Number(c.aCada) > 0 ? Math.round(Number(c.aCada)) : null;
  if (typeof c.ativo === "boolean") m.ativo = c.ativo;
  return m;
}

async function listar(showId: string): Promise<Sorteio[]> {
  const [s, g] = await Promise.all([
    db().from("dash_sorteios").select("*").eq("show_id", showId).order("ordem").order("criado_em"),
    db().from("dash_ganhadores").select("*").eq("show_id", showId).order("ts"),
  ]);
  return (s.data ?? []).map((x) => sorteioDaLinha(x, g.data ?? []));
}

export async function POST(req: Request, { params }: { params: { showId: string } }) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const showId = decodeURIComponent(params.showId);
  const live = await liveDoMembro(showId, membro.conta);
  if (!live) return erro(404, "live não encontrada");
  const c = (await req.json().catch(() => ({}))) as Corpo;

  if (c.acao === "criar") {
    const m = campos(c);
    if (!m.fonte) return erro(400, "escolha de onde vêm os bilhetes");
    if (m.modo === "meta" && !m.a_cada) return erro(400, "diga a cada quanto libera um sorteio");
    const { count } = await db().from("dash_sorteios").select("id", { count: "exact", head: true }).eq("show_id", showId);
    if ((count ?? 0) >= 30) return erro(400, "máximo de 30 sorteios por live");
    const { error } = await db().from("dash_sorteios").insert({ ...m, nome: m.nome ?? "Sorteio", show_id: showId, conta: membro.conta, ordem: count ?? 0 });
    if (error) return erro(500, "não consegui criar");
    return ok({ sorteios: await listar(showId) });
  }

  if (c.acao === "ordem" && Array.isArray(c.ids)) {
    await Promise.all(c.ids.slice(0, 30).map((id, i) => db().from("dash_sorteios").update({ ordem: i }).eq("id", id).eq("show_id", showId)));
    return ok({ sorteios: await listar(showId) });
  }

  if (c.acao === "ausente" && c.ganhadorId) {
    await db().from("dash_ganhadores").update({ status: "ausente" }).eq("id", c.ganhadorId).eq("show_id", showId);
    return ok({ sorteios: await listar(showId) });
  }

  if (!c.id) return erro(400, "qual sorteio?");
  const { data: s } = await db().from("dash_sorteios").select("*").eq("id", c.id).eq("show_id", showId).maybeSingle();
  if (!s) return erro(404, "sorteio não encontrado");

  if (c.acao === "editar") {
    const m = campos(c);
    const { error } = await db().from("dash_sorteios").update(m).eq("id", c.id);
    if (error) return erro(500, "não consegui salvar");
    return ok({ sorteios: await listar(showId) });
  }
  if (c.acao === "excluir") {
    await db().from("dash_sorteios").delete().eq("id", c.id);
    return ok({ sorteios: await listar(showId) });
  }
  if (c.acao === "zerar") {
    await db().from("dash_ganhadores").delete().eq("sorteio_id", c.id);
    return ok({ sorteios: await listar(showId) });
  }

  if (c.acao === "sortear" || c.acao === "resortear") {
    const { data: ganhadores } = await db().from("dash_ganhadores").select("*").eq("sorteio_id", c.id).order("ts");
    const validos = (ganhadores ?? []).filter((g) => g.status === "valido");
    const fora: string[] = [];
    if (c.acao === "resortear") {
      const ultimo = validos[validos.length - 1];
      if (!ultimo) return erro(400, "ainda não tem ganhador para re-sortear");
      await db().from("dash_ganhadores").update({ status: "resorteado" }).eq("id", ultimo.id);
      validos.pop();
      fora.push(ultimo.handle as string);
    }
    // Quem não estava presente ou foi re-sorteado não volta para este sorteio.
    for (const g of ganhadores ?? []) if (g.status !== "valido") fora.push(g.handle as string);

    const config = await configDaConta(membro.conta);
    const contagem = await contagemDaFonte(showId, s.fonte as string, config.termos_carpa);
    const regra: RegraSorteio = {
      fonte: s.fonte as string,
      peso: s.peso === "igual" ? "igual" : "quantidade",
      repetir: s.repetir !== false,
      excluirSuspeitos: s.excluir_suspeitos !== false,
      excluir: [...((s.excluir as string[]) ?? []), ...fora],
    };
    const lista = participantesDeContagem(regra, contagem, live.vendedor, validos.map((g) => g.handle as string));

    if (s.modo === "meta" && s.a_cada && c.acao === "sortear") {
      const m = marcos(s.a_cada as number, totalDaFonte(contagem), validos.length);
      if (m.disponiveis <= 0) return erro(409, `ainda não liberou: faltam ${m.faltaParaProximo}`);
    }

    const ganhador = sortear(lista, aleatorio());
    if (!ganhador) return erro(409, "ninguém concorrendo ainda");
    const ok_ = concorrendo(lista);
    const totalBilhetes = ok_.reduce((t, p) => t + p.bilhetes, 0);
    const { data: novo, error } = await db()
      .from("dash_ganhadores")
      .insert({
        sorteio_id: c.id,
        show_id: showId,
        handle: ganhador.handle,
        foto: ganhador.foto,
        bilhetes: ganhador.bilhetes,
        total_bilhetes: totalBilhetes,
        participantes: ok_.length,
        marco: s.modo === "meta" ? validos.length + 1 : null,
      })
      .select("*")
      .single();
    if (error || !novo) return erro(500, "não consegui gravar o ganhador");
    return ok({
      sorteios: await listar(showId),
      ganhador: { ...ganhador, id: novo.id },
      // Para a roleta: quem estava concorrendo (os de mais bilhetes primeiro).
      roleta: ok_.slice(0, 60).map((p) => ({ handle: p.handle, foto: p.foto, bilhetes: p.bilhetes })),
    });
  }

  return erro(400, "ação desconhecida");
}
