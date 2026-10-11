import { vendaDaLinha, type Cliente } from "@/lib/dash/api";
import { db, erro, membroDaRequisicao, ok, periodo, todas } from "@/lib/dash/servidor";

// Clientes da conta: quanto cada um comprou no período, pago e pendente.
// Com ?handle=, as compras daquele cliente, uma por uma.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  const u = new URL(req.url);
  const { de, ate } = periodo(u);

  const handle = u.searchParams.get("handle")?.replace(/^@/, "").trim();
  if (handle) {
    const linhas = await todas<Record<string, unknown>>((a, b) =>
      db()
        .from("dash_vendas")
        .select("*, dash_lives(titulo, inicio)")
        .eq("conta", membro.conta)
        .eq("vendedor", membro.conta)
        .eq("comprador", handle)
        .gte("ts", de)
        .lt("ts", ate)
        .order("ts", { ascending: false })
        .range(a, b) as never,
    );
    const compras = linhas.map((l) => {
      const live = (l.dash_lives as { titulo?: string; inicio?: string } | null) ?? null;
      return { ...vendaDaLinha(l), showId: String(l.show_id), live: live?.titulo ?? null };
    });
    return ok({ compras });
  }

  const linhas = await todas<Record<string, unknown>>((a, b) =>
    db().rpc("dash_clientes", { p_conta: membro.conta, p_de: de, p_ate: ate }).range(a, b) as never,
  );
  const clientes: Cliente[] = linhas.map((l) => ({
    comprador: String(l.comprador),
    foto: (l.foto as string) ?? null,
    total: Number(l.total) || 0,
    pago: Number(l.pago) || 0,
    pendente: Number(l.pendente) || 0,
    itens: Number(l.itens) || 0,
    compras: Number(l.compras) || 0,
    lives: Number(l.lives) || 0,
    primeira: new Date(String(l.primeira)).getTime(),
    ultima: new Date(String(l.ultima)).getTime(),
  }));
  return ok({ clientes });
}
