import { get, put } from "@vercel/blob";

// Ranking de compradores das lives. O estado inteiro mora num único arquivo no
// Vercel Blob (store "ranking-live"): é pequeno e só a extensão escreve nele.
const CAMINHO = "ranking/estado.json";

// Quantos ids de pedido guardamos para não contar a mesma compra duas vezes.
const LIMITE_VISTOS = 8000;

export type Comprador = {
  handle: string;
  nome?: string;
  centavos: number;
  pedidos: number;
  ultimo: number;
};

export type Evento = {
  id: string;
  handle: string;
  nome?: string;
  centavos: number;
  ts?: number;
};

export type Estado = {
  live: { id: string; titulo?: string; inicio: number; atualizado: number; compradores: Comprador[] };
  acumulado: { desde: number; atualizado: number; compradores: Comprador[] };
  vistos: string[];
};

export function estadoVazio(): Estado {
  const agora = Date.now();
  return {
    live: { id: "", inicio: agora, atualizado: agora, compradores: [] },
    acumulado: { desde: agora, atualizado: agora, compradores: [] },
    vistos: [],
  };
}

export async function lerEstado(): Promise<Estado> {
  try {
    // useCache: false porque a live muda de poucos em poucos segundos.
    const r = await get(CAMINHO, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return estadoVazio();
    const estado = JSON.parse(await new Response(r.stream).text()) as Estado;
    if (!estado?.live || !estado?.acumulado) return estadoVazio();
    estado.vistos = estado.vistos ?? [];
    return estado;
  } catch {
    // Arquivo ainda não existe (antes da primeira live) ou veio corrompido.
    return estadoVazio();
  }
}

export async function salvarEstado(estado: Estado) {
  await put(CAMINHO, JSON.stringify(estado), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

function somar(lista: Comprador[], ev: Evento) {
  const handle = ev.handle.trim().replace(/^@/, "").toLowerCase();
  const quando = ev.ts ?? Date.now();
  const atual = lista.find((c) => c.handle === handle);
  if (atual) {
    atual.centavos += ev.centavos;
    atual.pedidos += 1;
    atual.ultimo = Math.max(atual.ultimo, quando);
    if (ev.nome && !atual.nome) atual.nome = ev.nome;
    return;
  }
  lista.push({ handle, nome: ev.nome, centavos: ev.centavos, pedidos: 1, ultimo: quando });
}

// Junta os eventos novos no estado. A extensão reenvia os últimos eventos para
// não perder nada, então o id do pedido é o que evita contar duas vezes.
export function aplicarEventos(
  estado: Estado,
  liveId: string,
  titulo: string | undefined,
  eventos: Evento[],
) {
  const agora = Date.now();
  if (liveId && estado.live.id !== liveId) {
    estado.live = { id: liveId, titulo, inicio: agora, atualizado: agora, compradores: [] };
  }
  if (titulo && !estado.live.titulo) estado.live.titulo = titulo;

  const vistos = new Set(estado.vistos);
  let novos = 0;
  let repetidos = 0;

  for (const ev of eventos) {
    const id = String(ev.id ?? "").trim();
    const handle = String(ev.handle ?? "").trim();
    const centavos = Math.round(Number(ev.centavos));
    if (!id || !handle || !Number.isFinite(centavos) || centavos <= 0) continue;
    if (vistos.has(id)) {
      repetidos += 1;
      continue;
    }
    vistos.add(id);
    const limpo: Evento = { id, handle, nome: ev.nome, centavos, ts: ev.ts };
    somar(estado.live.compradores, limpo);
    somar(estado.acumulado.compradores, limpo);
    novos += 1;
  }

  estado.live.atualizado = agora;
  estado.acumulado.atualizado = agora;
  estado.vistos = [...vistos].slice(-LIMITE_VISTOS);
  return { novos, repetidos };
}

export function topDe(compradores: Comprador[], quantos = 30) {
  return [...compradores]
    .sort((a, b) => b.centavos - a.centavos || a.ultimo - b.ultimo)
    .slice(0, quantos);
}
