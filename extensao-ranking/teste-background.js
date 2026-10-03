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
    const assentar = () => new Promise((r) => setTimeout(r, 1800));

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

  // ---------- live de outro vendedor: o "no ar" vem das metricas ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("ALHEIA", false);
    await mandar({
      tipo: "metricas",
      dados: { quando: t0, de: "ao-vivo", valores: { faturamento: 3731, vendas: 35, acabou: false } },
      contexto: ctx,
    });
    conferir(guardado.lives.ALHEIA.aoVivo === true, "live de outro vendedor aparece como no ar");
    conferir(guardado.lives.ALHEIA.quando === t0, "e a hora da leitura vem das metricas", String(guardado.lives.ALHEIA.quando));

    await mandar({
      tipo: "metricas",
      dados: { quando: t0 + 60000, de: "ao-vivo", valores: { faturamento: 4000, acabou: true } },
      contexto: ctx,
    });
    conferir(guardado.lives.ALHEIA.aoVivo === false, "e passa a encerrada quando a live acaba");
    conferir(guardado.lives.ALHEIA.metricas.faturamento === 4000, "com o ultimo faturamento");
    conferir(guardado.lives.ALHEIA.metricas.vendas === 35, "sem perder o que a leitura anterior trouxe");
  }

  // ---------- tabela de preços ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "tabela-emocoes", dados: { tabela: { magikarp_shiny: 500, pixel_heart: 10 } } });
    conferir(guardado.tabelaEmocoes.magikarp_shiny === 500, "guarda a tabela de preços");

    await mandar({
      tipo: "tabela-emocoes",
      dados: {
        tabela: { magikarp_shiny: 500 },
        icones: { magikarp_shiny: "https://jamble-test.b-cdn.net/like_icons/magikarp_shiny.png", ruim: "javascript:alert(1)" },
      },
    });
    conferir(guardado.iconesEmocoes?.magikarp_shiny?.endsWith("magikarp_shiny.png"), "guarda a figurinha de cada ícone");
    conferir(!("ruim" in (guardado.iconesEmocoes ?? {})), "endereço que não é da Jamble fica de fora");
  }

  // ---------- participação não contamina a fila que vai para o site ----------
  {
    const { guardado, mandar } = montar();
    await mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000, 2473)], t0), contexto: live("L1") });
    conferir(!guardado.fila || guardado.fila.length === 0, "participação não entra na fila de vendas do site");
  }

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const emocao = (id, handle = "jako", gemas = 500) => ({ id, handle, nome: handle, icone: "magikarp_shiny", gemas, ts: t0 });

  // ---------- duas gravações ao mesmo tempo não se apagam ----------
  // Numa live movimentada, emotion e métrica chegam juntas. Antes, cada uma lia
  // a live, mexia e gravava de volta: a segunda escrevia por cima da primeira.
  {
    const { guardado, mandar } = montar();
    const ctx = live("CORRIDA", false);
    // 40 emotions de uma vez descarregam na hora, sem esperar o relógio.
    const pedidos = [];
    for (let i = 0; i < 40; i++) pedidos.push(mandar({ tipo: "emocao", dados: emocao("e" + i), contexto: ctx }));
    pedidos.push(mandar({ tipo: "metricas", dados: { quando: t0, valores: { faturamento: 999, acabou: false } }, contexto: ctx }));
    pedidos.push(mandar({ tipo: "participacao", dados: participacao([linha("jako", 1000)], t0), contexto: ctx }));
    await Promise.all(pedidos);
    await esperar(1800);
    const l = guardado.lives.CORRIDA;
    conferir(l.emocoes.length === 40, "as 40 emotions ficaram", String(l.emocoes.length));
    conferir(l.metricas?.faturamento === 999, "a métrica que chegou junto ficou");
    conferir(l.linhas.length === 1, "e a participação também");
  }

  // ---------- leilão, batalha e chat de uma live ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("SwdW", false);
    const GRUPO = "pPHu";
    const sale = (mudanca) => ({
      id: "VyNc",
      created_at: 1791048870.09,
      status: "STARTED",
      is_sold: false,
      is_canceled: false,
      settings: { type: "AUCTION", starting_price: 5 },
      available_count: 15,
      price: 5,
      ...mudanca,
    });
    await mandar({
      tipo: "quadro",
      dados: {
        leilaoAtual: "VyNc",
        grupoDaLive: GRUPO,
        data: {
          seller: { username: "pokerusbr" },
          sale: sale(),
          sale_product: { title: "30 anos a R$ 5,00" },
          sale_best_entry: { price: 550, buyer_id: "KFjL", sale_id: "VyNc", buyer_profile: { username: "vbpracima" } },
          sale_entry_count: 49,
        },
      },
      contexto: ctx,
    });
    await mandar({ tipo: "quadro", dados: { leilaoAtual: "VyNc", data: { sale_entry_user_ids: ["KFjL", "QGKb", "anon"], sale_entry_count: 51 } }, contexto: ctx });
    await mandar({
      tipo: "quadro",
      dados: { leilaoAtual: "VyNc", data: { sale: sale({ status: "FINISHED", is_sold: true, buyer_id: "KFjL", sold_price: 750, total_sold_price: 750, sold_count: 1 }) } },
      contexto: ctx,
    });
    await mandar({
      tipo: "quadro",
      dados: {
        data: {
          battle: {
            id: "C1Dw",
            status: "started",
            red_team_participant_count: 7,
            red_team_participant_total_entry_count: 19000,
            red_team_participant_top_user_ids: ["KFjL"],
            blue_team_participant_count: 4,
            blue_team_participant_total_entry_count: 14235,
            blue_team_participant_top_user_ids: ["QGKb"],
          },
        },
      },
      contexto: ctx,
    });
    const m = (id, quem) => ({ id, created_at: 1791049977, group_message_id: GRUPO, message_type: "STANDARD", sender_profile: { id: quem, username: quem } });
    await mandar({ tipo: "quadro", dados: { grupoDaLive: GRUPO, data: { messages: [m("m1", "samantaavila"), m("m2", "vbpracima")] } }, contexto: ctx });
    // A mesma mensagem pela outra aba aberta na mesma live: não conta de novo.
    await mandar({ tipo: "quadro", dados: { grupoDaLive: GRUPO, data: { messages: [m("m2", "vbpracima"), m("m3", "samantaavila")] } }, contexto: ctx });
    await mandar({ tipo: "perfis", dados: { KFjL: "vbpracima", QGKb: "samantaavila" }, contexto: ctx });
    await esperar(1800);

    const l = guardado.lives.SwdW;
    const lei = l.leiloes?.VyNc;
    conferir(!!lei && lei.titulo === "30 anos a R$ 5,00", "o leilão fica guardado, com o nome do item");
    conferir(lei && lei.vendido === true && lei.vendidoPor === 750 && lei.vencedorId === "KFjL", "vendido por R$ 750 para KFjL");
    conferir(lei && lei.disputantes.length === 3 && lei.lances === 51, "com quem disputou e os lances");
    conferir(l.vendedor === "pokerusbr", "de quem é a live");
    conferir(l.batalhas?.C1Dw?.vermelho?.pontos === 19000, "a batalha fica guardada");
    conferir(l.chat?.total === 3, "3 mensagens, sem contar em dobro a que chegou pelas duas abas", String(l.chat?.total));
    conferir(l.chat?.porPessoa?.samantaavila?.n === 2, "2 de samantaavila");
    conferir(guardado.perfis?.KFjL === "vbpracima", "o dicionário guarda código → @");

    // E o histórico de clientes já tem esta live.
    const h = guardado.historico?.SwdW;
    conferir(!!h && h.vendedor === "pokerusbr", "a live entra no histórico de clientes");
    conferir(h && h.pessoas?.samantaavila?.mensagens === 2, "com as mensagens de cada um");
  }

  // ---------- a live que sai do balde continua no histórico ----------
  {
    const { guardado, mandar } = montar();
    await mandar({
      tipo: "participacao",
      dados: participacao([{ handle: "fiel", nome: "fiel", gemas: 5000, gastou: 300, pontos: 0, mensagens: 3 }], t0),
      contexto: live("VELHA"),
    });
    // Mais quatro lives depois: a VELHA sai das lives guardadas inteiras...
    for (const id of ["N1", "N2", "N3", "N4"]) {
      await esperar(5);
      await mandar({ tipo: "participacao", dados: participacao([linha("x" + id, 10)], t0), contexto: live(id) });
    }
    conferir(!guardado.lives.VELHA, "a live mais antiga sai das lives guardadas inteiras", Object.keys(guardado.lives).join(","));
    conferir(guardado.historico?.VELHA?.pessoas?.fiel?.gastou === 300, "mas o resumo dela fica no histórico de clientes");
  }

  // ---------- figurinha e foto que vêm junto com cada envio ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("FOTOS", false);
    await mandar({
      tipo: "emocao",
      dados: {
        ...emocao("f1", "diniztcg", 10),
        icone: "pixel_heart",
        iconeUrl: "https://jamble-test.b-cdn.net/like_icons/pixel_heart.png",
        foto: "https://jamble.b-cdn.net/profiles/user_id=u9/profile_images/a-low.png",
        time: "blue",
      },
      contexto: ctx,
    });
    await mandar({ tipo: "emocao", dados: { ...emocao("f2", "outro", 10), foto: 'https://x.com/a.png" onerror="x' }, contexto: ctx });
    await esperar(1800);
    conferir(guardado.iconesEmocoes?.pixel_heart?.endsWith("pixel_heart.png"), "a figurinha que veio no envio fica guardada");
    conferir(guardado.fotos?.diniztcg?.endsWith("a-low.png"), "a foto de quem mandou fica guardada");
    conferir(!guardado.fotos?.outro, "foto com endereço estranho fica de fora");
    conferir(guardado.lives.FOTOS.emocoes[0].time === "blue", "o envio guarda o time da batalha");
    conferir(!("foto" in guardado.lives.FOTOS.emocoes[0]), "a foto não é repetida em cada envio (fica no mapa de fotos)");
  }

  // ---------- chat com o texto, e mensagem apagada sai ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("CHAT", false);
    const m = (id, quem, texto) => ({
      id,
      created_at: 1791049977,
      group_message_id: "G",
      message_type: "STANDARD",
      is_visible: true,
      content: texto,
      sender_profile: { id: quem, username: quem, foto: "https://jamble.b-cdn.net/profiles/user_id=" + quem + "/p.png" },
    });
    await mandar({ tipo: "quadro", dados: { grupoDaLive: "G", data: { messages: [m("c1", "ana", "boa noite"), m("c2", "bia", "quanto o lote?")] } }, contexto: ctx });
    await mandar({ tipo: "quadro", dados: { grupoDaLive: "G", data: { updated_messages: [{ id: "c1", group_message_id: "G", is_visible: false }] } }, contexto: ctx });
    await mandar({ tipo: "quadro", dados: { grupoDaLive: "G", data: { updated_messages: [{ id: "c2", group_message_id: "G", is_visible: true, content: "quanto o lote 2?" }] } }, contexto: ctx });
    await esperar(1800);
    const chat = guardado.lives.CHAT.chat;
    conferir(chat.total === 2, "as duas mensagens contam", String(chat.total));
    conferir(chat.msgs.length === 1 && chat.msgs[0].texto === "quanto o lote 2?", "a apagada sai da lista, a editada troca o texto", JSON.stringify(chat.msgs));
    conferir(guardado.fotos?.bia?.endsWith("/p.png"), "a foto de quem fala no chat fica guardada");
  }

  // ---------- histórico desde o começo: lista Vendidos e ranking da batalha ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("HIST", false);
    // Um anúncio de compra direta rolando ao vivo, com 3 vendidas.
    await mandar({
      tipo: "quadro",
      dados: {
        leilaoAtual: "BIN1",
        data: { sale: { id: "BIN1", created_at: 1791049297, status: "STARTED", settings: { type: "BUY_IT_NOW", starting_price: 149 }, sold_count: 3, available_count: 6, price: 149 } },
      },
      contexto: ctx,
    });
    const item = (saleId, comprador, compradorId, total) => ({
      saleId,
      titulo: "Batalha 30 anos EUA",
      tipo: "BUY_IT_NOW",
      unidades: 1,
      preco: total,
      total,
      comprador,
      compradorId,
      foto: "https://jamble.b-cdn.net/profiles/user_id=" + compradorId + "/profile_images/a.png",
      cancelado: false,
      quando: 1791049300000,
    });
    await mandar({ tipo: "vendidos", dados: { quando: 1791054100000, itens: [item("s1", "sixsauwer", "uPGH", 149), item("s2", "noxentcg", "zorj", 149)] }, contexto: ctx });
    await mandar({ tipo: "vendidos", dados: { quando: 1791054200000, itens: [item("s2", "noxentcg", "zorj", 149), item("s3", "colecionar_164", "d1DX", 298)] }, contexto: ctx });
    await mandar({
      tipo: "batalha-participantes",
      dados: { quando: 1791054300000, regras: [{ icon: "shop", entryPoints: 15 }], temMais: true, participantes: [{ id: "d1DX", handle: "colecionar_164", foto: "https://jamble.b-cdn.net/profiles/user_id=d1DX/profile_images/b.png", time: "red", posicao: 1, pontos: 44520 }] },
      contexto: ctx,
    });
    await esperar(1800);
    const l = guardado.lives.HIST;
    conferir(Object.keys(l.vendidos ?? {}).sort().join() === "s1,s2,s3", "as leituras da lista Vendidos se juntam pelo código da venda", Object.keys(l.vendidos ?? {}).join());
    conferir(l.vendidosEm === 1791054200000, "guarda quando a lista foi lida");
    conferir(l.leiloes.BIN1.vendidasNaHistoria === 3, "o anúncio de compra direta anota quantas já estavam na lista");
    conferir(guardado.perfis?.uPGH === "sixsauwer" && guardado.perfis?.d1DX === "colecionar_164", "o código de cada comprador entra no dicionário de nomes");
    conferir(guardado.fotos?.noxentcg?.endsWith("/a.png"), "e a foto de quem comprou");
    conferir(l.batalhaRanking?.lista?.[0]?.pontos === 44520 && l.batalhaRanking.temMais === true, "guarda o ranking da batalha");
  }

  // ---------- batalha ETB: gravada à parte das lives ----------
  {
    const { guardado, mandar } = montar();
    const r = await mandar({ tipo: "batalha-etb", acao: "criar", liveId: "L1", titulo: "ETB 30 anos", boosters: 9, vagas: ["ana", "bia"] });
    conferir(r?.ok && guardado.batalhasETB?.[r.id]?.numero === 1, "cria e guarda a batalha");
    const e = await mandar({ tipo: "batalha-etb", acao: "encerrar", id: r.id, ganhador: "bia", hit: "Charizard" });
    conferir(e?.ok && guardado.batalhasETB[r.id].ganhador === "bia", "define o ganhador");
    const ruim = await mandar({ tipo: "batalha-etb", acao: "encerrar", id: "nao-existe", ganhador: "x" });
    conferir(ruim?.ok === false && Object.keys(guardado.batalhasETB).length === 1, "pedido inválido não grava nada");
  }

  // ---------- "Batalha 1 ETB" vendido: a batalha aparece sozinha ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("ETB", false);
    const vaga = (saleId, comprador, unidades, quando) => ({
      saleId, titulo: "Batalha 1 ETB", tipo: "BUY_IT_NOW", unidades, preco: 149, total: 149 * unidades, comprador, cancelado: false, quando,
    });
    await mandar({ tipo: "vendidos", dados: { quando: 1791054100000, itens: [vaga("v1", "ana", 1, 1), vaga("v2", "bia", 2, 2)] }, contexto: ctx });
    await esperar(1800);
    const b = Object.values(guardado.batalhasETB ?? {})[0];
    conferir(b && b.numero === 1 && b.liveId === "ETB" && b.automatica, "vendeu vaga de 'Batalha 1 ETB': aparece a Batalha ETB nº 1");
    conferir(b && b.slots.slice(0, 3).map((s) => s.handle).join() === "ana,bia,bia", "com quem comprou nos boosters", b && b.slots.map((s) => s.handle).join());
    await mandar({ tipo: "vendidos", dados: { quando: 1791054200000, itens: [vaga("v3", "caio", 1, 3)] }, contexto: ctx });
    await esperar(1800);
    conferir(Object.values(guardado.batalhasETB)[0].slots[3].handle === "caio" && Object.keys(guardado.batalhasETB).length === 1, "quem compra depois entra na mesma batalha");
  }

  // ---------- "1 - INGRESSO - BOOSTER BATALHA": as batalhas enchem sozinhas ----------
  {
    const { guardado, mandar } = montar();
    const ctx = live("DRICO", false);
    const H = require("./amostras-historico.js");
    const itens = H.VENDIDOS_DRICO.items.map((i) => ({
      saleId: i.sold.saleId, titulo: i.title, tipo: i.saleType, unidades: i.soldCount, preco: i.sold.soldPrice,
      total: i.sold.totalSoldPrice, comprador: i.sold.buyerUsername, cancelado: false, quando: Math.round(i.sold.createdAt * 1000),
    }));
    await mandar({ tipo: "vendidos", dados: { quando: 1791060000000, itens }, contexto: ctx });
    await esperar(1800);
    const bs = Object.values(guardado.batalhasETB ?? {}).sort((a, b) => a.numero - b.numero);
    conferir(bs.length === 3 && bs.every((b) => b.automatica && b.boosters === 9), "25 ingressos: Batalhas ETB nº 1, 2 e 3 sozinhas", bs.map((b) => b.numero + ":" + b.slots.filter((s) => s.handle).length).join(" "));
    conferir(bs[2] && bs[2].slots.filter((s) => s.handle === "exclusive").length === 5, "o @exclusive na nº 3");

    // Ela muda para 5 boosters por batalha: a próxima leitura já usa.
    guardado.etbBoosters = 5;
    await mandar({ tipo: "vendidos", dados: { quando: 1791060100000, itens }, contexto: ctx });
    await esperar(1800);
    conferir(Object.keys(guardado.batalhasETB).length === 5, "com 5 boosters por batalha, as vagas viram 5 batalhas", String(Object.keys(guardado.batalhasETB).length));
  }

  // ---------- ranking mensal e amostras ----------
  {
    const { guardado, mandar } = montar();
    const r = await mandar({
      tipo: "ranking-mensal",
      dados: { quando: t0, titulo: "Ranking Mensal de Vendedores", participants: [{ rank: 6, points: 294409, username: "israelbrito" }, { rank: 5, points: 300000, username: "quinto" }] },
    });
    conferir(r?.ok === true && guardado.rankingMensal?.lista?.[0]?.handle === "quinto", "guarda o ranking mensal em ordem");
    const vazio = await mandar({ tipo: "ranking-mensal", dados: { participants: [] } });
    conferir(vazio?.ok === false && guardado.rankingMensal.lista.length === 2, "resposta vazia não apaga o ranking que já tinha");

    await mandar({ tipo: "amostra", dados: { chave: "offer", origem: "ws:x", texto: '{"id":"o1"}' } });
    await mandar({ tipo: "amostra", dados: { chave: "offer", origem: "ws:x", texto: '{"id":"o2"}' } });
    conferir(guardado.amostrasNovas?.offer?.texto === '{"id":"o1"}', "guarda a primeira amostra de cada campo novo, só ela");
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
