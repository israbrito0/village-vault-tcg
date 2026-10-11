// Teste do envio para o Dash Village: rode com `node extensao-ranking/teste-dash.js`.
// Roda o background.js de verdade com um chrome.* de mentira, entrega emotions,
// chat, vendas e métricas como a página entregaria e confere o que vai para
// /api/dash/coleta -- e que o que já foi não vai de novo.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

function montar() {
  const guardado = { config: { token: "teste", endpoint: "https://www.villagetcg.com.br/api/ranking/eventos" } };
  let ouvinte = null;
  const envios = [];
  let falhar = false;

  const chrome = {
    storage: {
      local: {
        async get(chaves) {
          const lista = Array.isArray(chaves) ? chaves : [chaves];
          const saida = {};
          for (const k of lista) if (k in guardado) saida[k] = JSON.parse(JSON.stringify(guardado[k]));
          return saida;
        },
        async set(obj) {
          Object.assign(guardado, JSON.parse(JSON.stringify(obj)));
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
    URL,
    fetch: async (url, opcoes) => {
      if (String(url).includes("/api/dash/coleta")) envios.push({ url, corpo: JSON.parse(opcoes.body), auth: opcoes.headers.authorization });
      if (falhar) return { ok: false, status: 500, json: async () => ({ erro: "fora do ar" }) };
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    // Os tempos ficam parados: o teste chama descarregar e sincronizarDash na mão.
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
    importScripts(arquivo) {
      if (arquivo === "config-local.js") throw new Error("sem config local no teste");
      vm.runInContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), ctx, { filename: arquivo });
    },
  };
  self.self = self;
  self.globalThis = self;
  const ctx = vm.createContext(self);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "background.js"), "utf8"), ctx, { filename: "background.js" });

  const mandar = (msg) => new Promise((resolve) => ouvinte(msg, {}, resolve));
  return { guardado, mandar, ctx, envios, falhar: (v) => (falhar = v) };
}

const t0 = 1_791_500_000_000;
const contexto = { liveId: "S1", showId: "S1", titulo: "Live S1", doPainel: true };
const emocao = (id, handle, icone, gemas, s) => ({
  tipo: "emocao",
  dados: { id, handle, nome: handle, icone, gemas, ts: t0 + s * 1000, foto: `https://cdn.jamble.com/${handle}.jpg`, iconeUrl: null },
  contexto,
});

(async () => {
  const { guardado, mandar, ctx, envios, falhar } = montar();

  await mandar(emocao("e1", "ana", "magikarp_shiny", 500, 1));
  await mandar(emocao("e2", "ana", "magikarp_shiny", 500, 2));
  await mandar(emocao("e3", "bia", "pixel_heart", 10, 2)); // mesmo segundo que a e2
  await mandar({
    tipo: "quadro",
    dados: {
      grupoDaLive: "G1",
      data: {
        seller: { username: "israelbrito" },
        messages: [{ id: "m1", group_message_id: "G1", sender_profile: { username: "carla", display_name: "Carla" }, content: "manda 🐟", created_at: (t0 + 5000) / 1000 }],
      },
    },
    contexto,
  });
  await mandar({
    tipo: "vendidos",
    dados: {
      quando: t0 + 6000,
      itens: [
        { saleId: "v1", titulo: "SURPRISE PACK", tipo: "BUY_IT_NOW", inicial: 0, unidades: 2, preco: 330, total: 660, comprador: "bia", compradorId: "u1", foto: "https://cdn.jamble.com/bia.jpg", cancelado: false, pago: false, imagem: "https://jamble.b-cdn.net/p.jpg", quando: t0 + 3000 },
      ],
    },
    contexto,
  });
  await ctx.descarregar();
  await mandar({ tipo: "metricas", dados: { quando: t0 + 7000, de: "ao-vivo", valores: { audienciaAgora: 120, likes: 50, titulo: "Live S1", acabou: false, comecouEm: t0 } }, contexto });

  await ctx.sincronizarDash();
  conferir(envios.length === 1, "manda um envio", String(envios.length));
  const p = envios[0]?.corpo ?? {};
  const l = p.lives?.[0] ?? {};
  conferir(envios[0]?.url === "https://www.villagetcg.com.br/api/dash/coleta" && envios[0]?.auth === "Bearer teste", "vai para /api/dash/coleta com o token");
  conferir(l.showId === "S1" && l.vendedor === "israelbrito" && l.titulo === "Live S1" && l.audiencia === 120 && l.likes === 50 && l.aoVivo === true, "a live vai com título, vendedor e audiência", JSON.stringify({ ...l, emocoes: undefined, chat: undefined, vendas: undefined, metricas: undefined }));
  conferir(l.emocoes?.length === 3 && l.emocoes[0].foto === "https://cdn.jamble.com/ana.jpg", "as 3 emotions, com a foto", String(l.emocoes?.length));
  conferir(l.chat?.length === 1 && l.chat[0].texto === "manda 🐟", "a mensagem do chat");
  const v = l.vendas?.[0];
  conferir(l.vendasCompletas === true && l.vendas?.length === 1, "as vendas vão completas", JSON.stringify(l.vendas));
  conferir(v?.comprador === "bia" && v.quantidade === 2 && v.total === 660 && v.pago === false && v.imagem === "https://jamble.b-cdn.net/p.jpg" && v.tipo === "BUY_IT_NOW", "a venda com pago, imagem e tipo", JSON.stringify(v));

  // Nada mudou: não manda nada.
  await ctx.sincronizarDash();
  conferir(envios.length === 1, "sem novidade, sem envio", String(envios.length));

  // Uma emotion nova, no mesmo segundo da última: só ela vai.
  await mandar(emocao("e4", "carla", "magikarp_shiny", 500, 2));
  await ctx.descarregar();
  await ctx.sincronizarDash();
  const l2 = envios[1]?.corpo?.lives?.[0] ?? {};
  conferir(envios.length === 2 && l2.emocoes?.length === 1 && l2.emocoes[0].id === "e4", "só a emotion nova vai, mesmo no mesmo segundo", JSON.stringify(l2.emocoes?.map((e) => e.id)));
  conferir(!l2.vendas && !l2.chat && l2.titulo === undefined, "sem repetir vendas, chat e a live", Object.keys(l2).join(","));

  // O site fora do ar: o cursor não anda e a emotion vai na próxima.
  await mandar(emocao("e5", "ana", "magikarp_shiny", 500, 9));
  await ctx.descarregar();
  falhar(true);
  await ctx.sincronizarDash();
  conferir(guardado.statsDash?.ultimoErro === "fora do ar", "guarda o erro", guardado.statsDash?.ultimoErro);
  falhar(false);
  await ctx.sincronizarDash();
  const l4 = envios[3]?.corpo?.lives?.[0] ?? {};
  conferir(envios.length === 4 && l4.emocoes?.map((e) => e.id).join() === "e5", "depois do erro, manda de novo o que faltou", JSON.stringify(l4.emocoes?.map((e) => e.id)));

  // A venda passa a paga: a lista vai de novo, inteira.
  await mandar({
    tipo: "vendidos",
    dados: { quando: t0 + 20000, itens: [{ saleId: "v1", titulo: "SURPRISE PACK", tipo: "BUY_IT_NOW", unidades: 2, preco: 330, total: 660, comprador: "bia", pago: true, quando: t0 + 3000 }] },
    contexto,
  });
  await ctx.descarregar();
  await ctx.sincronizarDash();
  const l5 = envios[4]?.corpo?.lives?.[0] ?? {};
  conferir(l5.vendas?.[0]?.pago === true && l5.vendasCompletas === true, "venda paga depois vai atualizada", JSON.stringify(l5.vendas));

  // Ranking mensal: vai uma vez.
  await mandar({
    tipo: "ranking-mensal",
    dados: {
      quando: t0 + 30000,
      titulo: "Outubro",
      participants: [
        { rank: 4, points: 900000, username: "rainhatcg" },
        { rank: 5, points: 812000, username: "israelbrito" },
      ],
      rules: [{ icon: "shop", entryPoints: 3 }, { icon: "gem", entryPoints: 2 }],
    },
  });
  await ctx.sincronizarDash();
  const r = envios[5]?.corpo?.ranking;
  conferir(r?.lista?.length === 2 && r.regras?.porReal === 3 && r.mes === "Outubro", "o ranking mensal vai com as regras", JSON.stringify(r));
  await ctx.sincronizarDash();
  conferir(envios.length === 6, "e não vai de novo", String(envios.length));

  // Desligado na configuração: não manda.
  guardado.config.dash = false;
  await mandar(emocao("e6", "ana", "magikarp_shiny", 500, 30));
  await ctx.descarregar();
  await ctx.sincronizarDash();
  conferir(envios.length === 6, "com o Dash desligado, nada sai");

  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
