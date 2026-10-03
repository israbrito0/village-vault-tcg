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

const ABAS = ["vivo", "leiloes", "batalha", "clientes", "etb"];

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
  conferir(p.body.dataset.aba === ABAS[ABAS.length - 1], "o corpo sabe qual aba está aberta (o rodapé depende disso)", p.body.dataset.aba);

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

  // ---------- live do @exclusive: compra de 3 unidades vale 3 ----------
  // A linha da compra de 3 mostrava R$ 149 (o preço de uma) e parecia que só
  // uma tinha contado.
  const H2 = require("./amostras-historico.js");
  const comExclusive = JSON.parse(JSON.stringify(dados));
  {
    const live = comExclusive.lives[LIVE];
    live.leiloes = {};
    live.vendidos = {};
    for (const i of H2.VENDIDOS_EXCLUSIVE.items) {
      live.vendidos[i.sold.saleId] = {
        saleId: i.sold.saleId, titulo: i.title, tipo: i.saleType, inicial: i.startingPrice, unidades: i.soldCount,
        preco: i.sold.soldPrice, total: i.sold.totalSoldPrice, comprador: i.sold.buyerUsername, cancelado: false,
        quando: Math.round(i.sold.createdAt * 1000),
      };
    }
    live.vendidosEm = 1791057000000;
    const q = abrirPainel({ busca: `?embutido=1&live=${LIVE}`, dados: comExclusive });
    await q.espera();
    q.ctx.mostrarAba("leiloes");
    await q.espera();
    conferir(q.texto("#l-faturado") === "R$ 1.788,00" && q.el("#l-vendidos").textContent === "12", "exclusive: R$ 1.788 em 12 unidades");
    const linhas = q.el("#t-leiloes tbody").innerHTML.replace(/\s/g, " ").split("<tr>");
    const de3 = linhas.find((l) => /3 vendidas/.test(l));
    conferir(de3 && /R\$ 447,00/.test(de3) && /3 × R\$ 149,00/.test(de3), "a linha da compra de 3 mostra R$ 447 (3 × R$ 149)", de3 && de3.slice(0, 300));
    conferir(!/—R\$/.test(q.el("#t-leiloes tbody").innerHTML.replace(/<[^>]+>/g, "")), "nada de \"—R$\" parecendo número negativo");
    q.ctx.mostrarAba("vivo");
    await q.espera();
    const compras = q.el("#t-compras tbody").innerHTML.replace(/\s/g, " ");
    conferir(/3× 🎟️ DUPLO 30y - BATALHA DO BEM \(R\$ 447,00\)/.test(compras), "no ranking de compras: \"3× ... (R$ 447,00)\"", compras.slice(0, 300));
    conferir(/R\$ 596,00/.test(compras), "e o total da pessoa: R$ 596");
  }

  // ---------- Batalha ETB ----------
  {
    const q = abrirPainel({ busca: `?embutido=1&live=${LIVE}`, dados: JSON.parse(JSON.stringify(comExclusive)) });
    await q.espera();
    q.ctx.mostrarAba("etb");
    await q.espera();
    conferir(q.el("#aviso").textContent === "", "aba Batalha ETB: desenha sem erro", q.el("#aviso").textContent);
    conferir(q.el("#caixa-etb-atual").style.display === "none", "sem batalha ainda: só o formulário de começar");
    conferir(/nº 1/.test(q.el("#etbNovoNumero").textContent), "a próxima será a nº 1");
    const opcoes = q.el("#etbNovoItem").innerHTML;
    conferir(/BATALHA DO BEM · 5 unidades, 3 pessoas/.test(opcoes), "dá para puxar as vagas de quem comprou a batalha", opcoes.slice(0, 200));

    q.el("#etbNovoTitulo").value = "ETB 30 anos";
    q.el("#etbNovoBoosters").value = "9";
    q.el("#etbNovoItem").value = "🎟️ DUPLO 30y - BATALHA DO BEM";
    q.el("#etbCriar").click();
    await q.espera();
    const vagas = q.el("#etbVagas").innerHTML;
    conferir(q.el("#caixa-etb-atual").style.display === "" && /Batalha ETB nº 1 · ETB 30 anos/.test(q.el("#etbTitulo").textContent), "começou a Batalha ETB nº 1", q.el("#etbTitulo").textContent);
    conferir((vagas.match(/data-campo="handle"/g) || []).length === 9, "9 boosters para preencher");
    conferir((vagas.match(/value="israelbrito"/g) || []).length === 3 && /value="drico3dlab"/.test(vagas), "com quem comprou as vagas já nos boosters (3 da israelbrito)");
    conferir((vagas.match(/data-etb-vencedor="\d+"[^>]*>🏆 Vencedor/g) || []).length === 9, "cada booster tem o botão 🏆 Vencedor");

    // Ela escreve o hit no booster 2 (drico3dlab) e clica no 🏆 dele.
    const batalha = Object.values(q.ctx.window.__teste.batalhasETB)[0];
    const slots = batalha.slots.map((s, i) => (i === 1 ? { ...s, hit: "Charizard ex SIR" } : s));
    await q.ctx.etb("salvar", { id: batalha.id, slots });
    // No navegador, o botão clicado fica com o foco, dentro da lista dos
    // boosters: a lista tem que virar a de batalha encerrada mesmo assim.
    q.el("#etbVagas").contains = () => true;
    q.ctx.document.activeElement = { tagName: "BUTTON" };
    q.el("#etbVagas").ouvintes.click.find(Boolean)({ target: { closest: (sel) => (/vencedor/.test(sel) ? { dataset: { etbVencedor: "1" } } : null) } });
    await q.espera();
    conferir(/🏆/.test(q.el("#etbResultado").innerHTML) && /@drico3dlab/.test(q.el("#etbResultado").innerHTML), "o ganhador aparece grande", q.el("#etbResultado").innerHTML.slice(0, 120));
    conferir(/levou a Batalha ETB nº 1 com Charizard ex SIR/.test(q.texto("#etbResultadoHit")), "com o maior hit", q.texto("#etbResultadoHit"));
    conferir(/class="vaga ganhou"/.test(q.el("#etbVagas").innerHTML), "o booster do ganhador fica destacado");
    conferir(/🏆 @drico3dlab/.test(q.el("#t-etb tbody").innerHTML) && /@drico3dlab/.test(q.el("#t-etb-campeoes tbody").innerHTML), "entra no histórico e no ranking de campeões");
    conferir(/nº 2/.test(q.el("#etbNovoNumero").textContent), "a próxima será a nº 2");
  }

  // ---------- Batalha ETB automática (pelo nome do produto) ----------
  {
    const auto = JSON.parse(JSON.stringify(comExclusive));
    auto.batalhasETB = {};
    const A = require("./analises.js");
    const s = A.mudarBatalhaETB(auto.batalhasETB, { acao: "sincronizar", liveId: LIVE, numero: 1, titulo: "Batalha 1 ETB", vagas: ["ana", "bia"], semDono: 2 }, 1);
    A.mudarBatalhaETB(auto.batalhasETB, { acao: "sincronizar", liveId: LIVE, numero: 2, titulo: "Batalha 2 ETB", vagas: ["caio"] }, 2);
    const q = abrirPainel({ busca: `?embutido=1&live=${LIVE}`, dados: auto });
    await q.espera();
    q.ctx.mostrarAba("etb");
    await q.espera();
    conferir(/nº 2/.test(q.el("#etbTitulo").textContent), "mostra a batalha mais nova (nº 2)", q.el("#etbTitulo").textContent);
    conferir(/pelo nome do produto/.test(q.texto("#etbAuto")), "e diz que as vagas vêm do nome do produto", q.texto("#etbAuto"));
    // Clicar na nº 1 da lista mostra a nº 1.
    q.el("#t-etb tbody").ouvintes.click[0]({ target: { closest: (sel) => (/ver/.test(sel) ? { dataset: { etbVer: s.id } } : null) } });
    await q.espera();
    conferir(/nº 1/.test(q.el("#etbTitulo").textContent), "clicar numa batalha da lista mostra ela", q.el("#etbTitulo").textContent);
    conferir(/2 vagas vendidas esperando o nome/.test(q.texto("#etbAuto")), "avisa as vagas vendidas que ainda esperam o @", q.texto("#etbAuto"));
    conferir(/value="ana"/.test(q.el("#etbVagas").innerHTML), "com quem comprou nos boosters");
  }

  // ---------- histórico desde o começo da live ----------
  // A lista Vendidos e o ranking da batalha de verdade (amostras-historico.js),
  // como o background guarda.
  {
    const H = require("./amostras-historico.js");
    const comHist = JSON.parse(JSON.stringify(dados));
    const live = comHist.lives[LIVE];
    live.vendidos = {};
    for (const i of [...H.VENDIDOS_PAGINA_1.items, ...H.VENDIDOS_PAGINA_2.items]) {
      live.vendidos[i.sold.saleId] = {
        saleId: i.sold.saleId,
        titulo: i.title,
        tipo: i.saleType,
        inicial: i.startingPrice,
        unidades: i.soldCount,
        preco: i.sold.soldPrice,
        total: i.sold.totalSoldPrice,
        comprador: i.sold.buyerUsername,
        cancelado: false,
        quando: Math.round(i.sold.createdAt * 1000),
      };
    }
    live.vendidosEm = 1791054100000;
    Object.values(live.batalhas)[0].comecou = 1791047426702;
    live.batalhaRanking = {
      quando: 1791054100000,
      regras: H.BATALHA_PARTICIPANTES.rules.map((r) => ({ icon: r.icon, entryPoints: r.entryPoints })),
      lista: H.BATALHA_PARTICIPANTES.participants.map((x) => ({ handle: x.username, pontos: x.points, time: x.team, posicao: x.rank, premio: x.rewardLabel })),
    };
    const q = abrirPainel({ busca: `?embutido=1&live=${LIVE}`, dados: comHist });
    await q.espera();
    q.ctx.mostrarAba("vivo");
    await q.espera();
    conferir(q.el("#aviso").textContent === "", "com histórico: desenha sem erro", q.el("#aviso").textContent);
    const compras = q.el("#t-compras tbody").innerHTML;
    conferir(/@colecionar_164/.test(compras) && compras.indexOf("@colecionar_164") < compras.indexOf("@vbpracima"), "Compras desde o começo: quem mais comprou em cima");
    conferir(/@leozinthewise/.test(compras), "Compras: compra direta com quem comprou");
    conferir(/lida às/.test(q.texto("#comprasNota")), "diz de quando é a lista Vendidos", q.texto("#comprasNota"));
    const gemas = q.el("#t-ranking-vivo tbody").innerHTML;
    conferir(/≈ 8\.505/.test(gemas) && /@colecionar_164/.test(gemas), "Ranking de gemas: estimativa desde o começo, marcada com ≈", gemas.slice(0, 200));
    conferir(/pela batalha/.test(q.texto("#rankingVivoTotal")), "e diz que é pela batalha", q.texto("#rankingVivoTotal"));

    q.ctx.mostrarAba("leiloes");
    await q.espera();
    conferir(/desde o começo/.test(q.texto("#l-total")), "Leilões: as vendas desde o começo", q.texto("#l-total"));
    conferir(/@leozinthewise/.test(q.el("#t-leiloes tbody").innerHTML), "Leilões: compra direta com quem comprou");

    q.ctx.mostrarAba("batalha");
    await q.espera();
    const rb = q.el("#t-batalha-ranking tbody").innerHTML;
    conferir(q.el("#caixa-batalha-ranking").style.display === "", "Batalha: aparece o ranking desde o começo");
    conferir(/@colecionar_164/.test(rb) && /44\.520/.test(rb) && /vermelho/.test(rb) && /R\$ 25/.test(rb), "com pontos, time e prêmio", rb.slice(0, 200));
  }

  console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
})();
