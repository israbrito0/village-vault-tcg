// Painel da live: quantas gemas cada pessoa enviou, ao vivo, e o sorteio em
// cima disso. Tudo local -- nada daqui vai para o site.
//
// De onde vem cada número (a extensão só lê o que a página da Jamble já pediu;
// não inventa conta nem chama endereço nenhum por fora):
//   /api/seller/show-participation  -> painel do vendedor, aba Participação
//   /api/live/participation         -> a mesma coisa, pela página da live
//   /api/live/emojis                -> quanto cada ícone custa em gemas
//
// O "ao vivo" sai da comparação entre uma leitura e a seguinte: quem subiu de
// gemas, enviou. Quem faz essa conta é o gemas.js.

const $ = (s) => document.querySelector(s);

// Nome e @ vêm do que o espectador escreveu no perfil dele, e o título vem do
// que o vendedor escreveu. Tudo isso entra em HTML aqui, então tem que ser
// escapado: esta página é da extensão e enxerga o chrome.storage (onde mora o
// token do site). Um nome com <img onerror=...> não pode virar código.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const num = (n) => Math.round(n).toLocaleString("pt-BR");
const reais = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

let sorteios = [];
let ordem = "gemas";
let liveEscolhida = null; // null = deixa o painel escolher sozinho

// Pode haver mais de uma live guardada (a dela e a que ela abriu para ver o
// ranking). A boa é a do painel do vendedor; entre as do mesmo tipo, a mais
// recente. O seletor em cima deixa trocar na mão.
function escolherLive(lives) {
  const todas = Object.values(lives ?? {});
  if (!todas.length) return null;
  if (liveEscolhida && lives[liveEscolhida]) return lives[liveEscolhida];
  return todas.sort((a, b) => (b.doPainel ? 1 : 0) - (a.doPainel ? 1 : 0) || b.quando - a.quando)[0];
}

// Fora da extensão (servindo a pasta só para conferir a tela) não existe
// chrome.storage: aí usa o que estiver em window.__teste, se alguém pôs.
const temStorage = typeof chrome !== "undefined" && chrome.storage?.local;

async function ler() {
  const g = temStorage
    ? await chrome.storage.local.get(["lives", "tabelaEmocoes", "nomesEmocoes"])
    : window.__teste ?? {};
  const lives = g.lives ?? {};
  const live = escolherLive(lives);
  // Sorteio é de uma live: trocar de live não leva os ganhadores junto.
  sorteios = live?.sorteios ?? [];
  return {
    lives,
    p: live,
    titulo: live?.titulo || "",
    eventos: live?.eventos ?? [],
    emocoes: live?.emocoes ?? [],
    tabela: g.tabelaEmocoes ?? {},
    nomes: g.nomesEmocoes ?? {},
  };
}

// Mexer no que é de uma live passa pelo background, que é quem grava, para
// duas gravações não se atropelarem.
async function mexer(id, acao, extra = {}) {
  if (!id) return false;
  if (temStorage) {
    const r = await chrome.runtime.sendMessage({ tipo: "mexer-na-live", id, acao, ...extra }).catch(() => null);
    return !!r?.ok;
  }
  const live = window.__teste?.lives?.[id];
  if (!live) return false;
  if (acao === "zerar-ao-vivo") live.eventos = [];
  else if (acao === "sortear") live.sorteios = (live.sorteios ?? []).concat(extra.sorteio);
  else if (acao === "limpar-sorteios") live.sorteios = [];
  return true;
}

function linhas(tbody, dados, montar, colunas) {
  tbody.innerHTML = "";
  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="${colunas}" class="vazio">nada ainda</td></tr>`;
    return;
  }
  for (const d of dados) tbody.insertAdjacentHTML("beforeend", montar(d));
}

// "magikarp_shiny" vira "Carpa Zika" quando a tabela da Jamble ja passou.
const CARPA = "magikarp_shiny";
const nomeIcone = (id, nomes) => (nomes && nomes[id]) || id;

const PORORDEM = {
  gemas: (a, b) => b.gemas - a.gemas,
  pontos: (a, b) => b.pontos - a.pontos,
  gastou: (a, b) => b.gastou - a.gastou,
};

async function pintar() {
  const { lives, p, titulo, eventos, emocoes, tabela, nomes } = await ler();
  const em = resumirEmocoes(emocoes);
  const linhasP = p?.linhas ?? [];
  // O preço da carpa vem da tabela da própria Jamble quando ela já passou por
  // aqui; os 500 só valem até a primeira leitura. Assim, se eles mudarem o
  // preço, o painel acompanha sozinho.
  const porCarpa = Number(tabela?.magikarp_shiny) || GEMAS_POR_CARPA;
  const r = resumirGemas(linhasP);

  // Só mostra o seletor quando existe mais de uma live para escolher.
  const outras = Object.values(lives);
  const cx = $("#qualLive");
  cx.style.display = outras.length > 1 ? "" : "none";
  if (outras.length > 1 && document.activeElement !== cx) {
    const ordenadas = outras.sort((a, b) => b.quando - a.quando);
    const novo = ordenadas
      .map(
        (l) =>
          `<option value="${esc(l.id)}">${l.doPainel ? "★ " : ""}${esc(String(l.titulo || l.id).slice(0, 40))}</option>`,
      )
      .join("");
    if (cx.innerHTML !== novo) cx.innerHTML = novo;
    cx.value = p?.id ?? "";
  }

  $("#titulo").textContent = titulo || "Painel da live";
  $("#periodo").textContent = p
    ? `${p.aoVivo ? "● ao vivo" : "encerrada"} · lido às ${hora(p.quando)}` +
      (p.doPainel ? "" : " · live de outra pessoa")
    : "abra a sua live no painel da Jamble, na aba Participação";
  $("#periodo").classList.toggle("vivo", !!p?.aoVivo);

  $("#c-gemas").textContent = num(r.gemas);
  // As emotions sabem a hora exata de cada envio; a participação só sabe
  // quando foi lida. Quando houver emotion, ela manda.
  const fonteRecente = emocoes.length ? emocoes : eventos;
  $("#c-recentes").textContent = num(gemasRecentes(fonteRecente, 5 * 60 * 1000));
  $("#c-carpas").textContent = num(r.gemas / porCarpa);
  $("#c-pontos").textContent = num(r.pontos);
  $("#c-enviaram").textContent = `${num(r.enviaram)}/${num(r.pessoas)}`;
  $("#c-comprado").textContent = reais(r.comprado);

  const ordenado = linhasP.slice().sort(PORORDEM[ordem] ?? PORORDEM.gemas);
  linhas(
    $("#t-ranking tbody"),
    ordenado.slice(0, 80).map((l, i) => ({ i: i + 1, ...l })),
    (d) =>
      `<tr><td>${d.i}</td><td>${esc(d.nome)} <span class="fraco">@${esc(d.handle)}</span></td>` +
      `<td class="n gema">${d.gemas ? num(d.gemas) : "—"}</td>` +
      `<td class="n">${d.gastou ? reais(d.gastou) : "—"}</td>` +
      `<td class="n">${num(d.mensagens)}</td><td class="n forte">${num(d.pontos)}</td></tr>`,
    6,
  );

  // O feed prefere as emotions: elas sabem o icone e chegam na hora do envio.
  // Sem elas, cai para a diferenca entre leituras da participacao, que so sabe
  // o total de gemas de cada um.
  const temEmocoes = emocoes.length > 0;
  linhas(
    $("#t-feed tbody"),
    (temEmocoes ? emocoes : eventos).slice(-60).reverse(),
    (e) =>
      `<tr><td>${hora(e.ts)}</td><td>${esc(e.nome)} <span class="fraco">@${esc(e.handle)}</span></td>` +
      `<td>${temEmocoes ? esc(nomeIcone(e.icone, nomes)) : "—"}</td>` +
      `<td class="n gema forte">+${num(e.gemas)}</td></tr>`,
    4,
  );

  // Contagem por icone: quantos de cada um, e quanto deu em gemas.
  $("#caixa-icones").style.display = em.porIcone.length ? "" : "none";
  linhas(
    $("#t-icones tbody"),
    em.porIcone,
    (d) =>
      `<tr><td>${esc(nomeIcone(d.icone, nomes))} <span class="fraco">${esc(d.icone)}</span></td>` +
      `<td class="n forte">${num(d.qtd)}</td><td class="n gema">${num(d.gemas)}</td></tr>`,
    3,
  );

  linhas(
    $("#t-sorteios tbody"),
    sorteios.slice().reverse(),
    (s) => `<tr><td>${hora(s.ts)}</td><td>@${esc(s.ganhador)}</td><td>${num(s.entre)} pessoas</td></tr>`,
    3,
  );

  // As opções do sorteio saem do que de fato apareceu: só oferece "quem mandou
  // carpa" se alguém mandou carpa. A carpa vem primeiro quando existe.
  const cxSorteio = $("#quemSorteia");
  if (document.activeElement !== cxSorteio) {
    const porIcone = em.porIcone.slice().sort((x, y) => (y.icone === CARPA) - (x.icone === CARPA) || y.qtd - x.qtd);
    const opcoes = [
      ...porIcone.map((i) => `<option value="icone:${esc(i.icone)}">quem mandou ${esc(nomeIcone(i.icone, nomes))} (${num(i.qtd)})</option>`),
      em.total ? `<option value="emotion">quem mandou qualquer emotion (${num(em.porPessoa.length)})</option>` : "",
      `<option value="gemas">quem enviou gemas, a live toda</option>`,
      `<option value="todos">todo mundo da live</option>`,
    ].join("");
    if (cxSorteio.innerHTML !== opcoes) {
      const antes = cxSorteio.value;
      cxSorteio.innerHTML = opcoes;
      if (antes && [...cxSorteio.options].some((o) => o.value === antes)) cxSorteio.value = antes;
    }
  }

  // Número velho enganando é pior do que número nenhum: se a leitura parou de
  // chegar enquanto o "atualizar sozinho" está ligado, avisa em vez de deixar
  // a tela parecer viva.
  const parado = p && Number($("#intervalo").value) > 0 ? Date.now() - p.quando : 0;
  $("#avisoVelho").textContent =
    parado > 150000
      ? `Estes números são de ${hora(p.quando)} e não chegou leitura nova desde então. ` +
        `Confira se a aba da Jamble com a participação continua aberta.`
      : "";

  const quantos = Object.keys(tabela).length;
  $("#rodape").textContent = p
    ? `A Jamble entrega quantas gemas cada pessoa enviou no total, mas não diz qual ícone foi. ` +
      `"Carpas" aqui é o total de gemas dividido por ${num(porCarpa)} (o preço da Carpa Zika), ` +
      `então é equivalência, não contagem carpa a carpa.` +
      (quantos ? ` Tabela de preços lida da Jamble: ${quantos} ícones.` : "") +
      (eventos.length
        ? ""
        : ` O "ao vivo" começa a encher na segunda leitura: a primeira serve de ponto de partida.`)
    : "";
}

// ---------- atualizar ----------

let relogio = null;

async function atualizarAgora(silencioso) {
  if (!temStorage) return;
  const r = await chrome.runtime.sendMessage({ tipo: "atualizar-participacao" }).catch(() => null);
  if (!silencioso || !r?.ok) {
    $("#aviso").textContent = r?.ok
      ? ""
      : "Não achei a aba da Jamble com a participação aberta. Abra a sua live (painel do vendedor → Lives → a live → Participação, ou a própria página da live) e deixe a aba aberta.";
  }
}

function ligarRelogio() {
  if (relogio) clearInterval(relogio);
  const seg = Number($("#intervalo").value);
  if (!seg) return;
  relogio = setInterval(() => atualizarAgora(true), seg * 1000);
}

$("#atualizar").addEventListener("click", async () => {
  const b = $("#atualizar");
  const antes = b.textContent;
  b.disabled = true;
  b.textContent = "lendo…";
  await atualizarAgora(false);
  setTimeout(() => {
    b.disabled = false;
    b.textContent = antes;
    pintar();
  }, 2500);
});

$("#intervalo").addEventListener("change", () => {
  localStorage.setItem("intervalo", $("#intervalo").value);
  ligarRelogio();
});

$("#ordem").addEventListener("change", () => {
  ordem = $("#ordem").value;
  pintar();
});

$("#qualLive").addEventListener("change", () => {
  liveEscolhida = $("#qualLive").value || null;
  pintar();
});

// ---------- sorteio ----------

async function sortear() {
  const { p, emocoes, tabela, nomes } = await ler();
  const porCarpa = Number(tabela?.magikarp_shiny) || GEMAS_POR_CARPA;
  const escolha = $("#quemSorteia").value || "gemas";
  const comPeso = $("#peso").checked;
  const semRepetir = $("#semRepetir").checked;

  // Tres fontes possiveis, e cada uma cobre uma coisa diferente:
  //  icone:<id>  e  emotion  -> eventos LIKE, sabem QUAL icone, mas so valem o
  //                             tempo em que a aba da live ficou aberta
  //  gemas / todos          -> participacao da Jamble, cobre a live inteira,
  //                             mas so sabe o total de gemas de cada pessoa
  let candidatos, peso, descricaoFonte;
  if (escolha === "emotion" || escolha.startsWith("icone:")) {
    const icone = escolha.startsWith("icone:") ? escolha.slice(6) : null;
    candidatos = quemMandou(emocoes, icone).map((c) => ({ ...c, rotulo: `${c.qtd}x` }));
    peso = (c) => c.qtd;
    descricaoFonte = icone ? `quem mandou ${nomeIcone(icone, nomes)}` : "quem mandou emotion";
  } else {
    const soGemas = escolha === "gemas";
    candidatos = (p?.linhas ?? [])
      .filter((l) => l.handle && (!soGemas || l.gemas > 0))
      .map((l) => ({ ...l, rotulo: `${num(l.gemas)} gemas` }));
    peso = (c) => Math.max(1, Math.round(c.gemas / porCarpa));
    descricaoFonte = soGemas ? "quem enviou gemas" : "todo mundo da live";
  }

  if (semRepetir) {
    const jaGanharam = new Set(sorteios.map((s) => s.ganhador));
    const sobra = candidatos.filter((c) => !jaGanharam.has(c.handle));
    if (sobra.length) candidatos = sobra;
  }

  if (!candidatos.length) {
    $("#ganhador").textContent = "";
    $("#detalheSorteio").textContent =
      escolha.startsWith("icone:") || escolha === "emotion"
        ? "Ninguém mandou essa emotion enquanto o painel esteve aberto."
        : "Ainda não tenho a participação desta live.";
    return;
  }

  const bilhetes = [];
  for (const c of candidatos) {
    const n = comPeso ? peso(c) : 1;
    for (let k = 0; k < n; k++) bilhetes.push(c);
  }
  const ganho = bilhetes[Math.floor(Math.random() * bilhetes.length)];

  await mexer(p.id, "sortear", {
    sorteio: { ts: Date.now(), ganhador: ganho.handle, entre: candidatos.length, fonte: descricaoFonte, comPeso },
  });

  $("#ganhador").textContent = "@" + ganho.handle;
  $("#detalheSorteio").textContent =
    `${ganho.rotulo} · sorteado entre ${candidatos.length} (${descricaoFonte})` +
    (comPeso ? " · quem mandou mais, mais chance" : " · chance igual") +
    (semRepetir ? " · sem repetir" : "");
  pintar();
}

$("#sortear").addEventListener("click", sortear);

$("#limparSorteios").addEventListener("click", async () => {
  const { p } = await ler();
  await mexer(p?.id, "limpar-sorteios");
  $("#ganhador").textContent = "";
  $("#detalheSorteio").textContent = "";
  pintar();
});

// Para rodar um segundo sorteio contando só o que vier daqui em diante
// (a segunda hora da live, por exemplo). Os totais continuam: o que zera é a
// lista do "ao vivo", e as próximas comparações partem de onde está agora.
$("#zerarAoVivo").addEventListener("click", async () => {
  const { p } = await ler();
  if (!p) return;
  if (!confirm(`Zerar a lista "Gemas ao vivo" desta live? Os totais continuam como estão.`)) return;
  await mexer(p.id, "zerar-ao-vivo");
  pintar();
});

$("#imprimir").addEventListener("click", () => window.print());

// ---------- modo transmissão ----------
// Deixa a aba só com os números, para pegar no OBS com "Captura de janela".
// O sorteio continua funcionando: o ganhador aparece grande na tela.

function transmissao(ligado) {
  document.body.classList.toggle("transmissao", ligado);
  localStorage.setItem("transmissao", ligado ? "1" : "");
}

$("#transmitir").addEventListener("click", () => transmissao(true));
$("#sairTransmissao").addEventListener("click", () => transmissao(false));
addEventListener("keydown", (e) => {
  if (e.key === "Escape") transmissao(false);
  // Com a tela limpa não dá para clicar em Sortear: a barra de espaço sorteia.
  else if (e.key === " " && document.body.classList.contains("transmissao")) {
    e.preventDefault();
    sortear();
  }
});
if (localStorage.getItem("transmissao")) transmissao(true);

$("#intervalo").value = localStorage.getItem("intervalo") ?? "30";
ligarRelogio();
pintar();
setInterval(pintar, 2000);
