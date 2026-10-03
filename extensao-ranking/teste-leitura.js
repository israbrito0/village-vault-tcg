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

  // ---------- eventos LIKE: quem mandou qual ícone ----------
  // Formato exato capturado numa live de verdade em 03/10/2026.
  const frameLike = (id, icone, gemas, username) =>
    JSON.stringify({
      data: {
        events: [
          {
            id,
            is_visible: true,
            event_type: "LIKE",
            created_at: 1791011816.703589,
            user_id: "u-abc",
            seller_id: "s-abc",
            show_id: "show-abc",
            targets: ["ALL"],
            icon: "live_like_purple_icon",
            like_icon_url: "https://jamble-test.b-cdn.net/like_icons/" + icone + ".png",
            like_icon_id: icone,
            like_icon_battle_entry_count: gemas,
            liker_profile: { id: "u-abc", username: username, display_name: "israel brito" },
          },
        ],
      },
    });

  recebidos.length = 0;
  aoAbrir.emitir(frameLike("RcdoiFnpQQV43WNtUZ58", "charmander", 60, "israelbrito"));
  const emo = recebidos.filter((m) => m.tipo === "emocao").map((m) => m.dados);
  conferir(emo.length === 1, "evento LIKE vira uma emotion", JSON.stringify(emo));
  conferir(emo[0] && emo[0].icone === "charmander", "pega o ícone", emo[0] && emo[0].icone);
  conferir(emo[0] && emo[0].gemas === 60, "pega o valor em gemas", String(emo[0] && emo[0].gemas));
  conferir(emo[0] && emo[0].handle === "israelbrito", "pega quem mandou", emo[0] && emo[0].handle);
  conferir(emo[0] && emo[0].nome === "israel brito", "e o nome de exibição");
  conferir(
    emo[0] && emo[0].ts === Math.round(1791011816.703589 * 1000),
    "usa a hora do envio, não a da leitura",
  );

  // O mesmo evento chega repetido no WebSocket: não pode contar duas vezes.
  recebidos.length = 0;
  aoAbrir.emitir(frameLike("RcdoiFnpQQV43WNtUZ58", "charmander", 60, "israelbrito"));
  conferir(recebidos.filter((m) => m.tipo === "emocao").length === 0, "evento repetido é ignorado");

  // Outro id, mesmo ícone: é um envio novo e conta.
  recebidos.length = 0;
  aoAbrir.emitir(frameLike("OUTRO-ID-9", "magikarp_shiny", 500, "jako"));
  const emo2 = recebidos.filter((m) => m.tipo === "emocao").map((m) => m.dados);
  conferir(emo2.length === 1 && emo2[0].icone === "magikarp_shiny" && emo2[0].gemas === 500, "envio novo conta");

  // Evento de outro tipo no mesmo canal não vira emotion.
  recebidos.length = 0;
  aoAbrir.emitir(JSON.stringify({ data: { events: [{ id: "z9", event_type: "JOIN", liker_profile: { username: "x" } }] } }));
  conferir(recebidos.filter((m) => m.tipo === "emocao").length === 0, "evento que não é LIKE é ignorado");

  // Sem id não dá para evitar contagem dupla, então não entra.
  recebidos.length = 0;
  aoAbrir.emitir(JSON.stringify({ data: { events: [{ event_type: "LIKE", like_icon_id: "pokeball", liker_profile: { username: "y" } }] } }));
  conferir(recebidos.filter((m) => m.tipo === "emocao").length === 0, "LIKE sem id é ignorado");

  // A tabela de preços traz também o nome bonito de cada ícone.
  const tab2 = await pedir(
    "https://www.jamble.com/api/live/emojis",
    JSON.stringify({ success: true, emojis: [{ id: "magikarp_shiny", name: "Carpa Zika", gemPrice: 500 }] }),
  );
  const d2 = tab2.find((m) => m.tipo === "tabela-emocoes");
  conferir(
    d2 && d2.dados && d2.dados.nomes && d2.dados.nomes.magikarp_shiny === "Carpa Zika",
    "a tabela traz o nome do ícone",
    JSON.stringify(d2 && d2.dados && d2.dados.nomes),
  );

  // ---------- metricas de qualquer live (o objeto show do WebSocket) ----------
  // Campos exatos capturados da live do @coutotcg em 03/10/2026.
  const frameShow = (mudanca = {}) =>
    JSON.stringify({
      data: {
        show: {
          id: "phjngIZUsKBBMKyY6XJ3",
          created_at: 1790993006.914568,
          seller_id: "AdIZ3sLnSdQnogtbRnsy9zZDGpr1",
          title: "Batalha 30 Anos",
          starting_at: 1790994600,
          started_at: 1790994633.306017,
          has_started: true,
          is_over: false,
          bookmark_count: 0,
          audience_count: 29,
          available_product_count: 5,
          sold_product_count: 0,
          total_product_count: 5,
          share_count: 1,
          like_count: 15,
          sold_sale_count: 35,
          total_sale_product_price: 3731,
          currency: "BRL",
          ...mudanca,
        },
      },
    });

  recebidos.length = 0;
  aoAbrir.emitir(frameShow());
  const met = recebidos.filter((m) => m.tipo === "metricas").map((m) => m.dados);
  conferir(met.length === 1, "o objeto show vira métricas", JSON.stringify(met.length));
  const v = met[0]?.valores ?? {};
  conferir(met[0]?.de === "ao-vivo", "marcado como vindo da live");
  conferir(v.faturamento === 3731, "faturamento de qualquer live", String(v.faturamento));
  conferir(v.vendas === 35, "vendas", String(v.vendas));
  conferir(v.audienciaAgora === 29, "quem está assistindo agora", String(v.audienciaAgora));
  conferir(v.likes === 15, "likes");
  conferir(v.produtosTotal === 5 && v.produtosDisponiveis === 5, "produtos do catálogo");
  conferir(v.comecouEm === Math.round(1790994633.306017 * 1000), "a hora que a live começou, para calcular a duração");
  conferir(v.acabou === false, "sabe que ainda está no ar");

  // Frame igual não avisa de novo: senão gravaria a mesma coisa a cada 3s.
  recebidos.length = 0;
  aoAbrir.emitir(frameShow());
  conferir(recebidos.filter((m) => m.tipo === "metricas").length === 0, "frame repetido não avisa de novo");

  // Mudou alguma coisa, avisa.
  recebidos.length = 0;
  aoAbrir.emitir(frameShow({ total_sale_product_price: 4231, sold_sale_count: 36 }));
  const novo = recebidos.filter((m) => m.tipo === "metricas").map((m) => m.dados)[0];
  conferir(!!novo && novo.valores.faturamento === 4231, "venda nova faz o faturamento subir", String(novo?.valores?.faturamento));

  // Live encerrada.
  recebidos.length = 0;
  aoAbrir.emitir(frameShow({ is_over: true }));
  conferir(recebidos.find((m) => m.tipo === "metricas")?.dados?.valores?.acabou === true, "sabe quando a live acabou");

  // E o @ de quem está logado -- só o @, nada do CPF/telefone que vêm no mesmo
  // canal. Serve para o painel poder tirar você do próprio sorteio.
  recebidos.length = 0;
  aoAbrir.emitir(
    JSON.stringify({
      data: {
        my_profile: {
          id: "u1",
          username: "israelbrito",
          display_name: "israel brito",
          email: "nao-pode-sair@daqui.com",
          phone_number: "+5549999999999",
          cpf: "00000000000",
        },
      },
    }),
  );
  const eu = recebidos.find((m) => m.tipo === "eu")?.dados;
  conferir(eu?.handle === "israelbrito", "pega o @ de quem está logado", eu?.handle);
  conferir(eu?.nome === "israel brito", "e o nome");
  conferir(
    JSON.stringify(eu).indexOf("cpf") < 0 &&
      JSON.stringify(eu).indexOf("@daqui") < 0 &&
      JSON.stringify(eu).indexOf("5549") < 0,
    "e NADA de CPF, e-mail ou telefone",
    JSON.stringify(eu),
  );

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
