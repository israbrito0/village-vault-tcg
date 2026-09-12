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
  fetch: async () => new Response(""),
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
    console.log(`${vendas.length === 0 ? "OK  " : "FALHA"} ${caso.nome} (vendas: ${vendas.length}, dúvidas: ${candidatos.length})`);
    continue;
  }
  const achou = vendas.find((v) => v.handle === caso.espera.handle && v.centavos === caso.espera.centavos);
  console.log(
    `${achou ? "OK  " : "FALHA"} ${caso.nome} -> ${vendas.map((v) => v.handle + ":" + v.centavos).join(", ") || "nada"}`,
  );
}
