// Teste de ponta a ponta: rode com `node extensao-ranking/teste-ponta-a-ponta.js`.
//
// Pega a resposta CRUA da Jamble (formato exato de /api/seller/show-participation,
// com as 20 primeiras linhas reais da live de 30/09) e empurra pela cadeia
// inteira: inject.js -> content.js -> background.js -> contas do painel.
// No fim confere contra o que a aba Participação mostrava na tela naquele dia.
//
// Os outros testes conferem cada pedaço. Este confere que os pedaços juntos
// chegam no mesmo número que a Jamble mostra.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

// ---------- o que a tela mostrava em 30/09 (copiado da aba Participação) ----------
// # | pessoa | comprou | gemas | mensagens | pontos
const NA_TELA = [
  ["fabiomeneguello", "fabio.meneguello", 9530, 500, 38, 9580],
  ["jakolino", "jako", 5, 24680, 40, 2473],
  ["cartaperfeita", "carta perfeita", 2370, 550, 36, 2425],
  ["rainhatcg", "rainha tcg", 2100, 180, 119, 2118],
  ["nathancosta", "nathan", 2015, 0, 74, 2015],
  ["blaftdyy24", "bruno", 125, 17280, 105, 1853],
  ["lucasliratcg", "ll baixada tcg", 163, 15540, 39, 1717],
  ["nathanalcarde", "nathanalcarde", 1012, 4800, 112, 1492],
  ["felipericardo", "felipe ricardo", 1476, 60, 51, 1482],
  ["pauloaraujobr7", "pauloaraujo.br7", 125, 12040, 30, 1329],
  ["hugo_lee_013", "hugo", 1239, 0, 33, 1239],
  ["vbpracima", "vbpracima", 1174, 0, 56, 1174],
  ["comesanha", "uira", 900, 2500, 9, 1150],
  ["nandinhohsj", "nandinhohsj", 757, 2500, 26, 1007],
  ["rafaelmedeiros090909", "rafaelmedeiros090909", 701, 3050, 12, 1006],
  ["drfelipecastelo", "felipecastelo", 901, 500, 47, 951],
  ["marinho", "marihho", 5, 9380, 39, 943],
  ["rodrigoomenaadv", "rodrigoomenaadv", 900, 0, 12, 900],
  ["vinastcg", "vinicius bueno", 130, 6000, 86, 730],
  ["plpedrolucas03", "plpedrolucas03", 0, 6630, 39, 663],
];

// A resposta como a Jamble devolve, com os nomes de campo dela.
const RESPOSTA_CRUA = JSON.stringify({
  success: true,
  participation: {
    weights: { spent: 1, gems: 0.1, messages: 0 },
    isLive: true,
    rows: NA_TELA.map(([username, displayName, spent, gems, messages, score], i) => ({
      userId: "uid" + i,
      rank: i + 1,
      score,
      spent,
      gems,
      messages,
      username,
      displayName,
      avatarUrl: "https://jamble.b-cdn.net/profiles/x.png",
    })),
  },
});

// ---------- 1) inject.js lê a resposta como a página faria ----------

const recebidas = [];
let aberto = null; // o WebSocket que o inject.js abriu
let proximaResposta = "";
function respostaFalsa(corpo) {
  const r = { headers: { get: () => "application/json" }, clone: () => r, text: async () => corpo };
  return r;
}

const paginaDaJamble = {
  addEventListener: () => {},
  postMessage: (msg) => recebidas.push(msg),
  WebSocket: class {
    constructor() {
      this.ouvintes = [];
      aberto = this;
    }
    addEventListener(tipo, fn) {
      if (tipo === "message") this.ouvintes.push(fn);
    }
    emitir(texto) {
      for (const fn of this.ouvintes) fn({ data: texto });
    }
  },
  fetch: async () => respostaFalsa(proximaResposta),
  XMLHttpRequest: function () {},
  location: { href: "https://www.jamble.com/seller/dashboard/lives/2P5LgSdtPTmHDSMdXGKV" },
};
paginaDaJamble.XMLHttpRequest.prototype = { open: function () {} };
paginaDaJamble.window = paginaDaJamble;

const ctxPagina = vm.createContext(paginaDaJamble);
vm.runInContext(fs.readFileSync(path.join(__dirname, "inject.js"), "utf8"), ctxPagina, { filename: "inject.js" });

// ---------- 2) o background guarda ----------

function montarBackground() {
  const guardado = {};
  let ouvinte = null;
  const chrome = {
    storage: {
      local: {
        async get(chaves) {
          const lista = Array.isArray(chaves) ? chaves : [chaves];
          const saida = {};
          for (const k of lista) if (k in guardado) saida[k] = guardado[k];
          return saida;
        },
        async set(obj) {
          Object.assign(guardado, obj);
        },
        async remove() {},
      },
    },
    runtime: {
      onMessage: { addListener: (fn) => (ouvinte = fn) },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
    },
    alarms: { create: () => {}, onAlarm: { addListener: () => {} } },
    tabs: { query: async () => [], sendMessage: async () => ({ ok: true }) },
  };
  const self = {
    chrome,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    console,
    importScripts(arquivo) {
      const alvo = path.join(__dirname, arquivo);
      if (!fs.existsSync(alvo)) throw new Error("sem " + arquivo);
      vm.runInContext(fs.readFileSync(alvo, "utf8"), ctx, { filename: arquivo });
    },
  };
  self.self = self;
  const ctx = vm.createContext(self);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "background.js"), "utf8"), ctx, { filename: "background.js" });
  return { guardado, mandar: (msg) => new Promise((r) => ouvinte(msg, {}, r)) };
}

// ---------- roda ----------

(async () => {
  // A página pede a participação; o inject.js lê a resposta.
  recebidas.length = 0;
  proximaResposta = RESPOSTA_CRUA;
  await ctxPagina.fetch("https://www.jamble.com/api/seller/show-participation?show_id=2P5LgSdt");
  await new Promise((r) => setImmediate(r));

  const msg = recebidas.find((m) => m.tipo === "participacao");
  conferir(!!msg, "o inject.js reconheceu a resposta da Jamble");
  if (!msg) {
    process.exit(1);
  }

  // O content.js monta o contexto; aqui usamos o mesmo formato que ele manda.
  const { guardado, mandar } = montarBackground();
  const contexto = { liveId: "2P5LgSdt", showId: "2P5LgSdt", doPainel: true, titulo: "EM BUSCA DO RGB" };
  await mandar({ tipo: "participacao", dados: msg.dados, contexto });

  const live = guardado.lives["2P5LgSdt"];
  conferir(!!live, "o background guardou a live");
  conferir(live.aoVivo === true, "marcou como ao vivo (isLive da Jamble)");
  conferir(live.linhas.length === 20, "20 linhas", String(live.linhas.length));

  // ---------- confere linha por linha contra a tela ----------
  const { resumirGemas } = require("./gemas.js");
  let diferentes = 0;
  for (const [username, displayName, spent, gems, messages, score] of NA_TELA) {
    const l = live.linhas.find((x) => x.handle === username);
    if (!l || l.nome !== displayName || l.gastou !== spent || l.gemas !== gems || l.mensagens !== messages || l.pontos !== score) {
      diferentes++;
      if (diferentes <= 3) console.log("    difere:", username, JSON.stringify(l));
    }
  }
  conferir(diferentes === 0, "cada linha bate com o que a tela mostrava", `${diferentes} diferentes`);

  // ---------- confere os números grandes ----------
  const r = resumirGemas(live.linhas);
  const somaTela = (i) => NA_TELA.reduce((s, x) => s + x[i], 0);
  conferir(r.gemas === somaTela(3), "total de gemas", `${r.gemas} vs ${somaTela(3)}`);
  conferir(r.comprado === somaTela(2), "total comprado", `${r.comprado} vs ${somaTela(2)}`);
  conferir(r.pontos === somaTela(5), "total de pontos", `${r.pontos} vs ${somaTela(5)}`);
  conferir(r.pessoas === 20 && r.enviaram === 16, "pessoas e quantas enviaram", `${r.enviaram}/${r.pessoas}`);

  // ---------- segunda leitura: o "ao vivo" aparece ----------
  const depois = JSON.parse(RESPOSTA_CRUA);
  depois.participation.rows[1].gems += 500; // jako manda uma carpa
  depois.participation.rows[1].score += 50; // e a Jamble recalcula os pontos
  recebidas.length = 0;
  proximaResposta = JSON.stringify(depois);
  await ctxPagina.fetch("https://www.jamble.com/api/seller/show-participation?show_id=2P5LgSdt");
  await new Promise((r2) => setImmediate(r2));
  await mandar({ tipo: "participacao", dados: recebidas.find((m) => m.tipo === "participacao").dados, contexto });

  const live2 = guardado.lives["2P5LgSdt"];
  conferir(live2.eventos.length === 1, "a carpa nova virou um envio no feed", JSON.stringify(live2.eventos));
  conferir(live2.eventos[0].handle === "jakolino" && live2.eventos[0].gemas === 500, "de quem e de quanto");
  conferir(resumirGemas(live2.linhas).gemas === somaTela(3) + 500, "e o total subiu 500");


  // ---------- live de outro vendedor: do WebSocket ate os numeros ----------
  // E o caso de acompanhar amigo ou concorrente: nao tem painel do vendedor,
  // entao tudo vem do WebSocket da propria live.
  {
    const { guardado, mandar } = montarBackground();
    const ctxAlheia = { liveId: "ALHEIA", showId: "ALHEIA", doPainel: false, titulo: "Batalha 30 Anos" };

    // o inject.js precisa ter aberto um WebSocket para podermos emitir nele
    new ctxPagina.WebSocket("wss://ws.jamble.com/websocket/show/x/ALHEIA");
    if (!aberto) throw new Error("o inject.js nao embrulhou o WebSocket");

    // 1) o objeto show, com os campos reais da live do @coutotcg
    recebidas.length = 0;
    aberto.emitir(
      JSON.stringify({
        data: {
          show: {
            id: "ALHEIA",
            title: "Batalha 30 Anos",
            started_at: 1791000000,
            is_over: false,
            audience_count: 29,
            available_product_count: 5,
            sold_product_count: 0,
            total_product_count: 5,
            share_count: 1,
            like_count: 15,
            sold_sale_count: 35,
            total_sale_product_price: 3731,
          },
        },
      }),
    );
    const met = recebidas.find((m) => m.tipo === "metricas");
    conferir(!!met, "o inject.js reconheceu o objeto show");
    await mandar({ tipo: "metricas", dados: met.dados, contexto: ctxAlheia });

    // 2) tres emotions, com icones diferentes
    const like = (id, icone, gemas, quem) =>
      JSON.stringify({
        data: {
          events: [
            {
              id,
              event_type: "LIKE",
              created_at: 1791000100,
              like_icon_id: icone,
              like_icon_battle_entry_count: gemas,
              liker_profile: { username: quem, display_name: quem },
            },
          ],
        },
      });
    recebidas.length = 0;
    aberto.emitir(like("k1", "magikarp_shiny", 500, "jako"));
    aberto.emitir(like("k2", "magikarp_shiny", 500, "bruno"));
    aberto.emitir(like("h1", "pixel_heart", 10, "ana"));
    const emos = recebidas.filter((m) => m.tipo === "emocao");
    conferir(emos.length === 3, "tres emotions reconhecidas", String(emos.length));
    for (const e of emos) await mandar({ tipo: "emocao", dados: e.dados, contexto: ctxAlheia });
    await new Promise((r) => setTimeout(r, 1800)); // o lote descarrega

    // 3) os numeros que o painel mostraria
    const { resumirEmocoes, listaDeMetricas, quemMandou } = require("./gemas.js");
    const live = guardado.lives.ALHEIA;
    conferir(!!live, "a live alheia foi guardada");
    conferir(live.doPainel === false, "marcada como de outro vendedor");
    conferir(live.metricas.faturamento === 3731, "faturamento chegou ao painel", String(live.metricas?.faturamento));
    conferir(live.metricas.vendas === 35, "vendas tambem");
    conferir(live.emocoes.length === 3, "as tres emotions guardadas", String(live.emocoes?.length));

    const em = resumirEmocoes(live.emocoes);
    conferir(em.gemas === 1010, "gemas somadas pelo preco de cada icone", String(em.gemas));
    conferir(em.porIcone[0].icone === "magikarp_shiny" && em.porIcone[0].qtd === 2, "duas carpas no topo");
    conferir(Math.round(em.gemas / 500) === 2, "duas carpas equivalentes");

    const fmt = {
      num: (n) => String(Math.round(Number(n))),
      reais: (n) => "R$ " + Number(n).toFixed(2),
      tempo: (s) => Math.round(s) + "s",
      pct: (v) => (v * 100).toFixed(0) + "%",
    };
    const lista = listaDeMetricas(live.metricas, fmt);
    const nomes = lista.map(([k]) => k);
    conferir(nomes.includes("Assistindo agora"), "o painel mostra quem esta assistindo");
    conferir(nomes.includes("Ticket medio") || nomes.includes("Ticket médio"), "e o ticket medio calculado");
    conferir(
      lista.find(([k]) => k.startsWith("Ticket"))[1] === "R$ " + (3731 / 35).toFixed(2),
      "com o valor certo",
      lista.find(([k]) => k.startsWith("Ticket"))[1],
    );

    // 4) o sorteio de carpa so pega quem mandou carpa
    const carpeiros = quemMandou(live.emocoes, "magikarp_shiny").map((c) => c.handle).sort();
    conferir(carpeiros.join(",") === "bruno,jako", "sorteio de carpa pega so quem mandou carpa", carpeiros.join(","));
  }

  // ---------- leilão, disputa, batalha e chat: do WebSocket até as abas ----------
  // A sequência é a de um leilão de verdade da live do @pokerusbr (03/10/2026):
  // começa em R$ 5, vai a R$ 550 com 49 lances e fecha em R$ 750.
  {
    const { guardado, mandar } = montarBackground();
    const ctxLive = { liveId: "pokerusbr", showId: "SwdW", doPainel: false, titulo: "MEGA LIVE 30 ANOS" };
    const GRUPO = "pPHuioR03kvou7qKTyYE";
    new ctxPagina.WebSocket("wss://ws.jamble.com/websocket/show/RGUO/SwdW");
    const show = aberto;
    new ctxPagina.WebSocket("wss://ws.jamble.com/websocket/group_message/" + GRUPO);
    const chat = aberto;

    // Tudo que o inject.js mandar vai para o background, como o content.js faria.
    const repassar = async () => {
      const lote = recebidas.splice(0);
      for (const m of lote) {
        if (["quadro", "perfis", "metricas", "emocao"].includes(m.tipo)) {
          await mandar({ tipo: m.tipo, dados: m.dados, contexto: ctxLive });
        }
      }
    };
    const sale = (mudanca) => ({
      id: "VyNc5TTB4S9JDJKlllcU",
      created_at: 1791048870.092078,
      status: "STARTED",
      is_sold: false,
      is_over: false,
      is_canceled: false,
      settings: { type: "AUCTION", duration_in_secs: 15, starting_price: 5 },
      sold_count: 0,
      available_count: 15,
      price: 5,
      ...mudanca,
    });
    const frame = (data) => JSON.stringify({ data, event_type: "snapshot" });

    recebidas.length = 0;
    show.emitir(
      frame({
        seller: { id: "RGUO", username: "pokerusbr", display_name: "pokerus br" },
        show: {
          id: "SwdW",
          title: "MEGA LIVE 30 ANOS",
          group_message_id: GRUPO,
          total_sale_product_price: 5168,
          sold_sale_count: 32,
          is_over: false,
        },
        sale: sale(),
        sale_best_entry: null,
        sale_entry_count: 0,
        sale_entry_user_ids: [],
        sale_product: { id: "p", title: "30 anos a R$ 5,00 💵", images: [{ original_url: "x" }] },
        battle: {
          id: "C1Dw",
          status: "started",
          is_over: false,
          ending_at: 1791065426.7,
          red_team_participant_count: 7,
          red_team_participant_total_entry_count: 19000,
          red_team_participant_top_user_ids: ["KFjL"],
          blue_team_participant_count: 4,
          blue_team_participant_total_entry_count: 14235,
          blue_team_participant_top_user_ids: ["QGKb"],
          tier: "tier_4",
        },
        giveaway: null,
      }),
    );
    // Os lances: chegam como atualização, sem repetir o leilão inteiro.
    show.emitir(
      JSON.stringify({
        data: {
          sale_best_entry: {
            price: 550,
            buyer_id: "KFjL",
            sale_id: "VyNc5TTB4S9JDJKlllcU",
            buyer_profile: { id: "KFjL", username: "vbpracima" },
          },
          sale_entry_count: 49,
          sale_entry_user_ids: ["KFjL", "QGKb", "igor"],
        },
        event_type: "update",
      }),
    );
    // Gente falando no chat (é daí que o código de quem deu lance ganha nome).
    const m = (id, quem, nome) => ({
      id,
      created_at: 1791049000,
      group_message_id: GRUPO,
      message_type: "STANDARD",
      content: "oi",
      sender_profile: { id: quem, username: nome },
    });
    chat.emitir(frame({ messages: [m("c1", "QGKb", "samantaavila"), m("c2", "QGKb", "samantaavila"), m("c3", "KFjL", "vbpracima")] }));
    // Fechou.
    show.emitir(
      frame({
        sale: sale({
          status: "FINISHED",
          is_sold: true,
          is_over: true,
          ended_at: 1791048966.17,
          buyer_id: "KFjL",
          sold_count: 1,
          sold_price: 750,
          total_sold_price: 750,
        }),
      }),
    );
    await repassar();
    await new Promise((r) => setTimeout(r, 1800)); // o lote descarrega

    const A = require("./analises.js");
    const live = guardado.lives.SwdW;
    conferir(!!live?.leiloes, "o leilão chegou ao background");
    const r = A.resumirLeiloes(live?.leiloes, guardado.perfis);
    const l = r.lista[0];
    conferir(l && l.titulo === "30 anos a R$ 5,00 💵" && l.situacao === "vendido", "aba Leilões: item vendido", JSON.stringify(l));
    conferir(l && l.final === 750 && l.vencedor === "vbpracima" && l.lances === 49, "por R$ 750, para @vbpracima, 49 lances");
    conferir(l && Math.round(l.multiplicador) === 150, "150 vezes o lance inicial");
    const d = A.quemDisputou(live?.leiloes, guardado.perfis);
    const sam = d.find((x) => x.id === "QGKb");
    conferir(sam && sam.handle === "samantaavila" && sam.perdeu === 1, "quem disputou e perdeu ganha nome pelo chat");
    conferir(d.find((x) => x.id === "igor")?.handle === null, "quem nunca apareceu com @ fica sem nome");
    const b = A.resumirBatalha(Object.values(live?.batalhas ?? {})[0], guardado.perfis);
    conferir(
      b && b.lider === "vermelho" && b.diferenca === 4765 && b.vermelho.topNomes[0] === "vbpracima",
      "aba Batalha: placar e quem lidera",
    );
    const c = A.resumirChat(live?.chat, 1791049000 * 1000 + 60000);
    conferir(c.total === 3 && c.top[0].handle === "samantaavila" && c.top[0].mensagens === 2, "aba Chat: quem mais fala");
    conferir(!JSON.stringify(guardado).includes('"oi"'), "o texto das mensagens não foi guardado");
    // A aba Clientes junta o histórico guardado com as lives abertas, na hora.
    const cl = A.clientes(A.historicoComLives(guardado.historico, guardado.lives, guardado.perfis), "israelbrito");
    const vb = cl.find((x) => x.handle === "vbpracima");
    conferir(
      vb && vb.ganhou === 1 && vb.gastou === 750 && vb.mensagens === 1,
      "aba Clientes: vbpracima levou 1, gastou R$ 750",
      JSON.stringify(vb),
    );
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
