// Teste do background.js: rode com `node extensao-ranking/teste-background.js`.
// Roda o service worker de verdade fora do Chrome, com um chrome.* de mentira,
// e confere o que ele guarda quando a Jamble manda leituras de participação.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

// ---------- o Chrome de mentira ----------

function montar() {
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
    fetch: async () => ({ ok: true, json: async () => ({}), status: 200 }),
    setTimeout,
    clearTimeout,
    console,
    importScripts(arquivo) {
      // config-local.js pode não existir; gemas.js precisa existir.
      const alvo = path.join(__dirname, arquivo);
      if (!fs.existsSync(alvo)) throw new Error("sem " + arquivo);
      vm.runInContext(fs.readFileSync(alvo, "utf8"), ctx, { filename: arquivo });
    },
  };
  self.self = self;
  self.globalThis = self;

  const ctx = vm.createContext(self);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "background.js"), "utf8"), ctx, { filename: "background.js" });

  // Entrega uma mensagem como o Chrome entregaria, e espera a resposta.
  const mandar = (msg) =>
    new Promise((resolve) => {
      ouvinte(msg, {}, resolve);
    });

  return { guardado, mandar };
}

// ---------- os dados ----------

const linha = (handle, gemas, pontos = 0) => ({ handle, nome: handle, gemas, pontos, gastou: 0, mensagens: 0 });
const participacao = (linhas, quando, aoVivo = true) => ({ quando, aoVivo, pesos: null, linhas });
const live = (id) => ({ liveId: id, titulo: "Live " + id, url: "https://www.jamble.com/live/x/" + id });

(async () => {
  const t0 = 1_700_000_000_000;

  // ---------- leituras seguidas na mesma live ----------
  {
    const { guardado, mandar } = montar();

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000), linha("bruno", 500)], t0), contexto: live("L1") });
    conferir(guardado.participacao.linhas.length === 2, "guarda a primeira leitura");
    conferir((guardado.gemasEventos ?? []).length === 0, "primeira leitura não vira evento", String((guardado.gemasEventos ?? []).length));
    conferir(guardado.participacaoTitulo === "Live L1", "guarda o título da live");

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500), linha("bruno", 500)], t0 + 30000), contexto: live("L1") });
    conferir(guardado.gemasEventos.length === 1, "segunda leitura gera o envio", JSON.stringify(guardado.gemasEventos));
    conferir(guardado.gemasEventos[0].handle === "jako" && guardado.gemasEventos[0].gemas === 500, "o envio é a diferença");

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500), linha("bruno", 2500)], t0 + 60000), contexto: live("L1") });
    conferir(guardado.gemasEventos.length === 2, "os eventos se acumulam", String(guardado.gemasEventos.length));
    conferir(guardado.participacao.linhas.find((l) => l.handle === "bruno").gemas === 2500, "o total fica sendo o da última leitura");
  }

  // ---------- trocou de live: começa do zero ----------
  {
    const { guardado, mandar } = montar();

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000)], t0), contexto: live("L1") });
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500)], t0 + 30000), contexto: live("L1") });
    conferir(guardado.gemasEventos.length === 1, "um evento na primeira live");

    await mandar({ tipo: "participacao", dados: participacao([linha("outro", 9000)], t0 + 90000), contexto: live("L2") });
    conferir(guardado.gemasEventos.length === 0, "live nova zera o histórico", String(guardado.gemasEventos.length));
    conferir(guardado.participacaoLive === "L2", "e passa a seguir a live nova");
    conferir(guardado.gemasAnterior.jako === undefined, "não sobra ninguém da live antiga");

    // E a live nova continua contando normalmente.
    await mandar({ tipo: "participacao", dados: participacao([linha("outro", 9500)], t0 + 120000), contexto: live("L2") });
    conferir(guardado.gemasEventos.length === 1 && guardado.gemasEventos[0].gemas === 500, "a live nova conta a partir dela mesma");
  }

  // ---------- live muito longa não estoura a memória ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "participacao", dados: participacao([linha("a", 0)], t0), contexto: live("L1") });
    for (let i = 1; i <= 3100; i++) {
      await mandar({ tipo: "participacao", dados: participacao([linha("a", i * 10)], t0 + i * 1000), contexto: live("L1") });
    }
    conferir(guardado.gemasEventos.length === 3000, "o histórico para em 3000 eventos", String(guardado.gemasEventos.length));
    conferir(guardado.gemasEventos[guardado.gemasEventos.length - 1].total === 31000, "e mantém os mais novos", String(guardado.gemasEventos.at(-1).total));
  }

  // ---------- tabela de preços ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "tabela-emocoes", dados: { tabela: { magikarp_shiny: 500, pixel_heart: 10 } } });
    conferir(guardado.tabelaEmocoes.magikarp_shiny === 500, "guarda a tabela de preços");
  }

  // ---------- participação não contamina a fila que vai para o site ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000, 2473)], t0), contexto: live("L1") });
    conferir(!guardado.fila || guardado.fila.length === 0, "participação não entra na fila de vendas do site");
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
