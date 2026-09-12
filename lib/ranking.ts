import { get, put } from "@vercel/blob";

// Ranking de compradores e histórico de faturamento das lives. O estado inteiro
// mora num único arquivo no Vercel Blob (store "ranking-live"): é pequeno e só
// a extensão escreve nele.
const CAMINHO = "ranking/estado.json";

// Quantos ids de pedido guardamos para não contar a mesma compra duas vezes.
const LIMITE_VISTOS = 8000;
// Minutos de faturamento guardados da live atual (para o gráfico ao vivo).
const LIMITE_MINUTOS = 720;

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
  live: {
    id: string;
    titulo?: string;
    inicio: number;
    atualizado: number;
    compradores: Comprador[];
    centavos: number;
    pedidos: number;
    minutos: Record<string, number>;
  };
  acumulado: {
    desde: number;
    atualizado: number;
    compradores: Comprador[];
    centavos: number;
    pedidos: number;
  };
  // Faturamento por dia, no fuso de São Paulo: { "2026-09-16": { centavos, pedidos } }.
  dias: Record<string, { centavos: number; pedidos: number }>;
  // Último "estou aqui" mandado pela extensão, para saber se ela está ligada.
  ping?: { em: number; origem?: string };
  vistos: string[];
};

const FUSO = "America/Sao_Paulo";

export function diaDe(ts: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

function minutoDe(ts: number) {
  return String(Math.floor(ts / 60000));
}

export function estadoVazio(): Estado {
  const agora = Date.now();
  return {
    live: { id: "", inicio: agora, atualizado: agora, compradores: [], centavos: 0, pedidos: 0, minutos: {} },
    acumulado: { desde: agora, atualizado: agora, compradores: [], centavos: 0, pedidos: 0 },
    dias: {},
    vistos: [],
  };
}

// Estados gravados antes das métricas não têm todos os campos; completa o que
// dá a partir dos compradores, para nada quebrar depois de uma atualização.
function completar(estado: Estado): Estado {
  const base = estadoVazio();
  const live = { ...base.live, ...(estado.live ?? {}) };
  const acumulado = { ...base.acumulado, ...(estado.acumulado ?? {}) };
  const soma = (lista: Comprador[]) => ({
    centavos: lista.reduce((t, c) => t + c.centavos, 0),
    pedidos: lista.reduce((t, c) => t + c.pedidos, 0),
  });
  if (!live.centavos) Object.assign(live, soma(live.compradores ?? []));
  if (!acumulado.centavos) Object.assign(acumulado, soma(acumulado.compradores ?? []));
  return {
    live: { ...live, compradores: live.compradores ?? [], minutos: live.minutos ?? {} },
    acumulado: { ...acumulado, compradores: acumulado.compradores ?? [] },
    dias: estado.dias ?? {},
    ping: estado.ping,
    vistos: estado.vistos ?? [],
  };
}

export async function lerEstado(): Promise<Estado> {
  try {
    // useCache: false porque a live muda de poucos em poucos segundos.
    const r = await get(CAMINHO, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return estadoVazio();
    const estado = JSON.parse(await new Response(r.stream).text()) as Estado;
    if (!estado?.live || !estado?.acumulado) return estadoVazio();
    return completar(estado);
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
    estado.live = {
      id: liveId,
      titulo,
      inicio: agora,
      atualizado: agora,
      compradores: [],
      centavos: 0,
      pedidos: 0,
      minutos: {},
    };
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
    const quando = ev.ts ?? agora;
    const limpo: Evento = { id, handle, nome: ev.nome, centavos, ts: quando };

    somar(estado.live.compradores, limpo);
    somar(estado.acumulado.compradores, limpo);
    estado.live.centavos += centavos;
    estado.live.pedidos += 1;
    estado.acumulado.centavos += centavos;
    estado.acumulado.pedidos += 1;

    const dia = diaDe(quando);
    const atualDia = estado.dias[dia] ?? { centavos: 0, pedidos: 0 };
    estado.dias[dia] = { centavos: atualDia.centavos + centavos, pedidos: atualDia.pedidos + 1 };

    const minuto = minutoDe(quando);
    estado.live.minutos[minuto] = (estado.live.minutos[minuto] ?? 0) + centavos;

    novos += 1;
  }

  estado.live.atualizado = agora;
  estado.acumulado.atualizado = agora;
  estado.vistos = [...vistos].slice(-LIMITE_VISTOS);

  const minutos = Object.entries(estado.live.minutos).sort((a, b) => Number(a[0]) - Number(b[0]));
  estado.live.minutos = Object.fromEntries(minutos.slice(-LIMITE_MINUTOS));

  return { novos, repetidos };
}

export function topDe(compradores: Comprador[], quantos = 30) {
  return [...compradores]
    .sort((a, b) => b.centavos - a.centavos || a.ultimo - b.ultimo)
    .slice(0, quantos);
}
