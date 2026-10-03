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
  conferir(
    emo[0] && emo[0].iconeUrl === "https://jamble-test.b-cdn.net/like_icons/charmander.png",
    "pega a figurinha do ícone",
    emo[0] && emo[0].iconeUrl,
  );
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
  );
  const tab3 = await pedir(
    "https://www.jamble.com/api/live/emojis",
    JSON.stringify({
      success: true,
      emojis: [{ id: "magikarp_shiny", name: "Carpa Zika", gemPrice: 500, iconUrl: "https://jamble-test.b-cdn.net/like_icons/magikarp_shiny.png" }],
    }),
  );
  const d3 = tab3.find((m) => m.tipo === "tabela-emocoes");
  conferir(
    d3 && d3.dados.icones.magikarp_shiny === "https://jamble-test.b-cdn.net/like_icons/magikarp_shiny.png",
    "a tabela traz a figurinha de cada ícone",
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
  // O mesmo frame também alimenta o dicionário código → @. Dali sai o par, e
  // só o par.
  const perfilEu = JSON.stringify(recebidos.filter((m) => m.tipo === "perfis").map((m) => m.dados));
  conferir(perfilEu === JSON.stringify([{ u1: "israelbrito" }]), "do perfil logado, o dicionário leva só código e @", perfilEu);

  // Envio de emotion com a foto de quem mandou e o time da batalha (campos
  // vistos numa live real em 03/10/2026).
  recebidos.length = 0;
  aoAbrir.emitir(
    JSON.stringify({
      data: {
        events: [
          {
            id: "foto1",
            event_type: "LIKE",
            created_at: 1791050000,
            like_icon_id: "pixel_heart",
            like_icon_url: "https://jamble-test.b-cdn.net/like_icons/pixel_heart.png",
            like_icon_battle_entry_count: 10,
            battle_team: "blue",
            user_profile_picture: "https://jamble.b-cdn.net/profiles/user_id=u9/profile_images/b.png",
            liker_profile: {
              id: "u9",
              username: "diniztcg",
              display_name: "diniz",
              profile_image: { low: "https://jamble.b-cdn.net/profiles/user_id=u9/profile_images/a-low.png", original_url: "https://jamble.b-cdn.net/profiles/user_id=u9/profile_images/a.png" },
            },
          },
        ],
      },
    }),
  );
  const comFoto = recebidos.find((m) => m.tipo === "emocao")?.dados;
  conferir(comFoto && comFoto.foto === "https://jamble.b-cdn.net/profiles/user_id=u9/profile_images/a-low.png", "o envio leva a foto pequena de quem mandou", comFoto && comFoto.foto);
  conferir(comFoto && comFoto.time === "blue", "e o time da batalha");

  // ---------- leilão, batalha, chat (live do @pokerusbr, 03/10/2026) ----------
  const SHOW = "wss://ws.jamble.com/websocket/show/RGUOtT0eUWcEn8VWsUccbNr9ygh1/SwdWTbncIqpktVHipW81";
  const GRUPO = "pPHuioR03kvou7qKTyYE";
  const wsShow = new contexto.WebSocket(SHOW);
  const wsChat = new contexto.WebSocket("wss://ws.jamble.com/websocket/group_message/" + GRUPO);
  const wsPrivado = new contexto.WebSocket("wss://ws.jamble.com/websocket/group_message/CONVERSA_PRIVADA");
  const de = (tipo) => recebidos.filter((m) => m.tipo === tipo).map((m) => m.dados);

  const msg = (id, grupo, quem, nome) => ({
    id,
    created_at: 1791049977.77515,
    group_message_id: grupo,
    message_type: "STANDARD",
    sender_id: quem,
    content: "texto da mensagem " + id,
    sender_profile: {
      id: quem,
      username: nome,
      display_name: nome + ".x",
      rating: 5,
      follower_count: 37,
      profile_image: { id: "a.png", original_url: "https://jamble.b-cdn.net/profiles/user_id=" + quem + "/profile_images/a.png", low: "https://jamble.b-cdn.net/profiles/user_id=" + quem + "/profile_images/a-low.png" },
    },
  });

  // O chat pode chegar antes de a live dizer qual é o grupo dela: espera.
  recebidos.length = 0;
  wsChat.emitir(JSON.stringify({ data: { messages: [msg("m1", GRUPO, "QGKb", "samantaavila")] }, event_type: "update" }));
  wsPrivado.emitir(JSON.stringify({ data: { messages: [msg("p1", "CONVERSA_PRIVADA", "zzz", "amigo")] } }));
  conferir(de("quadro").length === 0, "chat antes de saber o grupo da live fica esperando");

  const frameReal = (mudanca = {}) =>
    JSON.stringify({
      data: {
        seller: { id: "RGUOtT0eUWcEn8VWsUccbNr9ygh1", username: "pokerusbr", display_name: "pokerus br", rating: 4.99 },
        show: { id: "SwdWTbncIqpktVHipW81", title: "🚨MEGA LIVE 30 ANOS 🚨", group_message_id: GRUPO, sold_sale_count: 32, total_sale_product_price: 5168, is_over: false },
        sale: {
          id: "FOkQblciJnlebfPGJsdi",
          created_at: 1791049297.084186,
          status: "STARTED",
          is_sold: false,
          settings: { type: "BUY_IT_NOW", duration_in_secs: 60, starting_price: 149, currency: "BRL", target: "ALL" },
          sold_count: 3,
          available_count: 6,
          price: 149,
        },
        sale_best_entry: null,
        sale_next_bid_price: null,
        sale_entry_count: null,
        sale_entry_user_ids: null,
        sale_product: {
          id: "IVbRgYSskFvw3AyW4eLx",
          title: "Batalha 30 anos EUA",
          images: [{ original_url: "https://jamble.b-cdn.net/x.png" }],
          attributes: [{ key: "category", value: { id: "POKEMON_CARDS" } }],
        },
        battle: {
          id: "C1DwmXW5o5u6PkeWFj0M",
          is_over: false,
          status: "started",
          ending_at: 1791065426.701752,
          red_team_participant_count: 7,
          red_team_participant_total_entry_count: 19000,
          red_team_participant_top_user_ids: ["KFjL", "Jjzg", "vzcO"],
          blue_team_participant_count: 4,
          blue_team_participant_total_entry_count: 14235,
          blue_team_participant_top_user_ids: ["uPGH", "8haE", "QGKb"],
          tier: "tier_4",
        },
        giveaway: null,
        giveaway_product: null,
        next_giveaway_product: null,
        ...mudanca,
      },
      version: 3089,
      event_type: "snapshot",
    });

  recebidos.length = 0;
  wsShow.emitir(frameReal());
  const quadros = de("quadro");
  const chatLiberado = quadros.find((q) => q.data.messages);
  conferir(
    chatLiberado && chatLiberado.data.messages.length === 1 && chatLiberado.data.messages[0].id === "m1",
    "quando a live diz o grupo, o chat que esperava é liberado -- e só o da live",
    JSON.stringify(chatLiberado),
  );
  conferir(chatLiberado && chatLiberado.grupoDaLive === GRUPO, "o grupo da live vai junto");
  const texto = JSON.stringify(chatLiberado);
  // O texto do chat DA LIVE passa (o painel mostra o que as pessoas falam);
  // do perfil, só @, nome e a foto pequena.
  conferir(chatLiberado && chatLiberado.data.messages[0].content === "texto da mensagem m1", "o texto do chat da live vai para o painel");
  conferir(
    chatLiberado && chatLiberado.data.messages[0].sender_profile.foto === "https://jamble.b-cdn.net/profiles/user_id=QGKb/profile_images/a-low.png",
    "com a foto pequena de quem escreveu",
  );
  conferir(texto.indexOf("rating") < 0 && texto.indexOf("follower") < 0 && texto.indexOf("original_url") < 0, "o resto do perfil não sai", texto);
  conferir(texto.indexOf("CONVERSA_PRIVADA") < 0 && texto.indexOf("amigo") < 0, "conversa privada não sai, nem o texto dela");

  const q = quadros.find((x) => x.data.sale);
  conferir(!!q, "o frame da live vira um quadro");
  conferir(q && q.leilaoAtual === "FOkQblciJnlebfPGJsdi", "sabe qual venda está rolando");
  conferir(q && q.data.sale.sold_count === 3 && q.data.sale.settings.type === "BUY_IT_NOW", "a venda vai com tipo e quantas saíram");
  conferir(q && q.data.sale_product.title === "Batalha 30 anos EUA" && !("images" in q.data.sale_product), "do produto, só o nome");
  conferir(q && q.data.battle.red_team_participant_total_entry_count === 19000, "a batalha vai junto");
  conferir(q && q.data.seller.username === "pokerusbr", "de quem é a live");
  conferir(q && !("show" in q.data) && !("sale_best_entry" in q.data), "o objeto da live e campos vazios não vão no quadro");

  recebidos.length = 0;
  wsShow.emitir(frameReal());
  conferir(de("quadro").length === 0, "o mesmo estado de novo não manda nada");

  // Atualização parcial: lances sem dizer de qual leilão.
  recebidos.length = 0;
  wsShow.emitir(JSON.stringify({ data: { sale_entry_count: 7, sale_entry_user_ids: ["KFjL", "QGKb"] }, event_type: "update" }));
  const parcial = de("quadro")[0];
  conferir(parcial && parcial.leilaoAtual === "FOkQblciJnlebfPGJsdi" && parcial.data.sale_entry_count === 7, "lance sem leilão leva o leilão atual junto");

  // Chat depois de saber o grupo: o da live passa, o privado não.
  recebidos.length = 0;
  wsChat.emitir(JSON.stringify({ data: { messages: [msg("m2", GRUPO, "KFjL", "vbpracima")] } }));
  wsPrivado.emitir(JSON.stringify({ data: { messages: [msg("p2", "CONVERSA_PRIVADA", "zzz", "amigo")] } }));
  wsChat.emitir(JSON.stringify({ data: { messages: [msg("m2", GRUPO, "KFjL", "vbpracima")] } }));
  const ms = de("quadro").flatMap((x) => x.data.messages || []);
  conferir(ms.length === 1 && ms[0].id === "m2", "chat da live passa uma vez; conversa privada não passa", JSON.stringify(ms.map((m) => m.id)));

  // Mensagem apagada (ou editada): vai o aviso, para o painel acompanhar.
  const antesDaEdicao = recebidos.length;
  wsChat.emitir(JSON.stringify({ data: { updated_messages: [{ id: "m2", group_message_id: GRUPO, is_visible: false, content: "" }] } }));
  wsPrivado.emitir(JSON.stringify({ data: { updated_messages: [{ id: "p2", group_message_id: "CONVERSA_PRIVADA", is_visible: false }] } }));
  const mudou = recebidos
    .slice(antesDaEdicao)
    .filter((m) => m.tipo === "quadro")
    .flatMap((m) => m.dados.data.updated_messages || []);
  conferir(mudou.length === 1 && mudou[0].id === "m2" && mudou[0].is_visible === false, "mensagem apagada no chat da live avisa; da conversa privada, não", JSON.stringify(mudou));

  // Dicionário de perfis: o par código → @ de quem apareceu, uma vez só.
  const perfisVistos = Object.assign({}, ...recebidos.filter((m) => m.tipo === "perfis").map((m) => m.dados));
  conferir(perfisVistos.KFjL === "vbpracima", "o @ de quem falou no chat entra no dicionário", JSON.stringify(perfisVistos));
  recebidos.length = 0;
  wsChat.emitir(JSON.stringify({ data: { messages: [msg("m3", GRUPO, "KFjL", "vbpracima")] } }));
  conferir(de("perfis").length === 0, "quem já está no dicionário não é mandado de novo");

  // Ranking mensal: posição, pontos e @, sem foto e sem código.
  const rk = await pedir(
    "https://www.jamble.com/api/live/seller-ranking?seller_id=x",
    JSON.stringify({
      success: true,
      title: "Ranking Mensal de Vendedores",
      participants: [{ id: "c", sellerId: "s3", rank: 6, points: 294409, username: "israelbrito", avatarUrl: "https://x/a.png" }],
      seller: { id: "RGUO", sellerId: "RGUO", rank: 125, points: 18320, username: "pokerusbr", avatarUrl: "https://x/b.png" },
      rules: [{ rule: "+3 pontos para cada R$1 gasto", description: null, icon: "shop", entryPoints: 3 }],
    }),
  );
  const rm = rk.find((m) => m.tipo === "ranking-mensal")?.dados;
  conferir(rm && rm.participants[0].points === 294409 && rm.participants[0].username === "israelbrito", "lê o ranking mensal");
  conferir(rm && !JSON.stringify(rm).includes("avatar") && !JSON.stringify(rm).includes("sellerId"), "sem foto nem código no ranking");
  conferir(rm && rm.seller?.username === "pokerusbr" && rm.seller.rank === 125, "traz o dono da live, mesmo fora do top 20");
  conferir(rm && rm.rules?.[0]?.entryPoints === 3 && rm.rules[0].icon === "shop", "e as regras de pontos");

  // ---------- histórico desde o começo da live ----------
  const H = require("./amostras-historico.js");
  const vend = await pedir("https://www.jamble.com/api/live/products?seller_id=x&show_id=y&section=sold", JSON.stringify(H.VENDIDOS_PAGINA_1));
  const vh = vend.find((m) => m.tipo === "vendidos")?.dados;
  conferir(vh && vh.itens.length === 3, "lê a lista Vendidos da live", JSON.stringify(vh && vh.itens.length));
  const leo = vh && vh.itens.find((i) => i.comprador === "leozinthewise");
  conferir(
    leo && leo.tipo === "BUY_IT_NOW" && leo.unidades === 5 && leo.total === 190 && leo.preco === 38,
    "compra direta com quem comprou, quantas e quanto",
    JSON.stringify(leo),
  );
  conferir(leo && leo.saleId === "uBLkp73qrYHnuqHeIYbu" && leo.quando === 1791054004696, "com o código da venda e a hora");
  conferir(leo && leo.foto.startsWith("https://jamble.b-cdn.net/profiles/"), "e a foto de quem comprou");
  const aVenda = await pedir("https://www.jamble.com/api/live/products?section=upcoming", JSON.stringify({ success: true, items: [{ id: "p", title: "à venda", sold: null }] }));
  conferir(!aVenda.some((m) => m.tipo === "vendidos"), "produto ainda à venda não vira venda");

  const bat = await pedir("https://www.jamble.com/api/live/battle-participants?show_id=y", JSON.stringify(H.BATALHA_PARTICIPANTES));
  const bp = bat.find((m) => m.tipo === "batalha-participantes")?.dados;
  conferir(bp && bp.participantes.length === 4 && bp.participantes[0].handle === "colecionar_164", "lê o ranking da batalha");
  conferir(bp && bp.participantes[0].pontos === 44520 && bp.participantes[0].time === "red" && bp.participantes[0].premio === "R$ 25", "pontos, time e prêmio de cada um");
  conferir(bp && bp.regras.some((r) => r.icon === "shop" && r.entryPoints === 15), "e as regras de pontos da batalha");
  conferir(!bat.some((m) => m.tipo === "ranking-mensal"), "ranking da batalha não é confundido com o ranking mensal");

  // Campo novo, nunca visto com dado: vai uma amostra, sem dado pessoal.
  recebidos.length = 0;
  wsShow.emitir(
    frameReal({
      giveaway: { id: "g1", status: "STARTED", participant_count: 12, email: "dono@x.com", phone_number: "+5549999", winner_profile: { username: "ana", email: "ana@x.com" } },
    }),
  );
  const am = de("amostra");
  conferir(am.length === 1 && am[0].chave === "giveaway", "sorteio da Jamble novo gera uma amostra");
  conferir(am[0] && am[0].texto.indexOf("ana@x.com") < 0, "e a amostra não leva e-mail", am[0] && am[0].texto);
  const qg = de("quadro").find((x) => x.data.giveaway);
  conferir(qg && qg.data.giveaway.participant_count === 12 && qg.data.giveaway.winner_profile.username === "ana", "o sorteio vai no quadro");
  conferir(qg && !JSON.stringify(qg).includes("ana@x.com"), "sem o e-mail do ganhador");
  conferir(qg && !/dono@x|5549999/.test(JSON.stringify(qg)), "nem e-mail ou telefone soltos no objeto", JSON.stringify(qg && qg.data.giveaway));
  recebidos.length = 0;
  wsShow.emitir(frameReal({ giveaway: { id: "g1", status: "FINISHED", participant_count: 12 } }));
  conferir(de("amostra").length === 0, "a amostra de cada campo vai uma vez só");

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
