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
function abrirPagina(caminho, larguraJanela = 1400) {
  const corpo = [];
  const gravacoes = [];
  let relogio = null;

  const criar = (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      id: "",
      style: { cssText: "", display: "", width: "" },
      children: [],
      textContent: "",
      title: "",
      type: "",
      src: "",
      addEventListener() {},
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
      },
      querySelector(sel) {
        const tagAlvo = sel.replace(/[^a-z]/g, "").toUpperCase();
        return el.children.find((c) => c.tagName === tagAlvo) ?? null;
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
      getElementById: (id) => body.children.find((c) => c.id === id) ?? null,
    },
    chrome: {
      runtime: { getURL: (f) => "chrome-extension://falsa/" + f },
      storage: { local: { get: async () => ({}), set: async (o) => gravacoes.push(o) } },
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

  const ctx = vm.createContext(janela);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "overlay.js"), "utf8"), ctx, { filename: "overlay.js" });

  return {
    body,
    gravacoes,
    tick: () => relogio && relogio(),
    acha: (id) => body.children.find((c) => c.id === id) ?? null,
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

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
