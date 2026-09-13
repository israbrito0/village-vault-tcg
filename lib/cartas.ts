// Busca de carta por código, para o cadastro do leilão. Fonte dos dados:
// TCGdex (nome em português, coleção, imagem e preço de Cardmarket/TCGplayer).
// A cotação do dia vem da AwesomeAPI. O preço em real é REFERÊNCIA: o mercado
// brasileiro costuma ser mais caro, por isso existe o fator e a sobrescrita
// manual no painel.

const TCGDEX = "https://api.tcgdex.net/v2/pt";
const CAMBIO = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL";

export type PrecoCarta = {
  cardmarketEur?: number;
  tcgplayerUsd?: number;
  referenciaBrl?: number;
  fonte?: "cardmarket" | "tcgplayer";
  atualizadoEm?: string;
};

export type Carta = {
  id: string;
  nome: string;
  numero: string;
  colecao: string;
  colecaoId: string;
  totalOficial?: number;
  raridade?: string;
  imagem: string;
  precos: PrecoCarta;
};

let cambioCache: { em: number; usd: number; eur: number } | null = null;

export async function cotacoes() {
  if (cambioCache && Date.now() - cambioCache.em < 30 * 60 * 1000) return cambioCache;
  try {
    const r = await fetch(CAMBIO, { cache: "no-store" });
    const j = (await r.json()) as Record<string, { bid: string }>;
    cambioCache = {
      em: Date.now(),
      usd: Number(j.USDBRL?.bid) || 0,
      eur: Number(j.EURBRL?.bid) || 0,
    };
  } catch {
    cambioCache = cambioCache ?? { em: Date.now(), usd: 0, eur: 0 };
  }
  return cambioCache;
}

type CartaBruta = {
  id: string;
  name: string;
  localId: string;
  rarity?: string;
  image?: string;
  set?: { id: string; name: string; cardCount?: { official?: number; total?: number } };
  pricing?: {
    cardmarket?: { unit: string; updated: string; avg?: number; trend?: number; avg7?: number; avg30?: number };
    tcgplayer?: Record<string, { marketPrice?: number; midPrice?: number; lowPrice?: number } | string>;
  };
};

function precoTcgplayer(pricing: CartaBruta["pricing"]): number | undefined {
  const tp = pricing?.tcgplayer;
  if (!tp) return undefined;
  for (const [chave, valor] of Object.entries(tp)) {
    if (chave === "unit" || chave === "updated" || typeof valor === "string") continue;
    const preco = valor.marketPrice ?? valor.midPrice ?? valor.lowPrice;
    if (typeof preco === "number" && preco > 0) return preco;
  }
  return undefined;
}

async function montar(bruta: CartaBruta, fator: number): Promise<Carta> {
  const cm = bruta.pricing?.cardmarket;
  // avg7 é mais estável que a média geral; trend é o que o Cardmarket sugere.
  const eur = cm?.avg7 ?? cm?.trend ?? cm?.avg;
  const usd = precoTcgplayer(bruta.pricing);
  const { usd: usdBrl, eur: eurBrl } = await cotacoes();

  let referenciaBrl: number | undefined;
  let fonte: PrecoCarta["fonte"] | undefined;
  if (eur && eurBrl) {
    referenciaBrl = eur * eurBrl * fator;
    fonte = "cardmarket";
  } else if (usd && usdBrl) {
    referenciaBrl = usd * usdBrl * fator;
    fonte = "tcgplayer";
  }

  return {
    id: bruta.id,
    nome: bruta.name,
    numero: bruta.localId,
    colecao: bruta.set?.name ?? "",
    colecaoId: bruta.set?.id ?? "",
    totalOficial: bruta.set?.cardCount?.official,
    raridade: bruta.rarity,
    imagem: bruta.image ? `${bruta.image}/high.webp` : "",
    precos: {
      cardmarketEur: eur,
      tcgplayerUsd: usd,
      referenciaBrl: referenciaBrl ? Math.round(referenciaBrl * 100) / 100 : undefined,
      fonte,
      atualizadoEm: cm?.updated ?? (bruta.pricing?.tcgplayer?.updated as string | undefined),
    },
  };
}

async function detalhe(id: string): Promise<CartaBruta | null> {
  try {
    const r = await fetch(`${TCGDEX}/cards/${encodeURIComponent(id)}`, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    return (await r.json()) as CartaBruta;
  } catch {
    return null;
  }
}

async function porNumero(numero: string): Promise<{ id: string }[]> {
  try {
    const r = await fetch(`${TCGDEX}/cards?localId=${encodeURIComponent(numero)}`, { next: { revalidate: 3600 } });
    if (!r.ok) return [];
    return (await r.json()) as { id: string }[];
  } catch {
    return [];
  }
}

async function porNome(nome: string): Promise<{ id: string }[]> {
  try {
    const r = await fetch(`${TCGDEX}/cards?name=like:${encodeURIComponent(nome)}`, { next: { revalidate: 3600 } });
    if (!r.ok) return [];
    return ((await r.json()) as { id: string }[]).slice(0, 8);
  } catch {
    return [];
  }
}

// Aceita: "sv04.5-232" (id), "232/091" (número da carta e total da coleção),
// "232" (só o número) ou o nome da carta.
export async function buscarCarta(codigo: string, fator = 1): Promise<Carta[]> {
  const texto = codigo.trim();
  if (!texto) return [];

  // Formato id da TCGdex.
  if (/^[a-z0-9.]+-[a-zA-Z0-9]+$/i.test(texto) && texto.includes("-")) {
    const c = await detalhe(texto);
    return c ? [await montar(c, fator)] : [];
  }

  const comBarra = texto.match(/^(\d+)\s*\/\s*(\d+)$/);
  const soNumero = texto.match(/^(\d+)$/);

  if (comBarra || soNumero) {
    const numero = (comBarra ?? soNumero)![1];
    const total = comBarra ? Number(comBarra[2]) : null;
    const candidatos = await porNumero(numero);
    const detalhes = await Promise.all(candidatos.slice(0, 25).map((c) => detalhe(c.id)));
    const achadas = detalhes.filter(Boolean) as CartaBruta[];
    const filtradas = total ? achadas.filter((c) => c.set?.cardCount?.official === total) : achadas;
    const escolhidas = (filtradas.length ? filtradas : achadas).slice(0, 8);
    return Promise.all(escolhidas.map((c) => montar(c, fator)));
  }

  const porTexto = await porNome(texto);
  const detalhes = await Promise.all(porTexto.map((c) => detalhe(c.id)));
  return Promise.all((detalhes.filter(Boolean) as CartaBruta[]).map((c) => montar(c, fator)));
}
