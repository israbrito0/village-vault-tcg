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
const live = (id, doPainel = true) => ({
  liveId: id,
  showId: id,
  doPainel,
  titulo: "Live " + id,
  url: "https://www.jamble.com/live/x/" + id,
});

(async () => {
  const t0 = 1_700_000_000_000;

  // ---------- leituras seguidas na mesma live ----------
  {
    const { guardado, mandar } = montar();

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000), linha("bruno", 500)], t0), contexto: live("L1") });
    conferir(guardado.lives.L1.linhas.length === 2, "guarda a primeira leitura");
    conferir(guardado.lives.L1.eventos.length === 0, "primeira leitura não vira evento", String(guardado.lives.L1.eventos.length));
    conferir(guardado.lives.L1.titulo === "Live L1", "guarda o título da live");

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500), linha("bruno", 500)], t0 + 30000), contexto: live("L1") });
    conferir(guardado.lives.L1.eventos.length === 1, "segunda leitura gera o envio", JSON.stringify(guardado.lives.L1.eventos));
    conferir(guardado.lives.L1.eventos[0].handle === "jako" && guardado.lives.L1.eventos[0].gemas === 500, "o envio é a diferença");

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500), linha("bruno", 2500)], t0 + 60000), contexto: live("L1") });
    conferir(guardado.lives.L1.eventos.length === 2, "os eventos se acumulam", String(guardado.lives.L1.eventos.length));
    conferir(guardado.lives.L1.linhas.find((l) => l.handle === "bruno").gemas === 2500, "o total fica sendo o da última leitura");
  }

  // ---------- a live dela e a de outra pessoa, abertas juntas ----------
  // Ela abre a live de outro vendedor durante a propria live para ver o
  // ranking mensal. As duas mandam participacao; uma nao pode apagar a outra.
  {
    const { guardado, mandar } = montar();

    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000)], t0), contexto: live("MINHA") });
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500)], t0 + 30000), contexto: live("MINHA") });
    conferir(guardado.lives.MINHA.eventos.length === 1, "um envio na live dela");

    // Agora chega a participacao da live alheia, no meio.
    await mandar({ tipo: "participacao", dados: participacao([linha("outro", 9000)], t0 + 40000), contexto: live("ALHEIA", false) });
    await mandar({ tipo: "participacao", dados: participacao([linha("outro", 9500)], t0 + 50000), contexto: live("ALHEIA", false) });

    conferir(guardado.lives.MINHA.eventos.length === 1, "a live dela não perdeu o histórico", String(guardado.lives.MINHA.eventos.length));
    conferir(guardado.lives.MINHA.anterior.jako === 1500, "nem o ponto de partida dela");
    conferir(guardado.lives.ALHEIA.eventos.length === 1, "e a live alheia conta separado");
    conferir(guardado.lives.ALHEIA.doPainel === false, "a live alheia fica marcada como de outra pessoa");
    conferir(guardado.lives.MINHA.doPainel === true, "a dela fica marcada como do painel do vendedor");

    // E a live dela continua contando depois disso.
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 2000)], t0 + 60000), contexto: live("MINHA") });
    conferir(guardado.lives.MINHA.eventos.length === 2, "a live dela segue contando", String(guardado.lives.MINHA.eventos.length));
    conferir(guardado.lives.MINHA.eventos[1].gemas === 500, "com o valor certo");
  }

  // ---------- muitas lives: guarda só as mais recentes ----------
  {
    const { guardado, mandar } = montar();
    for (let i = 1; i <= 6; i++) {
      await mandar({ tipo: "participacao", dados: participacao([linha("a", 10)], t0 + i * 1000), contexto: live("L" + i) });
    }
    const ids = Object.keys(guardado.lives).sort();
    conferir(ids.length === 4, "guarda no máximo 4 lives", ids.join(","));
    conferir(ids.includes("L6") && ids.includes("L3") && !ids.includes("L1"), "e são as mais recentes", ids.join(","));
  }

  // ---------- live muito longa não estoura a memória ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "participacao", dados: participacao([linha("a", 0)], t0), contexto: live("L1") });
    for (let i = 1; i <= 3100; i++) {
      await mandar({ tipo: "participacao", dados: participacao([linha("a", i * 10)], t0 + i * 1000), contexto: live("L1") });
    }
    conferir(guardado.lives.L1.eventos.length === 3000, "o histórico para em 3000 eventos", String(guardado.lives.L1.eventos.length));
    conferir(guardado.lives.L1.eventos.at(-1).total === 31000, "e mantém os mais novos", String(guardado.lives.L1.eventos.at(-1).total));
  }

  // ---------- sorteio e "ao vivo" são de UMA live ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000)], t0), contexto: live("A") });
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500)], t0 + 10000), contexto: live("A") });
    await mandar({ tipo: "participacao", dados: participacao([linha("zz", 50)], t0 + 20000), contexto: live("B", false) });

    await mandar({ tipo: "mexer-na-live", id: "A", acao: "sortear", sorteio: { ts: t0, ganhador: "jako", entre: 1 } });
    conferir(guardado.lives.A.sorteios.length === 1, "o sorteio entra na live certa");
    conferir((guardado.lives.B.sorteios ?? []).length === 0, "e não aparece na outra live");

    await mandar({ tipo: "mexer-na-live", id: "A", acao: "zerar-ao-vivo" });
    conferir(guardado.lives.A.eventos.length === 0, "zerar o ao vivo limpa o feed");
    conferir(guardado.lives.A.linhas[0].gemas === 1500, "mas não mexe nos totais");
    conferir(guardado.lives.A.anterior.jako === 1500, "e o ponto de partida fica onde está");
    conferir(guardado.lives.A.sorteios.length === 1, "nem nos sorteios já feitos");

    // E a contagem continua dali em diante.
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 2000)], t0 + 30000), contexto: live("A") });
    conferir(guardado.lives.A.eventos.length === 1 && guardado.lives.A.eventos[0].gemas === 500, "depois de zerar, conta a partir dali");

    await mandar({ tipo: "mexer-na-live", id: "A", acao: "limpar-sorteios" });
    conferir(guardado.lives.A.sorteios.length === 0, "limpar sorteios limpa só os sorteios");
    conferir(guardado.lives.A.eventos.length === 1, "e deixa o ao vivo em paz");

    const r = await mandar({ tipo: "mexer-na-live", id: "NAO-EXISTE", acao: "zerar-ao-vivo" });
    conferir(r?.ok === false, "mexer em live que não existe responde que não deu");
  }

  // ---------- emotions: quem mandou qual ícone ----------
  // Elas sao gravadas em lote (numa live movimentada chegam muitas seguidas),
  // entao o teste espera o descarregamento antes de conferir.
  {
    const { guardado, mandar } = montar();
    const emo = (id, icone, gemas, handle) => ({ id, icone, gemas, handle, nome: handle, ts: 1700000000000 });
    const assentar = () => new Promise((r) => setTimeout(r, 1100));

    await mandar({ tipo: "emocao", dados: emo("e1", "magikarp_shiny", 500, "jako"), contexto: live("A") });
    await mandar({ tipo: "emocao", dados: emo("e2", "pixel_heart", 10, "ana"), contexto: live("A") });
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 2, "guarda as emotions da live", String(guardado.lives.A.emocoes.length));
    conferir(guardado.lives.A.emocoes[0].icone === "magikarp_shiny", "com o ícone");

    // o mesmo evento chegando de novo não pode duplicar
    await mandar({ tipo: "emocao", dados: emo("e1", "magikarp_shiny", 500, "jako"), contexto: live("A") });
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 2, "evento repetido não duplica", String(guardado.lives.A.emocoes.length));

    // duas emotions juntas, no mesmo lote, tambem nao duplicam
    await mandar({ tipo: "emocao", dados: emo("e9", "pokeball", 20, "zz"), contexto: live("A") });
    await mandar({ tipo: "emocao", dados: emo("e9", "pokeball", 20, "zz"), contexto: live("A") });
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 3, "repetida dentro do mesmo lote também não duplica", String(guardado.lives.A.emocoes.length));

    // emotion de outra live vai para o balde dela
    await mandar({ tipo: "emocao", dados: emo("e3", "pokeball", 20, "zz"), contexto: live("B", false) });
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 3 && guardado.lives.B.emocoes.length === 1, "cada live com as suas");

    // a participação chegando depois NÃO pode apagar as emotions já guardadas
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 500)], t0), contexto: live("A") });
    conferir(guardado.lives.A.emocoes.length === 3, "participação não apaga as emotions", String(guardado.lives.A.emocoes.length));
    conferir(guardado.lives.A.linhas.length === 1, "e a participação entra normalmente");

    // e emotion depois da participação continua somando
    await mandar({ tipo: "emocao", dados: emo("e4", "charmander", 60, "bruno"), contexto: live("A") });
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 4, "emotion depois da participação soma");
    conferir(guardado.lives.A.linhas.length === 1, "sem mexer na participação");

    // sem id não entra
    await mandar({ tipo: "emocao", dados: { icone: "pokeball", gemas: 20, handle: "x" }, contexto: live("A") });
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 4, "emotion sem id é ignorada");

    // enxurrada: 60 de uma vez nao podem se perder nem duplicar
    for (let k = 0; k < 60; k++) {
      await mandar({ tipo: "emocao", dados: emo("lote" + k, "pixel_heart", 10, "p" + k), contexto: live("A") });
    }
    await assentar();
    conferir(guardado.lives.A.emocoes.length === 64, "enxurrada de 60 entra inteira", String(guardado.lives.A.emocoes.length));
  }

  // ---------- sorteio e "ao vivo" são de UMA live ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000)], t0), contexto: live("A") });
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1500)], t0 + 10000), contexto: live("A") });
    await mandar({ tipo: "participacao", dados: participacao([linha("zz", 50)], t0 + 20000), contexto: live("B", false) });

    await mandar({ tipo: "mexer-na-live", id: "A", acao: "sortear", sorteio: { ts: t0, ganhador: "jako", entre: 1 } });
    conferir(guardado.lives.A.sorteios.length === 1, "o sorteio entra na live certa");
    conferir((guardado.lives.B.sorteios ?? []).length === 0, "e não aparece na outra live");

    await mandar({ tipo: "mexer-na-live", id: "A", acao: "zerar-ao-vivo" });
    conferir(guardado.lives.A.eventos.length === 0, "zerar o ao vivo limpa o feed");
    conferir(guardado.lives.A.linhas[0].gemas === 1500, "mas não mexe nos totais");
    conferir(guardado.lives.A.anterior.jako === 1500, "e o ponto de partida fica onde está");
    conferir(guardado.lives.A.sorteios.length === 1, "nem nos sorteios já feitos");

    // E a contagem continua dali em diante.
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 2000)], t0 + 30000), contexto: live("A") });
    conferir(guardado.lives.A.eventos.length === 1 && guardado.lives.A.eventos[0].gemas === 500, "depois de zerar, conta a partir dali");

    await mandar({ tipo: "mexer-na-live", id: "A", acao: "limpar-sorteios" });
    conferir(guardado.lives.A.sorteios.length === 0, "limpar sorteios limpa só os sorteios");
    conferir(guardado.lives.A.eventos.length === 1, "e deixa o ao vivo em paz");

    const r = await mandar({ tipo: "mexer-na-live", id: "NAO-EXISTE", acao: "zerar-ao-vivo" });
    conferir(r?.ok === false, "mexer em live que não existe responde que não deu");
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
