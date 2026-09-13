// Lê data/estoque.csv, completa nome, coleção e imagem das cartas pelas bases
// públicas (TCGdex para Pokémon, Scryfall para Magic) e grava o catálogo final
// em lib/generated/catalogo.json, que o site usa.
//
// Roda sozinho antes de `npm run dev` e `npm run build`. As cartas já
// encontradas ficam guardadas em .next/cache, então se uma base sair do ar o
// site continua com as imagens da última vez.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ESTOQUE = join(ROOT, "data", "estoque.csv");
const SAIDA = join(ROOT, "lib", "generated", "catalogo.json");
const CACHE = join(ROOT, ".next", "cache", "village-cartas.json");

// Manter igual a lib/types.ts.
const GAMES = {
  pokemon: ["pokemon", "pokemontcg", "pkm"],
  magic: ["magic", "magicthegathering", "mtg"],
  yugioh: ["yugioh", "ygo"],
  "one-piece": ["onepiece", "op"],
  lorcana: ["lorcana", "disneylorcana"],
  outros: ["outros", "outrostcgs", "outro"],
};
const SUBCATEGORIES = {
  "cartas-avulsas": ["cartasavulsas", "cartaavulsa", "avulsa", "avulsas", "carta"],
  "cartas-graduadas": ["cartasgraduadas", "cartagraduada", "graduada", "graduadas"],
  "produtos-selados": ["produtosselados", "produtoselado", "selado", "selados"],
  colecionaveis: ["colecionaveis", "colecionavel", "acessorios", "acessorio"],
  "produtos-antigos-raros": ["produtosantigoseraros", "antigoseraros", "antigos", "raros", "raro"],
  "codigos-digitais": ["codigosdigitais", "codigodigital", "digital", "codigos"],
};
const CONDITIONS = { nm: "NM", sp: "SP", mp: "MP", hp: "HP", novo: "Novo", lacrado: "Novo", graduada: "Graduada" };
const ORIGINS = {
  br: "BR", pt: "BR", portugues: "BR", nacional: "BR",
  us: "US", en: "US", ingles: "US", importado: "US",
  jp: "JP", ja: "JP", japones: "JP",
};
const CONDITION_LABELS = {
  NM: "NM (Near Mint)", SP: "SP (Slightly Played)", MP: "MP (Moderately Played)",
  HP: "HP (Heavily Played)", Graduada: "graduada", Novo: "nova",
};
const LANGUAGE_LABELS = { BR: "em português", US: "em inglês", JP: "em japonês" };

const avisos = [];
const aviso = (msg) => avisos.push(msg);

// ---------- utilidades ----------

function semAcento(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function chave(text) {
  return semAcento(String(text ?? "")).toLowerCase().replace(/[^a-z0-9]/g, "");
}
function slugify(text) {
  return semAcento(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function findAlias(table, value) {
  const k = chave(value);
  if (!k) return undefined;
  return Object.keys(table).find((slug) => chave(slug) === k || table[slug].includes(k));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "350,00", "R$ 1.200,50", "1200.5" ou "350" -> centavos
function parsePrice(value) {
  let v = String(value ?? "").replace(/R\$|\s/g, "");
  if (!v) return undefined;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
}

// CSV com ";" (padrão do Excel em português) ou ",", aceitando aspas.
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const header = text.split(/\r?\n/, 1)[0];
  const sep = (header.match(/;/g) || []).length >= (header.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function getJson(url, headers = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
    } catch {
      // tenta de novo abaixo
    }
    await sleep(800 * attempt);
  }
  throw new Error(`sem resposta de ${new URL(url).host}`);
}

async function exists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch {
    return false;
  }
}

function sameNumber(a, b) {
  const na = String(a).trim(), nb = String(b).trim();
  if (/^\d+$/.test(na) && /^\d+$/.test(nb)) return Number(na) === Number(nb);
  return na.toLowerCase() === nb.toLowerCase();
}

// "DAA 20", "DAA 020", "DAA 20/189" -> ["DAA", "20"]
function splitCode(code) {
  return code.trim().split(/[\s/]+/).filter(Boolean);
}

// ---------- Pokémon (TCGdex) ----------

const TCGDEX = "https://api.tcgdex.net/v2";
const setDetails = new Map();

async function pokemonSetId(abbr, cache) {
  const key = abbr.toUpperCase();
  if (cache.pokemonSets[key]) return cache.pokemonSets[key];
  const sets = await getJson(`${TCGDEX}/en/sets?abbreviation.official=eq:${encodeURIComponent(key)}`);
  const id = sets?.[0]?.id;
  if (id) cache.pokemonSets[key] = id;
  return id;
}

async function pokemonSet(lang, setId) {
  const key = `${lang}/${setId}`;
  if (!setDetails.has(key)) setDetails.set(key, await getJson(`${TCGDEX}/${lang}/sets/${encodeURIComponent(setId)}`));
  return setDetails.get(key);
}

async function resolvePokemon(code, origin, cache) {
  const parts = splitCode(code);
  let setId, number;
  if (parts.length === 1 && parts[0].includes("-")) {
    // Id do TCGdex direto, ex.: sv03.5-151
    const i = parts[0].lastIndexOf("-");
    setId = parts[0].slice(0, i);
    number = parts[0].slice(i + 1);
  } else if (parts.length >= 2) {
    setId = await pokemonSetId(parts[0], cache);
    number = parts[1];
  }
  if (!setId || !number) return null;

  const find = async (lang) => {
    const set = await pokemonSet(lang, setId);
    const card = set?.cards?.find((c) => sameNumber(c.localId, number));
    return card ? { set, card } : null;
  };

  const english = await find("en");
  const local = origin === "BR" ? (await find("pt")) ?? english : english;
  if (!local) return null;

  // A base nem sempre tem a imagem em português; nesse caso usa a em inglês.
  let image;
  for (const base of [local.card.image, english?.card.image]) {
    if (base && (await exists(`${base}/high.webp`))) {
      image = `${base}/high.webp`;
      break;
    }
  }
  return { name: local.card.name, setName: local.set.name, image };
}

// ---------- Magic (Scryfall) ----------

const SCRYFALL_HEADERS = { "User-Agent": "VillageVaultTCG/1.0", Accept: "application/json" };

async function scryfall(path) {
  await sleep(120); // a Scryfall pede no máximo ~10 chamadas por segundo
  return getJson(`https://api.scryfall.com${path}`, SCRYFALL_HEADERS);
}

function scryfallImage(card) {
  if (!card || card.image_status === "missing" || card.image_status === "placeholder") return undefined;
  return card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large;
}

async function resolveMagic(code, origin) {
  const [set, number] = splitCode(code);
  if (!set || !number) return null;
  const path = `/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(number)}`;

  const english = await scryfall(path);
  const local = origin === "BR" ? (await scryfall(`${path}/pt`)) ?? english : english;
  if (!local) return null;

  const faces = local.card_faces?.map((f) => f.printed_name ?? f.name);
  const name = local.printed_name ?? (faces && local.lang !== "en" ? faces.join(" // ") : local.name);
  return { name, setName: local.set_name, image: scryfallImage(local) ?? scryfallImage(english) };
}

const RESOLVERS = { pokemon: resolvePokemon, magic: resolveMagic };

// ---------- principal ----------

function loadCache() {
  try {
    const data = JSON.parse(readFileSync(CACHE, "utf8"));
    return { pokemonSets: data.pokemonSets ?? {}, cards: data.cards ?? {} };
  } catch {
    return { pokemonSets: {}, cards: {} };
  }
}

function readRows() {
  if (!existsSync(ESTOQUE)) throw new Error(`Não encontrei ${ESTOQUE}`);
  const [header, ...lines] = parseCsv(readFileSync(ESTOQUE, "utf8"));
  const columns = header.map((h) => chave(h));
  return lines
    .map((cells, i) => ({
      line: i + 2,
      ...Object.fromEntries(columns.map((c, j) => [c, (cells[j] ?? "").trim()])),
    }))
    .filter((row) => columns.some((c) => row[c]));
}

async function main() {
  const cache = loadCache();
  const products = [];
  const slugs = new Set();
  let fromDatabase = 0;

  for (const row of readRows()) {
    const where = `estoque.csv linha ${row.line}`;
    const game = findAlias(GAMES, row.jogo);
    if (!game) { aviso(`${where}: jogo "${row.jogo}" não reconhecido, linha ignorada`); continue; }

    const code = row.codigo;
    const subcategory = row.categoria
      ? findAlias(SUBCATEGORIES, row.categoria)
      : code ? "cartas-avulsas" : undefined;
    if (!subcategory) { aviso(`${where}: categoria "${row.categoria}" não reconhecida, linha ignorada`); continue; }

    const priceCents = parsePrice(row.preco);
    if (!priceCents) { aviso(`${where}: preço "${row.preco}" inválido, linha ignorada`); continue; }
    const compareAtPriceCents = parsePrice(row.precoantigo) || undefined;

    const stock = row.estoque === "" ? 1 : Number(row.estoque);
    if (!Number.isInteger(stock) || stock < 0) { aviso(`${where}: estoque "${row.estoque}" inválido, linha ignorada`); continue; }
    if (stock === 0) continue; // esgotado não aparece no site

    const condition = CONDITIONS[chave(row.condicao)] ?? (code ? "NM" : "Novo");
    if (row.condicao && !CONDITIONS[chave(row.condicao)]) aviso(`${where}: condição "${row.condicao}" não reconhecida, usando ${condition}`);
    const origin = ORIGINS[chave(row.origem)] ?? "BR";

    // Completa pela base de cartas o que não veio preenchido na planilha.
    let card = null;
    const resolve = RESOLVERS[game];
    if (code && resolve) {
      const cacheKey = `${game}|${origin}|${code.toUpperCase()}`;
      card = cache.cards[cacheKey] ?? null;
      if (!card) {
        try {
          card = await resolve(code, origin, cache);
          if (card?.image) cache.cards[cacheKey] = card;
          else if (card) aviso(`${where}: "${code}" encontrado, mas sem imagem na base`);
          else aviso(`${where}: código "${code}" não encontrado na base de ${game}`);
        } catch (err) {
          aviso(`${where}: não consegui consultar "${code}" (${err.message}); tenta de novo no próximo build`);
        }
      }
      if (card) fromDatabase++;
    }

    const name = row.nome || card?.name || code;
    if (!name) { aviso(`${where}: sem nome nem código, linha ignorada`); continue; }
    const setName = row.colecao || card?.setName || "";
    const image = row.imagem || card?.image || undefined;

    let slug = slugify([name, code !== name ? code : "", subcategory === "cartas-avulsas" ? condition : "", code ? origin : ""].filter(Boolean).join(" "));
    for (let n = 2; slugs.has(slug); n++) slug = `${slug.replace(/-\d+$/, "")}-${n}`;
    slugs.add(slug);

    // Peso e medidas já embalado (caixa, plástico bolha e durex), para o frete.
    const medidas = [row.pesog, row.larguracm, row.alturacm, row.comprimentocm];
    let shipping;
    if (medidas.every((m) => m)) {
      const [weightGrams, widthCm, heightCm, lengthCm] = medidas.map((m) => Number(m.replace(",", ".")));
      if ([weightGrams, widthCm, heightCm, lengthCm].every((m) => Number.isFinite(m) && m > 0)) {
        shipping = { weightGrams, widthCm, heightCm, lengthCm };
      } else aviso(`${where}: peso ou medidas inválidos, usando a embalagem padrão da categoria`);
    } else if (medidas.some((m) => m)) {
      aviso(`${where}: preencha peso_g, largura_cm, altura_cm e comprimento_cm juntos; usando a embalagem padrão da categoria`);
    }

    const description =
      row.descricao ||
      (code
        ? `Carta ${name}${setName ? ` da coleção ${setName}` : ""}, condição ${CONDITION_LABELS[condition]}, ${LANGUAGE_LABELS[origin]}.`
        : "");

    products.push({
      id: slug,
      slug,
      name,
      game,
      subcategory,
      setName,
      priceCents,
      ...(compareAtPriceCents && compareAtPriceCents > priceCents ? { compareAtPriceCents } : {}),
      condition,
      origin,
      stock,
      ...(/^(sim|s|x|1|true)$/i.test(row.destaque) ? { featured: true } : {}),
      ...(/^(sim|s|x|1|true)$/i.test(row.prevenda) ? { preorder: true } : {}),
      ...(row.graduacao ? { grade: row.graduacao } : {}),
      description,
      ...(image ? { image } : {}),
      ...(code ? { code } : {}),
      ...(shipping ? { shipping } : {}),
    });
  }

  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, JSON.stringify({ products }, null, 2));
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));

  console.log(`Catálogo: ${products.length} produtos (${fromDatabase} completados pela base de cartas).`);
  for (const msg of avisos) console.warn(`  aviso: ${msg}`);
}

main().catch((err) => {
  console.error(`Erro ao gerar o catálogo: ${err.message}`);
  process.exit(1);
});
