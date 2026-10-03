// Teste do content.js: rode com `node extensao-ranking/teste-content.js`.
// Ele é a ponte entre a página da Jamble e o background. Se ele deixar cair
// uma mensagem, ou mandar o contexto errado, a live inteira conta errado --
// e isso não aparece em nenhum dos outros testes.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

const MARCA = "vv-ranking";

// Monta uma "página da Jamble" de mentira e roda gemas.js + content.js dentro,
// na mesma ordem em que o manifest manda.
function abrirPagina(caminho, titulo = "Minha live | Jamble") {
  const enviadas = [];
  let ouvinteDaExtensao = null;
  const ouvintesDeMensagem = [];

  const elemento = () => ({
    setAttribute() {},
    getAttribute: () => null,
    appendChild() {},
    remove() {},
    addEventListener() {},
    querySelectorAll: () => [],
    textContent: "",
    innerText: "",
  });

  const botoes = [];
  const teclas = [];
  let dialogo = null;
  const janela = {
    location: { pathname: caminho, href: "https://www.jamble.com" + caminho },
    document: {
      title: titulo,
      createElement: elemento,
      head: elemento(),
      documentElement: elemento(),
      body: { ...elemento(), nodeType: 1 },
      addEventListener() {},
      // A busca real e "button,[role=tab]"; aqui qualquer selecao que fale de
      // botao devolve os botoes de mentira.
      querySelectorAll: (sel) =>
        String(sel) === '[role="tab"]' ? botoes.filter((b) => b.role === "tab") : String(sel).includes("button") ? botoes : [],
      querySelector: (sel) => (String(sel).includes("dialog") ? dialogo : null),
      dispatchEvent: (ev) => teclas.push(ev.key),
    },
    KeyboardEvent: class {
      constructor(tipo, opcoes) {
        this.type = tipo;
        Object.assign(this, opcoes);
      }
    },
    addEventListener(tipo, fn) {
      if (tipo === "message") ouvintesDeMensagem.push(fn);
    },
    postMessage() {},
    MutationObserver: class {
      observe() {}
    },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    chrome: {
      runtime: {
        getURL: (f) => "chrome-extension://fake/" + f,
        sendMessage: (m) => enviadas.push(m),
        onMessage: { addListener: (fn) => (ouvinteDaExtensao = fn) },
      },
    },
    console,
    // O content.js espera entre um clique e outro nas abas da Jamble; aqui
    // a espera vira quase nada, para o teste não demorar.
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)),
    clearTimeout,
  };
  janela.window = janela;
  janela.self = janela;

  const ctx = vm.createContext(janela);
  for (const arquivo of ["gemas.js", "content.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), ctx, { filename: arquivo });
  }

  // Dentro da VM o `window` é outro objeto, não o `janela` daqui de fora. O
  // content.js só aceita mensagem com `e.source === window`, então o teste
  // precisa usar o window de lá de dentro -- senão testaria a coisa errada.
  const janelaDeDentro = vm.runInContext("window", ctx);

  // A página manda uma mensagem, como o inject.js faria.
  const daPagina = (tipo, dados, origem = janelaDeDentro, marca = MARCA) => {
    for (const fn of ouvintesDeMensagem) fn({ source: origem, data: { marca, tipo, dados } });
  };
  // O background manda uma mensagem para esta aba.
  const daExtensao = (msg) =>
    new Promise((resolve) => {
      const r = ouvinteDaExtensao(msg, {}, resolve);
      if (r !== true) resolve(undefined);
    });

  return { enviadas, daPagina, daExtensao, botoes, teclas, abrirDialogo: () => (dialogo = {}) };
}

const botaoFalso = (texto, rotulo = null, { role = null, selecionado = false, classe = "", aoClicar = null, log = null } = {}) => {
  let cliques = 0;
  const b = {
    textContent: texto,
    role,
    className: classe,
    selecionado,
    getAttribute: (nome) =>
      nome === "aria-label" ? rotulo : nome === "aria-selected" ? (role === "tab" ? String(b.selecionado) : null) : nome === "role" ? role : null,
    click() {
      cliques++;
      log?.push(texto);
      aoClicar?.(b);
    },
    get cliques() {
      return cliques;
    },
  };
  return b;
};

(async () => {
  // ---------- repassa tudo que o inject.js manda ----------
  {
    const p = abrirPagina("/seller/dashboard/lives/ABC123");
    p.daPagina("venda", { id: "v1", handle: "jako", centavos: 1000 });
    p.daPagina("participacao", { quando: 1, linhas: [] });
    p.daPagina("tabela-emocoes", { tabela: { magikarp_shiny: 500 } });
    p.daPagina("candidato", { origem: "x", itens: [] });

    const tipos = p.enviadas.map((m) => m.tipo);
    for (const t of ["venda", "participacao", "tabela-emocoes", "candidato"]) {
      conferir(tipos.includes(t), `repassa "${t}" para o background`, tipos.join(", "));
    }

    // Emotion por pessoa voltou: a Jamble manda sim, nos eventos LIKE do
    // WebSocket -- confirmado numa live de verdade em 03/10/2026.
    p.enviadas.length = 0;
    p.daPagina("emocao", { id: "e1", icone: "magikarp_shiny", gemas: 500, handle: "jako" });
    const passou = p.enviadas.find((m) => m.tipo === "emocao");
    conferir(!!passou, "repassa a emotion para o background");
    conferir(passou && passou.dados.icone === "magikarp_shiny", "com o ícone junto", passou && passou.dados.icone);
    conferir(passou && passou.contexto.showId === "ABC123", "e com a live certa no contexto");
  }

  // ---------- o contexto vai certo em cada tipo de página ----------
  {
    const p = abrirPagina("/seller/dashboard/lives/ABC123", "EM BUSCA DO RGB | Jamble");
    p.daPagina("participacao", { quando: 1, linhas: [] });
    const c = p.enviadas[0].contexto;
    conferir(c.showId === "ABC123", "painel do vendedor: pega o id da live", c.showId);
    conferir(c.doPainel === true, "e marca que é a live dela");
    conferir(c.titulo === "EM BUSCA DO RGB", "tira o ' | Jamble' do título", c.titulo);
  }
  {
    const p = abrirPagina("/live/dedevieira1/5gqNkh1zTPMP7SlS6hsu");
    p.daPagina("participacao", { quando: 1, linhas: [] });
    const c = p.enviadas[0].contexto;
    conferir(c.showId === "5gqNkh1zTPMP7SlS6hsu", "página da live: pega o id, não o nome do vendedor", c.showId);
    conferir(c.doPainel === false, "e marca que é live de outra pessoa");
  }
  {
    // Duas lives do mesmo vendedor não podem cair no mesmo balde.
    const a = abrirPagina("/live/israelbrito/aaa");
    const b = abrirPagina("/live/israelbrito/bbb");
    a.daPagina("participacao", { quando: 1, linhas: [] });
    b.daPagina("participacao", { quando: 1, linhas: [] });
    conferir(
      a.enviadas[0].contexto.showId !== b.enviadas[0].contexto.showId,
      "duas lives do mesmo vendedor viram ids diferentes",
      `${a.enviadas[0].contexto.showId} vs ${b.enviadas[0].contexto.showId}`,
    );
  }

  // ---------- só entra mensagem nossa, vinda desta página ----------
  {
    const p = abrirPagina("/seller/dashboard/lives/ABC123");

    p.daPagina("tipo-que-nao-existe", {});
    conferir(p.enviadas.length === 0, "tipo desconhecido é ignorado", JSON.stringify(p.enviadas.map((m) => m.tipo)));

    // Marca de outra gente: um script da página, outra extensão, um iframe.
    p.daPagina("participacao", { linhas: [] }, undefined, "outra-coisa");
    conferir(p.enviadas.length === 0, "mensagem com outra marca é ignorada");

    // Mesma marca, mas vinda de outra janela (iframe de anúncio, por exemplo).
    p.daPagina("participacao", { linhas: [] }, { finge: "ser outra janela" });
    conferir(p.enviadas.length === 0, "mensagem de outra janela é ignorada");

    // E a de verdade continua passando.
    p.daPagina("participacao", { linhas: [] });
    conferir(p.enviadas.length === 1, "a mensagem legítima passa", String(p.enviadas.length));
  }

  // ---------- o "Atualizar" só é apertado em página de live ----------
  {
    const p = abrirPagina("/seller/dashboard/lives/ABC123");
    const botao = botaoFalso("Atualizar");
    p.botoes.push(botaoFalso("Cancelar"), botao);
    const r = await p.daExtensao({ tipo: "atualizar-participacao" });
    conferir(r?.ok === true, "acha o botão na página da live");
    conferir(botao.cliques === 1, "e aperta uma vez só", String(botao.cliques));
  }
  // Idioma: se a conta estiver em ingles, os botoes tem outro nome e o
  // automatico pararia de funcionar calado.
  {
    const p = abrirPagina("/seller/dashboard/lives/ABC123");
    const atualizar = botaoFalso("Refresh");
    const desempenho = botaoFalso("Performance");
    p.botoes.push(desempenho, botaoFalso("Participation"), atualizar);
    const r = await p.daExtensao({ tipo: "atualizar-participacao" });
    conferir(r?.ok === true, "acha os botoes em ingles tambem");
    conferir(desempenho.cliques === 1, "clicou em Performance", String(desempenho.cliques));
    conferir(atualizar.cliques === 1, "clicou em Refresh", String(atualizar.cliques));
  }

  {
    const p = abrirPagina("/seller/dashboard/wallet");
    const botao = botaoFalso("Atualizar");
    p.botoes.push(botao);
    const r = await p.daExtensao({ tipo: "atualizar-participacao" });
    conferir(r?.ok === false, "fora de página de live, não aperta nada");
    conferir(botao.cliques === 0, "o botão da carteira fica em paz", String(botao.cliques));
  }
  {
    const p = abrirPagina("/live/alguem/xyz");
    p.botoes.push(botaoFalso("Seguir"), botaoFalso("Comprar"));
    const r = await p.daExtensao({ tipo: "atualizar-participacao" });
    conferir(r?.ok === false, "sem botão Atualizar, responde que não achou");
  }

  // ---------- o que é novo na 2.7: leilão, batalha, chat, ranking mensal ----------
  {
    const p = abrirPagina("/live/pokerusbr/SwdWTbncIqpktVHipW81");
    p.daPagina("quadro", { leilaoAtual: "x", data: { sale: { id: "x" } } });
    p.daPagina("perfis", { u1: "ana" });
    p.daPagina("ranking-mensal", { participants: [] });
    p.daPagina("amostra", { chave: "offer", texto: "{}" });
    const tipos = p.enviadas.map((m) => m.tipo);
    for (const t of ["quadro", "perfis", "ranking-mensal", "amostra"]) {
      conferir(tipos.includes(t), `repassa "${t}" para o background`, tipos.join(", "));
    }
    conferir(p.enviadas[0].contexto.showId === "SwdWTbncIqpktVHipW81", "o quadro vai com a live certa");
  }

  // O ranking mensal: aperta o botão "Ranking do vendedor: #N" da live.
  {
    const p = abrirPagina("/live/pokerusbr/SwdWTbncIqpktVHipW81");
    const ranking = botaoFalso("#149", "Ranking do vendedor: #149");
    const batalha = botaoFalso("", "Ver o ranking da batalha");
    p.botoes.push(batalha, ranking);
    const r = await p.daExtensao({ tipo: "atualizar-ranking-mensal" });
    conferir(r?.ok === true, "acha o botão do ranking mensal");
    conferir(ranking.cliques === 1 && batalha.cliques === 0, "aperta o do vendedor, não o da batalha", `${ranking.cliques}/${batalha.cliques}`);
    conferir(p.teclas.length === 0, "sem janela aberta, não aperta Esc à toa");
  }
  {
    const p = abrirPagina("/live/pokerusbr/SwdWTbncIqpktVHipW81");
    const ranking = botaoFalso("#3", "Seller ranking: #3");
    p.botoes.push(ranking);
    p.abrirDialogo();
    const r = await p.daExtensao({ tipo: "atualizar-ranking-mensal" });
    conferir(r?.ok === true && ranking.cliques === 1, "em inglês também");
    conferir(p.teclas.join() === "Escape", "se abriu janela por cima da live, fecha", p.teclas.join());
  }
  {
    const p = abrirPagina("/seller/dashboard/wallet");
    const ranking = botaoFalso("#149", "Ranking do vendedor: #149");
    p.botoes.push(ranking);
    const r = await p.daExtensao({ tipo: "atualizar-ranking-mensal" });
    conferir(r?.ok === false && ranking.cliques === 0, "fora de página de live, não aperta nada");
  }
  {
    const p = abrirPagina("/live/alguem/xyz");
    p.botoes.push(botaoFalso("Seguir"));
    const r = await p.daExtensao({ tipo: "atualizar-ranking-mensal" });
    conferir(r?.ok === false, "sem o botão do ranking, responde que não achou");
  }

  // ---------- histórico desde o começo: abre Vendidos e Batalha e volta ----------
  {
    const p = abrirPagina("/live/pokerusbr/SwdWTbncIqpktVHipW81");
    const log = [];
    const abas = [];
    const selecionar = (aba) => abas.forEach((a) => (a.selecionado = a === aba));
    const disp = botaoFalso("Disponíveis (8)", null, { classe: "rounded-full bg-[var(--bg-inverse)] ", log });
    const vend = botaoFalso("Vendidos (59)", null, { classe: "rounded-full bg-[var(--bg-tertiary)]", log });
    let paginas = 2;
    const mais = botaoFalso("Carregar Mais", null, {
      log,
      aoClicar: (b) => {
        if (--paginas === 0) p.botoes.splice(p.botoes.indexOf(b), 1);
      },
    });
    const chat = botaoFalso("Chat", null, { role: "tab", selecionado: true, log, aoClicar: (b) => selecionar(b) });
    const batalha = botaoFalso("Batalha", null, { role: "tab", log, aoClicar: (b) => selecionar(b) });
    abas.push(chat, batalha);
    p.botoes.push(disp, vend, mais, chat, batalha);
    const r = await p.daExtensao({ tipo: "carregar-historico" });
    conferir(r?.ok === true && r.feito.join() === "vendidos,batalha", "busca a lista Vendidos e o ranking da batalha", JSON.stringify(r));
    conferir(log.join(" > ") === "Vendidos (59) > Carregar Mais > Carregar Mais > Disponíveis (8) > Batalha > Chat", "abre, carrega tudo e volta para onde ela estava", log.join(" > "));
    conferir(chat.selecionado && !batalha.selecionado, "no fim, a coluna do chat está de novo no Chat");
  }
  {
    // Ela estava olhando os Vendidos: volta para os Vendidos.
    const p = abrirPagina("/live/x/y");
    const log = [];
    const vend = botaoFalso("Vendidos (3)", null, { classe: "bg-[var(--bg-inverse)]", log });
    p.botoes.push(botaoFalso("Disponíveis (1)", null, { classe: "bg-[var(--bg-tertiary)]", log }), vend);
    await p.daExtensao({ tipo: "carregar-historico" });
    conferir(log.join(" > ") === "Vendidos (3)", "se ela já estava nos Vendidos, fica nos Vendidos", log.join(" > "));
  }
  {
    // Ela estava na aba Batalha: passa por outra para buscar de novo e fica na Batalha.
    const p = abrirPagina("/live/x/y");
    const log = [];
    const abas = [];
    const selecionar = (aba) => abas.forEach((a) => (a.selecionado = a === aba));
    const chat = botaoFalso("Chat", null, { role: "tab", log, aoClicar: (b) => selecionar(b) });
    const batalha = botaoFalso("Batalha", null, { role: "tab", selecionado: true, log, aoClicar: (b) => selecionar(b) });
    abas.push(chat, batalha);
    p.botoes.push(chat, batalha);
    await p.daExtensao({ tipo: "carregar-historico" });
    conferir(log.join(" > ") === "Chat > Batalha" && batalha.selecionado, "se ela já estava na Batalha, fica na Batalha", log.join(" > "));
  }
  {
    // Vaga de "Batalha 1 ETB" vendida ao vivo: relê a lista Vendidos (só a
    // primeira página) para saber quem comprou.
    const p = abrirPagina("/live/x/y");
    const log = [];
    p.botoes.push(
      botaoFalso("Disponíveis (3)", null, { classe: "bg-[var(--bg-inverse)]", log }),
      botaoFalso("Vendidos (2)", null, { classe: "bg-[var(--bg-tertiary)]", log }),
      botaoFalso("Carregar Mais", null, { log }),
    );
    const quadro = (vendidas) => ({ leilaoAtual: "S1", data: { sale: { id: "S1", sold_count: vendidas }, sale_product: { title: "Batalha 1 ETB" } } });
    p.daPagina("quadro", quadro(2)); // primeira vista: só anota
    await new Promise((r) => setTimeout(r, 40));
    conferir(log.length === 0, "a primeira vez que vê a vaga só anota");
    p.daPagina("quadro", quadro(3)); // saiu mais uma
    await new Promise((r) => setTimeout(r, 60));
    conferir(log.join(" > ") === "Vendidos (2) > Disponíveis (3)", "saiu mais uma vaga: relê os Vendidos e volta (sem Carregar Mais)", log.join(" > "));
    log.length = 0;
    p.daPagina("quadro", { leilaoAtual: "S2", data: { sale: { id: "S2", sold_count: 1 }, sale_product: { title: "Pack 151" } } });
    p.daPagina("quadro", { leilaoAtual: "S2", data: { sale: { id: "S2", sold_count: 2 }, sale_product: { title: "Pack 151" } } });
    await new Promise((r) => setTimeout(r, 60));
    conferir(log.length === 0, "produto que não é batalha: não relê nada");
  }
  {
    // Fora da página da live, não mexe em nada.
    const p = abrirPagina("/seller/dashboard/lives/ABC");
    const vend = botaoFalso("Vendidos (3)");
    p.botoes.push(vend);
    const r = await p.daExtensao({ tipo: "carregar-historico" });
    conferir(r?.ok === false && vend.cliques === 0, "fora da página da live, não clica em nada");
  }
  {
    // O botão do ranking mensal troca a coluna do chat para Ranking: volta.
    const p = abrirPagina("/live/x/y");
    const abas = [];
    const selecionar = (aba) => abas.forEach((a) => (a.selecionado = a === aba));
    const chat = botaoFalso("Chat", null, { role: "tab", selecionado: true, aoClicar: (b) => selecionar(b) });
    const ranking = botaoFalso("Ranking", null, { role: "tab", aoClicar: (b) => selecionar(b) });
    abas.push(chat, ranking);
    const botao = botaoFalso("#7", "Ranking do vendedor: #7", { aoClicar: () => selecionar(ranking) });
    p.botoes.push(botao, chat, ranking);
    const r = await p.daExtensao({ tipo: "atualizar-ranking-mensal" });
    conferir(r?.ok === true && chat.selecionado, "depois de ler o ranking mensal, a coluna volta para o Chat");
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
