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
      querySelectorAll: (sel) => (String(sel).includes("button") ? botoes : []),
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
    // O content.js espera entre um clique e outro nas abas da Jamble.
    setTimeout,
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

  return { enviadas, daPagina, daExtensao, botoes };
}

const botaoFalso = (texto) => {
  let cliques = 0;
  return {
    textContent: texto,
    click() {
      cliques++;
    },
    get cliques() {
      return cliques;
    },
  };
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

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
