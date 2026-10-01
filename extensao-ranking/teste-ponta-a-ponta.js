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
let proximaResposta = "";
function respostaFalsa(corpo) {
  const r = { headers: { get: () => "application/json" }, clone: () => r, text: async () => corpo };
  return r;
}

const paginaDaJamble = {
  addEventListener: () => {},
  postMessage: (msg) => recebidas.push(msg),
  WebSocket: class {
    addEventListener() {}
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

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
