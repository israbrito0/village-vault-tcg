import { liveDaLinha, rankingDaLinha, type RespostaEu } from "@/lib/dash/api";
import { configDaConta, db, erro, liveAtual, membroDaRequisicao, ok, ultimoRanking } from "@/lib/dash/servidor";

// Quem está logado no painel, as preferências da conta, a live dela, as de
// outros vendedores que a extensão ou o robô estão acompanhando agora e se
// os dois estão ligados.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const config = await configDaConta(membro.conta);
  const [live, ranking, outras, robo, ativos] = await Promise.all([
    liveAtual(membro.conta),
    ultimoRanking(membro.conta),
    db()
      .from("dash_lives")
      .select("*")
      .eq("conta", membro.conta)
      .neq("vendedor", membro.conta)
      .gte("visto_em", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
      .order("visto_em", { ascending: false })
      .limit(8),
    db().from("dash_robo").select("ultimo_inicio, detalhes").eq("id", 1).maybeSingle(),
    db().from("dash_monitores").select("id", { count: "exact", head: true }).eq("conta", membro.conta).eq("ativo", true),
  ]);
  const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : null);
  // A próxima live da conta que o robô viu na Jamble (ainda não começou).
  const agendadaDa = (d: unknown, conta: string) => {
    const a = (d as { agendada?: Record<string, unknown> } | null)?.agendada;
    if (!a || a.conta !== conta || typeof a.showId !== "string") return null;
    return { showId: a.showId, titulo: (a.titulo as string) ?? null, inicio: ms(a.inicio), capa: (a.capa as string) ?? null };
  };
  const resposta: RespostaEu = {
    membro,
    config: { telaChave: config.tela_chave, termosCarpa: config.termos_carpa, preferencias: config.preferencias ?? {} },
    live: live ? liveDaLinha(live) : null,
    outras: (outras.data ?? []).map(liveDaLinha),
    ranking: rankingDaLinha(ranking),
    // A extensão marca quando mandou dados; o robô grava as lives também, então
    // a hora da última live vista não serve mais para saber se ela está ligada.
    extensaoVistaEm: ms(config.extensao_em),
    robo: { rodouEm: ms(robo.data?.ultimo_inicio), ativos: ativos.count ?? 0, agendada: agendadaDa(robo.data?.detalhes, membro.conta) },
  };
  return ok(resposta);
}

// Muda os termos da carpa dourada, as preferências ou gera outra chave para as
// telas do OBS (a antiga para de funcionar na hora).
export async function PATCH(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  if (membro.papel !== "dono") return erro(403, "só o dono muda as configurações");
  const corpo = (await req.json().catch(() => ({}))) as {
    termosCarpa?: string;
    preferencias?: Record<string, unknown>;
    novaChave?: boolean;
  };
  const atual = await configDaConta(membro.conta);
  const mudar: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (typeof corpo.termosCarpa === "string") mudar.termos_carpa = corpo.termosCarpa.slice(0, 300);
  if (corpo.preferencias && typeof corpo.preferencias === "object") {
    const junto = { ...(atual.preferencias ?? {}), ...corpo.preferencias };
    if (JSON.stringify(junto).length > 20000) return erro(400, "preferências grandes demais");
    mudar.preferencias = junto;
  }
  if (corpo.novaChave) {
    const b = new Uint8Array(18);
    crypto.getRandomValues(b);
    mudar.tela_chave = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  const { data, error } = await db()
    .from("dash_config")
    .update(mudar)
    .eq("conta", membro.conta)
    .select("tela_chave, termos_carpa, preferencias")
    .single();
  if (error || !data) return erro(500, "não consegui salvar");
  return ok({ telaChave: data.tela_chave, termosCarpa: data.termos_carpa, preferencias: data.preferencias });
}
