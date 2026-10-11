import type { LiveResumo } from "@/lib/dash/api";
import { db, erro, membroDaRequisicao, ok, periodo, todas } from "@/lib/dash/servidor";

// Lives da conta num período (?de=&ate= em milissegundos), com o que cada uma
// vendeu, recebeu, os compradores, emotions e sorteios.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const { de, ate } = periodo(new URL(req.url));
  const linhas = await todas<Record<string, unknown>>((a, b) =>
    db().rpc("dash_lives_resumo", { p_conta: membro.conta, p_de: de, p_ate: ate }).range(a, b) as never,
  );
  const lives: LiveResumo[] = linhas.map((l) => ({
    showId: String(l.show_id),
    titulo: (l.titulo as string) ?? null,
    vendedor: (l.vendedor as string) ?? null,
    inicio: new Date(String(l.inicio)).getTime(),
    aoVivo: l.ao_vivo === true,
    total: Number(l.total) || 0,
    pago: Number(l.pago) || 0,
    itens: Number(l.itens) || 0,
    vendas: Number(l.vendas) || 0,
    compradores: Number(l.compradores) || 0,
    emocoes: Number(l.emocoes) || 0,
    gemas: Number(l.gemas) || 0,
    ganhadores: Number(l.ganhadores) || 0,
  }));
  return ok({ lives });
}
