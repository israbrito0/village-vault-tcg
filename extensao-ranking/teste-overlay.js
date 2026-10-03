// Teste do overlay: rode com `node extensao-ranking/teste-overlay.js`.
// É o pedaço que vive dentro da página da Jamble. Um vazamento aqui fica
// grudado no navegador dela a live inteira.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

// Um DOM de mentira, só com o que o overlay usa.
// `comPaginaDaJamble` põe no corpo um bloco como o da Jamble: preso nas duas
// bordas da janela (position fixed, de ponta a ponta), que é o que o overlay
// precisa recuar para o painel não cobrir o chat.
function abrirPagina(caminho, larguraJanela = 1400, { comPaginaDaJamble = false, aberto = false } = {}) {
  const gravacoes = [];
  let relogio = null;

  const criar = (tag) => {
    const attrs = {};
    const el = {
      tagName: tag.toUpperCase(),
      id: "",
      style: { cssText: "", display: "", width: "", right: "" },
      children: [],
      textContent: "",
      title: "",
      type: "",
      src: "",
      pai: null,
      __pos: "static",
      __rect: { left: 0, width: 0 },
      ouvintes: {},
      addEventListener(tipo, fn) {
        (el.ouvintes[tipo] = el.ouvintes[tipo] || []).push(fn);
      },
      click() {
        for (const fn of el.ouvintes.click || []) fn({ preventDefault() {} });
      },
      setAttribute: (k, v) => (attrs[k] = String(v)),
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      hasAttribute: (k) => k in attrs,
      removeAttribute: (k) => delete attrs[k],
      // A largura acompanha o "right" que o overlay põe, como no navegador.
      getBoundingClientRect: () => {
        const recuo = Number(String(el.style.right || "0").replace("px", "")) || 0;
        return el.__pos === "fixed" && el.__ocupaTudo
          ? { left: 0, width: janela.innerWidth - recuo }
          : el.__rect;
      },
      get isConnected() {
        let p = el;
        while (p) {
          if (p === body) return true;
          p = p.pai;
        }
        return false;
      },
      append(...filhos) {
        for (const f of filhos) {
          f.pai = el;
          el.children.push(f);
        }
      },
      appendChild(f) {
        f.pai = el;
        el.children.push(f);
      },
      remove() {
        const i = el.pai?.children.indexOf(el);
        if (i >= 0) el.pai.children.splice(i, 1);
        el.pai = null;
      },
      querySelector(sel) {
        const tagAlvo = sel.replace(/[^a-z]/g, "").toUpperCase();
        return el.children.find((c) => c.tagName === tagAlvo) ?? null;
      },
      querySelectorAll() {
        const todos = [];
        const andar = (n) => {
          for (const c of n.children) {
            todos.push(c);
            andar(c);
          }
        };
        andar(el);
        return todos;
      },
    };
    return el;
  };

  const body = criar("body");
  const janela = {
    innerWidth: larguraJanela,
    location: { pathname: caminho },
    document: {
      body,
      createElement: criar,
      getElementById: (id) => body.querySelectorAll().find((c) => c.id === id) ?? null,
      querySelectorAll: (sel) => {
        const m = String(sel).match(/^\[([\w-]+)\]$/);
        return m ? body.querySelectorAll().filter((c) => c.hasAttribute(m[1])) : [];
      },
    },
    getComputedStyle: (el) => ({ position: el.__pos }),
    chrome: {
      runtime: { getURL: (f) => "chrome-extension://falsa/" + f },
      storage: {
        local: {
          get: async () => (aberto ? { overlay: { aberto: true, largura: 400 } } : {}),
          set: async (o) => gravacoes.push(o),
        },
      },
    },
    idDaLive: (p) => (String(p).match(/^\/live\/[^/]+\/([\w-]+)/) || [])[1] || null,
    setInterval: (fn) => {
      relogio = fn;
      return 1;
    },
    setTimeout,
    clearTimeout,
    console,
  };
  janela.window = janela;
  janela.self = janela;

  // O bloco da Jamble, com o "right" que ela mesma usa (zero).
  let paginaJamble = null;
  if (comPaginaDaJamble) {
    paginaJamble = criar("div");
    paginaJamble.__pos = "fixed";
    paginaJamble.__ocupaTudo = true;
    paginaJamble.style.right = "0px";
    body.append(paginaJamble);
  }

  const ctx = vm.createContext(janela);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "overlay.js"), "utf8"), ctx, { filename: "overlay.js" });

  return {
    body,
    janela,
    gravacoes,
    paginaJamble,
    tick: () => relogio && relogio(),
    acha: (id) => body.querySelectorAll().find((c) => c.id === id) ?? null,
    espera: () => new Promise((r) => setTimeout(r, 30)),
  };
}

(async () => {
  // ---------- numa página de live, aparece o botão ----------
  {
    const p = abrirPagina("/live/coutotcg/ABC123");
    await p.espera();
    conferir(!!p.acha("vv-painel-botao"), "o botão aparece na página da live");
    conferir(!!p.acha("vv-painel-ao-lado"), "e a faixa do painel");
    const caixa = p.acha("vv-painel-ao-lado");
    conferir(caixa.style.display === "none", "começa fechada");
    conferir(!caixa.querySelector("iframe"), "e sem carregar o painel antes de abrir");
  }

  // ---------- fora de live, não encosta em nada ----------
  {
    const p = abrirPagina("/account/purchases");
    await p.espera();
    conferir(!p.acha("vv-painel-botao"), "fora de live não põe botão nenhum");
    conferir(p.body.children.length === 0, "nem deixa nada no corpo da página", String(p.body.children.length));
  }

  // ---------- a capa de arrasto não pode se acumular ----------
  {
    const p = abrirPagina("/live/x/ABC");
    await p.espera();
    const capas = () => p.body.children.filter((c) => c.id === "vv-painel-capa").length;
    conferir(capas() === 1, "uma capa de arrasto", String(capas()));
    // volta e meia o React da Jamble limpa a página: o overlay remonta
    p.acha("vv-painel-ao-lado").remove();
    p.tick();
    p.acha("vv-painel-ao-lado").remove();
    p.tick();
    conferir(capas() === 1, "remontar não acumula capa", String(capas()));
  }

  // ---------- gravação só quando muda ----------
  {
    const p = abrirPagina("/live/x/ABC");
    await p.espera();
    const antes = p.gravacoes.length;
    p.tick();
    p.tick();
    p.tick();
    conferir(p.gravacoes.length === antes, "o relógio de 2s não fica gravando à toa", `${antes} -> ${p.gravacoes.length}`);
  }

  // ---------- a largura nunca passa de metade da janela ----------
  {
    const p = abrirPagina("/live/x/ABC", 700);
    await p.espera();
    const caixa = p.acha("vv-painel-ao-lado");
    const largura = Number(String(caixa.style.width).replace("px", ""));
    conferir(largura <= 350, "em janela estreita o painel não cobre a live", String(largura));
  }

  // ---------- abrir espaco: o painel nao pode cobrir o chat ----------
  // A pagina da live e um bloco preso nas duas bordas, com produtos, video e
  // chat. Medido em 1280px: o chat vai de 913 a 1256 -- um painel encostado
  // por cima cobriria ele inteiro. Com o painel aberto, a borda direita do
  // bloco recua e a Jamble reacomoda as tres colunas no que sobra.
  {
    const p = abrirPagina("/live/x/ABC", 1400, { comPaginaDaJamble: true, aberto: true });
    await p.espera();
    p.tick();
    const pag = p.paginaJamble;
    conferir(pag.style.right === "400px", "aberto: a pagina da Jamble recua a largura do painel", pag.style.right);
    conferir(pag.getAttribute("data-vv-recuado") === "0px", "e guarda como era, para devolver", String(pag.getAttribute("data-vv-recuado")));

    // fechar devolve a pagina como era
    p.acha("vv-painel-botao").click();
    conferir(pag.style.right === "0px", "fechado: a pagina volta ao tamanho dela", pag.style.right);
    conferir(!pag.hasAttribute("data-vv-recuado"), "e nao fica marca para tras");

    // abrir de novo recua de novo
    p.acha("vv-painel-botao").click();
    conferir(pag.style.right === "400px", "reabrindo, recua de novo", pag.style.right);

    // sair da live: tudo volta
    p.janela.location.pathname = "/account/purchases";
    p.tick();
    conferir(pag.style.right === "0px", "saindo da live a pagina volta ao normal", pag.style.right);
    conferir(!p.acha("vv-painel-botao"), "e o botao some");
  }

  // A Jamble remonta a pagina ao trocar de live: o bloco novo tambem recua.
  {
    const p = abrirPagina("/live/x/ABC", 1400, { comPaginaDaJamble: true, aberto: true });
    await p.espera();
    p.tick();
    p.paginaJamble.remove();
    const novo = p.janela.document.createElement("div");
    novo.__pos = "fixed";
    novo.__ocupaTudo = true;
    novo.style.right = "0px";
    p.body.append(novo);
    // a busca pela pagina inteira e cara, entao so roda a cada 5s
    await new Promise((r) => setTimeout(r, 5100));
    p.tick();
    conferir(novo.style.right === "400px", "pagina remontada tambem recua", novo.style.right);
  }

  // Fechado, nao mexe em nada da Jamble.
  {
    const p = abrirPagina("/live/x/ABC", 1400, { comPaginaDaJamble: true, aberto: false });
    await p.espera();
    p.tick();
    conferir(p.paginaJamble.style.right === "0px", "com o painel fechado a pagina fica intacta", p.paginaJamble.style.right);
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
