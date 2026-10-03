// Teste do painel: rode com `node extensao-ranking/teste-painel.js`.
// Roda o painel.js de verdade, com um DOM de mentira, e confere o que ele
// escreve na tela -- inclusive que nenhuma aba quebra ao desenhar.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

class Elemento {
  constructor(nome, dados = {}) {
    this.nome = nome;
    this.textContent = "";
    this.innerHTML = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.style = {};
    this.dataset = { ...dados };
    this.options = [];
    this.offsetWidth = 0;
    this.ouvintes = {};
    const classes = new Set();
    this.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, ligar = !classes.has(c)) => (ligar ? classes.add(c) : classes.delete(c), ligar),
      lista: () => [...classes],
    };
  }
  addEventListener(tipo, fn) {
    (this.ouvintes[tipo] = this.ouvintes[tipo] || []).push(fn);
  }
  click() {
    for (const fn of this.ouvintes.click || []) fn({ preventDefault() {} });
  }
  closest() {
    return (this._perto = this._perto || new Elemento(this.nome + " (perto)"));
  }
  get parentElement() {
    return (this._pai = this._pai || new Elemento(this.nome + " (pai)"));
  }
}

const ABAS = ["vivo", "leiloes", "batalha", "clientes"];

function abrirPainel({ busca = "", guardado = {}, dados = null } = {}) {
  const elementos = new Map();
  const el = (sel) => {
    if (!elementos.has(sel)) elementos.set(sel, new Elemento(sel));
    return elementos.get(sel);
  };
  const botoes = ABAS.map((a) => new Elemento("botao " + a, { aba: a }));
  const secoes = ABAS.map((a) => new Elemento("secao " + a, { aba: a }));
  const body = new Elemento("body");
  const armazenado = new Map(Object.entries(guardado));
  const ouvintesJanela = {};

  const janela = {
    document: {
      body,
      activeElement: null,
      querySelector(sel) {
        const m = String(sel).match(/^#abas button\[data-aba="(\w+)"\]$/);
        if (m) return botoes.find((b) => b.dataset.aba === m[1]) ?? null;
        return el(sel);
      },
      querySelectorAll(sel) {
        if (sel === "#abas button") return botoes;
        if (sel === "#abas button, section[data-aba]") return [...botoes, ...secoes];
        return [];
      },
      createElement: (t) => new Elemento(t),
    },
    location: { search: busca },
    localStorage: {
      getItem: (k) => (armazenado.has(k) ? armazenado.get(k) : null),
      setItem: (k, v) => armazenado.set(k, String(v)),
    },
    addEventListener: (tipo, fn) => (ouvintesJanela[tipo] = ouvintesJanela[tipo] || []).push(fn),
    URLSearchParams,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout,
    clearTimeout,
    confirm: () => false,
    console,
    __teste: dados,
  };
  janela.window = janela;
  janela.self = janela;
  const ctx = vm.createContext(janela);
  for (const arquivo of ["gemas.js", "analises.js", "painel.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, arquivo), "utf8"), ctx, { filename: arquivo });
  }
  return {
    ctx,
    body,
    el,
    botoes,
    secoes,
    armazenado,
    tecla: (key) => {
      for (const fn of ouvintesJanela.keydown || []) fn({ key, preventDefault() {} });
    },
    espera: () => new Promise((r) => setTimeout(r, 50)),
    // O real formatado usa um espaço que não quebra depois do R$; aqui vira
    // espaço comum, para comparar com o texto escrito no teste.
    texto: (sel) => el(sel).textContent.replace(/\s/g, " "),
  };
}

(async () => {
  // ---------- modo transmissão não vale dentro da live ----------
  // 03/10: o modo ficou guardado de quando ela usou a aba separada, e o painel
  // dentro da live abriu sem abas, sem botões e sem rodapé.
  {
    const p = abrirPainel({ busca: "?embutido=1&live=X", guardado: { transmissao: "1" } });
    await p.espera();
    conferir(p.body.classList.contains("embutido"), "dentro da live: layout de faixa");
    conferir(!p.body.classList.contains("transmissao"), "dentro da live, o modo transmissão guardado não liga", p.body.classList.lista().join(","));
    p.tecla("Escape");
    conferir(p.armazenado.get("transmissao") === "1", "e não apaga a escolha guardada da aba separada");
  }
  {
    const p = abrirPainel({ guardado: { transmissao: "1" } });
    await p.espera();
    conferir(p.body.classList.contains("transmissao"), "na aba separada, o modo transmissão guardado continua valendo");
    p.tecla("Escape");
    conferir(!p.body.classList.contains("transmissao") && p.armazenado.get("transmissao") === "", "e o Esc sai dele");
  }

  // ---------- cada aba desenha sem quebrar, com dado de verdade ----------
  // demo-abas.json: frames reais da live do @pokerusbr (03/10/2026) passados
  // pelo inject.js e pelo background.js.
  const dados = JSON.parse(fs.readFileSync(path.join(__dirname, "teste-painel-dados.json"), "utf8"));
  const LIVE = Object.keys(dados.lives)[0];
  const p = abrirPainel({ busca: `?embutido=1&live=${LIVE}`, dados });
  await p.espera();
  for (const aba of ABAS) {
    p.ctx.mostrarAba(aba);
    await p.espera();
    conferir(p.el("#aviso").textContent === "", `aba ${aba}: desenha sem erro`, p.el("#aviso").textContent);
    conferir(
      p.secoes.find((s) => s.dataset.aba === aba).classList.contains("ativa") &&
        p.secoes.filter((s) => s.classList.contains("ativa")).length === 1,
      `aba ${aba}: só ela fica à mostra`,
    );
  }
  conferir(p.body.dataset.aba === "clientes", "o corpo sabe qual aba está aberta (o rodapé depende disso)");

  conferir(p.texto("#c-faturamento") === "R$ 5.913,00", "Ao vivo: faturamento", p.texto("#c-faturamento"));
  conferir(p.texto("#l-faturado") === "R$ 1.942,00", "Leilões: vendido em leilão + compra direta", p.texto("#l-faturado"));
  conferir(p.el("#l-vendidos").textContent === "9", "Leilões: 9 itens", p.el("#l-vendidos").textContent);
  conferir(/vbpracima/.test(p.el("#t-leiloes tbody").innerHTML), "Leilões: quem levou aparece na lista");
  conferir(/samantaavila/.test(p.el("#t-disputas tbody").innerHTML), "Leilões: quem disputou e perdeu aparece");
  conferir(p.el("#b-v-pts").textContent === "23.970" && p.el("#b-a-pts").textContent === "23.640", "Batalha: placar", `${p.el("#b-v-pts").textContent} x ${p.el("#b-a-pts").textContent}`);
  conferir(p.el("#ch-total").textContent === "21", "Chat: 21 mensagens", p.el("#ch-total").textContent);
  conferir(/#7 com 294\.409/.test(p.el("#rm-voce").textContent), "Clientes: posição no ranking mensal", p.el("#rm-voce").textContent);
  conferir(/@vbpracima/.test(p.el("#t-clientes tbody").innerHTML), "Clientes: lista de clientes");
  conferir(!p.botoes[1].innerHTML.includes("bolinha"), "sem venda rolando, a aba Leilões fica sem bolinha", p.botoes[1].innerHTML);

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
