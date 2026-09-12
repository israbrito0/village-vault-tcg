import { NextResponse } from "next/server";
import { lerLeilaoAtual, TEM_BANCO } from "@/lib/leilao-db";
import { leilaoDemo } from "@/lib/leilao-demo";

// Estado do leilão para a primeira carga da página. Depois disso, quem avisa de
// lance novo é o Realtime do Supabase.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!TEM_BANCO) {
    return NextResponse.json(
      { demo: true, ...leilaoDemo() },
      { headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const estado = await lerLeilaoAtual();
    return NextResponse.json({ demo: false, ...estado }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ erro: String((e as Error).message) }, { status: 500 });
  }
}
