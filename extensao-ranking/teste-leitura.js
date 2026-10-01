// Teste da leitura: rode com `node extensao-ranking/teste-leitura.js`.
// Roda o inject.js fora do Chrome, com um WebSocket de mentira,
// para conferir se ele reconhece vendas em payloads no estilo da Jamble.
const fs = require("fs");
const vm = require("vm");

const codigo = fs.readFileSync(
  require("path").join(__dirname, "inject.js"),
  "utf8",
);

const recebidos = [];
let falhas = 0;

// O gancho do inject.js guarda o fetch original assim que é instalado, então
// o original já precisa ser este despachante: o teste só troca o corpo.
let proximaResposta = "";
function respostaFalsa(corpo) {
  const r = { headers: { get: () => "application/json" }, clone: () => r, text: async () => corpo };
  return r;
}
let aoAbrir = null;

class WebSocketFake {
  constructor(url) {
    this.url = url;
    this.ouvintes = [];
    aoAbrir = this;
  }
  addEventListener(tipo, fn) {
    if (tipo === "message") this.ouvintes.push(fn);
  }
  emitir(texto) {
    for (const fn of this.ouvintes) fn({ data: texto });
  }
}

const janela = {
  addEventListener: () => {},
  postMessage: (msg) => recebidos.push(msg),
  WebSocket: WebSocketFake,
  fetch: async () => respostaFalsa(proximaResposta),
  XMLHttpRequest: function () {},
  location: { href: "https://www.jamble.com/live/abc123" },
};
janela.XMLHttpRequest.prototype = { open: function () {} };
janela.window = janela;

const contexto = vm.createContext(janela);
vm.runInContext(codigo, contexto);

// Payloads parecidos com os que uma live manda pelo WebSocket.
const casos = [
  {
    nome: "pedido com preço em centavos",
    texto: JSON.stringify({
      type: "order.created",
      payload: { id: "ord_1", buyer: { username: "mariah", displayName: "Maria" }, priceInCents: 12900 },
    }),
    espera: { handle: "mariah", centavos: 12900 },
  },
  {
    nome: "compra com total em reais",
    texto: JSON.stringify({
      event: "purchase",
      data: { orderId: "ord_2", user: { handle: "joaopedro" }, total: 79.9 },
    }),
    espera: { handle: "joaopedro", centavos: 7990 },
  },
  {
    nome: "texto de chat com R$",
    texto: JSON.stringify({
      type: "sale",
      sale: { id: "ord_3", customer: { nickname: "ana.tcg" }, amount: "R$ 1.250,00" },
    }),
    espera: { handle: "ana.tcg", centavos: 125000 },
  },
  {
    nome: "mensagem de chat comum (não deve virar venda)",
    texto: JSON.stringify({ type: "chat.message", message: { user: { username: "zé" }, text: "boa noite" } }),
    espera: null,
  },
];

janela.WebSocket("wss://live.jamble.com/socket");
const ws = new contexto.WebSocket("wss://live.jamble.com/socket");
for (const caso of casos) {
  recebidos.length = 0;
  aoAbrir.emitir(caso.texto);
  const vendas = recebidos.filter((m) => m.tipo === "venda").map((m) => m.dados);
  const candidatos = recebidos.filter((m) => m.tipo === "candidato");
  if (!caso.espera) {
    if (vendas.length !== 0) falhas++;
    console.log(`${vendas.length === 0 ? "OK  " : "FALHA"} ${caso.nome} (vendas: ${vendas.length}, dúvidas: ${candidatos.length})`);
    continue;
  }
  const achou = vendas.find((v) => v.handle === caso.espera.handle && v.centavos === caso.espera.centavos);
  if (!achou) falhas++;
  console.log(
    `${achou ? "OK  " : "FALHA"} ${caso.nome} -> ${vendas.map((v) => v.handle + ":" + v.centavos).join(", ") || "nada"}`,
  );
}

// ---------- participação e tabela de preços (o que o painel da live usa) ----------
// Caminho de verdade: a página pede, o gancho do fetch lê a resposta.

const conferir = (ok, nome, detalhe = "") => {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
};

async function pedir(url, corpo) {
  recebidos.length = 0;
  proximaResposta = corpo;
  await contexto.fetch(url);
  await new Promise((r) => setImmediate(r));
  return recebidos;
}

(async () => {
  // 1) tabela de preços, no formato exato que a Jamble devolve
  const tabela = await pedir(
    "https://www.jamble.com/api/live/emojis",
    JSON.stringify({
      success: true,
      emojis: [
        { id: "pixel_heart", name: "Coração Pixel", gemPrice: 10 },
        { id: "magikarp_shiny", name: "Carpa Zika", gemPrice: 500 },
      ],
    }),
  );
  const t = tabela.find((m) => m.tipo === "tabela-emocoes")?.dados?.tabela;
  conferir(t?.magikarp_shiny === 500 && t?.pixel_heart === 10, "tabela de preços lida de /api/live/emojis", JSON.stringify(t));

  // 2) participação, no formato exato da live de 30/09
  const part = await pedir(
    "https://www.jamble.com/api/seller/show-participation?show_id=2P5LgSdtPTmHDSMdXGKV",
    JSON.stringify({
      success: true,
      participation: {
        weights: { spent: 1, gems: 0.1, messages: 0 },
        isLive: true,
        rows: [
          { userId: "u1", rank: 1, score: 9580, spent: 9530, gems: 500, messages: 38, username: "fabiomeneguello", displayName: "fabio.meneguello" },
          { userId: "u2", rank: 2, score: 2473, spent: 5, gems: 24680, messages: 40, username: "jakolino", displayName: "jako" },
        ],
      },
    }),
  );
  const p = part.find((m) => m.tipo === "participacao")?.dados;
  conferir(p?.linhas?.length === 2, "participação lida de /api/seller/show-participation", `${p?.linhas?.length} linhas`);
  conferir(p?.aoVivo === true, "marca a live como ao vivo");
  conferir(
    p?.linhas?.[1]?.handle === "jakolino" && p?.linhas?.[1]?.gemas === 24680 && p?.linhas?.[1]?.pontos === 2473,
    "gemas e pontos de cada pessoa",
    JSON.stringify(p?.linhas?.[1]),
  );
  conferir(!part.some((m) => m.tipo === "venda"), "participação não vira venda no ranking do site");

  // 3) a extensão não tenta mais adivinhar emotion por ícone: a Jamble não
  //    manda isso por pessoa, e a tentativa dava falso positivo ("flash" da
  //    tabela de ícones casava com is_flash_sale_enabled dos leilões).
  const leilao = await pedir(
    "https://www.jamble.com/api/live/x",
    JSON.stringify({ sale: { settings: { is_flash_sale_enabled: false, type: "AUCTION" }, buyer: { username: "zé" } } }),
  );
  conferir(!leilao.some((m) => m.tipo === "emocao"), "não existe mais mensagem de emotion");
  conferir(!leilao.some((m) => m.tipo === "venda"), "leilão sem valor não vira venda");

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
