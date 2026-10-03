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

  // ---------- Emotions e Chat no estilo da referência ----------
  // Emotions e mensagens como as que chegam numa live, com figurinha e foto.
  {
    const CDN = "https://jamble-test.b-cdn.net/like_icons/";
    const comEmotions = JSON.parse(JSON.stringify(dados));
    const live = comEmotions.lives[LIVE];
    const envio = (id, handle, icone, gemas, seg) => ({ id, handle, nome: handle, icone, gemas, ts: 1791050000000 + seg * 1000 });
    live.emocoes = [
      envio("e1", "diniztcg", "magikarp_shiny", 500, 1),
      envio("e2", "diniztcg", "pixel_heart", 10, 2),
      envio("e3", "diniztcg", "pixel_heart", 10, 3),
      envio("e4", "ana", "pixel_heart", 10, 4),
      envio("e5", "ana", "charmander", 60, 5),
    ];
    live.chat.msgs = [
      { id: "c1", handle: "samantaavila", nome: "samanta", texto: "boa noite!", ts: 1791050010000 },
      { id: "c2", handle: "massaruokada", nome: "massaru", texto: "<b>quanto</b> o lote?", ts: 1791050020000 },
    ];
    comEmotions.iconesEmocoes = { magikarp_shiny: CDN + "magikarp_shiny.png", pixel_heart: CDN + "pixel_heart.png" };
    comEmotions.nomesEmocoes = { magikarp_shiny: "Carpa Zika" };
    comEmotions.fotos = { diniztcg: "https://jamble.b-cdn.net/profiles/user_id=u9/profile_images/a.png" };

    const q = abrirPainel({ busca: `?embutido=1&live=${LIVE}`, dados: comEmotions });
    await q.espera();
    q.ctx.mostrarAba("vivo");
    await q.espera();
    conferir(q.el("#aviso").textContent === "", "Ao vivo com emotions e chat: desenha sem erro", q.el("#aviso").textContent);
    conferir(/^5 recebidas/.test(q.texto("#emoTotal")), "Emotions: quantas recebidas", q.texto("#emoTotal"));

    const pilulas = q.el("#emoPilulas").innerHTML;
    const ordem = [...pilulas.matchAll(/data-icone="(\w+)"/g)].map((m) => m[1]);
    conferir(ordem.join() === "pixel_heart,magikarp_shiny,charmander", "uma pílula por ícone, do mais mandado para o menos", ordem.join());
    conferir(pilulas.includes(`src="${CDN}pixel_heart.png"`) && /pixel_heart <b>3<\/b>/.test(pilulas), "a pílula tem a figurinha e a quantidade", pilulas.slice(0, 160));
    conferir(/Carpa Zika <b>1<\/b>/.test(pilulas), "com o nome bonito quando a Jamble manda");

    const feed = q.el("#emoFeed").innerHTML;
    const linhasFeed = feed.split('class="linha-feed"').length - 1;
    conferir(linhasFeed === 5, "a lista ao vivo tem uma linha por envio", String(linhasFeed));
    conferir(feed.indexOf("@ana") < feed.indexOf("@diniztcg"), "o envio mais novo vem primeiro");
    conferir(feed.includes('class="avatar" src="https://jamble.b-cdn.net/profiles/user_id=u9'), "com a foto de quem mandou");
    conferir(feed.includes('class="avatar letra"'), "sem foto, a inicial no lugar");

    // Clicar na pílula do coração mostra só os corações.
    q.el("#emoPilulas").ouvintes.click[0]({ target: { closest: () => ({ dataset: { icone: "pixel_heart" } }) } });
    await q.espera();
    const filtrado = q.el("#emoFeed").innerHTML;
    conferir(filtrado.split('class="linha-feed"').length - 1 === 3, "clicar numa pílula filtra a lista por aquele ícone");
    conferir(/class="pilula ativa" data-icone="pixel_heart"/.test(q.el("#emoPilulas").innerHTML), "e a pílula escolhida fica destacada");
    q.el("#emoPilulas").ouvintes.click[0]({ target: { closest: () => ({ dataset: { icone: "pixel_heart" } }) } });
    await q.espera();
    conferir(q.el("#emoFeed").innerHTML.split('class="linha-feed"').length - 1 === 5, "clicar de novo volta a mostrar todos");

    const chat = q.el("#chatFeed").innerHTML;
    conferir(chat.indexOf("quanto") < chat.indexOf("boa noite"), "Chat: a mensagem mais nova vem primeiro");
    conferir(chat.includes("boa noite!") && chat.includes("@samantaavila"), "Chat: o que a pessoa escreveu, com o @");
    conferir(chat.includes("&lt;b&gt;quanto&lt;/b&gt;") && !chat.includes("<b>quanto"), "Chat: o texto entra escapado");
    conferir(/21 mensagens/.test(q.texto("#chatTotal")), "Chat: quantas mensagens", q.texto("#chatTotal"));
    conferir(/vbpracima/.test(q.el("#t-compras tbody").innerHTML) && /750/.test(q.el("#t-compras tbody").innerHTML), "Ranking de compras: quem levou e quanto");
    conferir(/pixel_heart\.png/.test(q.el("#t-ranking-vivo tbody").innerHTML) && /×2/.test(q.el("#t-ranking-vivo tbody").innerHTML), "Ranking de gemas: a figurinha com a quantidade do lado");
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
