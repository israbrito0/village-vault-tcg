import { NextResponse } from "next/server";
import { aplicarEventos, estadoVazio, lerEstado, salvarEstado, topDe, type Evento } from "@/lib/ranking";

// Recebe as vendas que a extensão captura durante a live.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

function autorizado(req: Request) {
  const esperado = process.env.RANKING_TOKEN;
  if (!esperado) return false;
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return enviado.length > 0 && enviado === esperado;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "token inválido" }, { status: 401, headers: CORS });
  }

  let corpo: { liveId?: string; titulo?: string; eventos?: Evento[]; acao?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400, headers: CORS });
  }

  // Botões de manutenção da extensão.
  if (corpo.acao === "zerar-tudo") {
    await salvarEstado(estadoVazio());
    return NextResponse.json({ ok: true, zerado: "tudo" }, { headers: CORS });
  }

  const eventos = Array.isArray(corpo.eventos) ? corpo.eventos : [];
  if (eventos.length > 500) {
    return NextResponse.json({ erro: "máximo de 500 eventos por envio" }, { status: 400, headers: CORS });
  }

  const estado = await lerEstado();
  if (corpo.acao === "zerar-live") {
    estado.live = {
      id: corpo.liveId ?? "",
      titulo: corpo.titulo,
      inicio: Date.now(),
      atualizado: Date.now(),
      compradores: [],
    };
  }
  const { novos, repetidos } = aplicarEventos(estado, corpo.liveId ?? estado.live.id, corpo.titulo, eventos);
  await salvarEstado(estado);

  return NextResponse.json(
    {
      ok: true,
      novos,
      repetidos,
      compradoresNaLive: estado.live.compradores.length,
      top: topDe(estado.live.compradores, 5),
    },
    { headers: CORS },
  );
}
