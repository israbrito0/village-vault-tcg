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

const num = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("pt-BR") : "—");
const reais = (n) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

let sorteios = [];
let ordem = "gemas";
let liveEscolhida = null;
let sorteioEscolhido = null; // so guarda o que ELA escolheu, nao o padrao
let ultimasCarpas = -1; // para saber quando chegou carpa nova // null = deixa o painel escolher sozinho

// Quando o painel esta encostado numa live, o overlay diz qual e: ai o certo
// e mostrar A LIVE DA TELA, e nao a mais recente ou a dela. Era confuso abrir
// o painel na live de alguem e ver os numeros de outra.
const LIVE_DA_PAGINA = new URLSearchParams(location.search).get("live") || null;

// Fora disso pode haver mais de uma live guardada (a dela e a que ela abriu
// para ver o ranking). A boa e a do painel do vendedor; entre as do mesmo
// tipo, a mais recente. O seletor em cima deixa trocar na mao.
function escolherLive(lives) {
  const todas = Object.values(lives ?? {});
  if (!todas.length) return null;
  if (liveEscolhida && lives[liveEscolhida]) return lives[liveEscolhida];
  // Encostado numa live, so aquela live vale. Nos primeiros segundos ainda nao
  // chegou dado dela -- e mostrar os numeros de OUTRA live nesse vao seria pior
  // do que mostrar nada, porque voce leria aquilo como sendo desta aqui.
  if (LIVE_DA_PAGINA) return lives[LIVE_DA_PAGINA] ?? null;
  return todas.sort((a, b) => (b.doPainel ? 1 : 0) - (a.doPainel ? 1 : 0) || b.quando - a.quando)[0];
}


// Fora da extensão (servindo a pasta só para conferir a tela) não existe
// chrome.storage: aí usa o que estiver em window.__teste, se alguém pôs.
const temStorage = typeof chrome !== "undefined" && chrome.storage?.local;

async function ler() {
  const g = temStorage
    ? await chrome.storage.local.get(["lives", "tabelaEmocoes", "nomesEmocoes", "eu"])
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
    eu: g.eu ?? null,
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

// Redesenhar a tabela inteira a cada 2s perdia a rolagem e piscava: no meio da
// live, procurando um nome, a lista pulava para o topo sozinha. Agora so troca
// o conteudo quando ele muda de verdade.
function linhas(tbody, dados, montar, colunas) {
  const html = dados.length
    ? dados.map(montar).join("")
    : `<tr><td colspan="${colunas}" class="vazio">nada ainda</td></tr>`;
  if (tbody.innerHTML !== html) tbody.innerHTML = html;
}


// "magikarp_shiny" vira "Carpa Zika" quando a tabela da Jamble ja passou.
const CARPA = "magikarp_shiny";
const nomeIcone = (id, nomes) => (nomes && nomes[id]) || id;

const PORORDEM = {
  gemas: (a, b) => b.gemas - a.gemas,
  pontos: (a, b) => b.pontos - a.pontos,
  gastou: (a, b) => b.gastou - a.gastou,
};

async function desenhar() {
  const { lives, p, titulo, eventos, emocoes, tabela, nomes, eu } = await ler();
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
    : LIVE_DA_PAGINA
      ? "esperando os primeiros dados desta live…"
      : "abra a sua live no painel da Jamble, na aba Participação";
  $("#periodo").classList.toggle("vivo", !!p?.aoVivo);

  // Os numeros que a Jamble calcula para a live inteira. So aparecem depois
  // que a aba Desempenho do painel do vendedor for lida uma vez.
  const M = p?.metricas ?? null;
  const ouTraco = (v, f) => (v == null ? "—" : f(v));

  $("#c-faturamento").textContent = ouTraco(M?.faturamento, reais);
  $("#c-liquido").textContent = ouTraco(M?.liquido, reais);
  $("#c-vendas").textContent = ouTraco(M?.vendas, num);
  $("#c-compradores").textContent = ouTraco(M?.compradores, num);
  $("#c-espectadores").textContent = ouTraco(M?.espectadores ?? M?.audienciaAgora, num);
  // Na live de outro vendedor nao existe participacao: ai o total de gemas e
  // o que passou nas emotions com o painel aberto.
  const gemasTotal = r.gemas || em.gemas;
  $("#c-gemas").textContent = num(gemasTotal);
  $("#c-carpas").textContent = num(gemasTotal / porCarpa);
  // As emotions sabem a hora exata de cada envio; a participação só sabe
  // quando foi lida. Quando houver emotion, ela manda.
  // Meta de carpas: voce pensa a live em carpas, entao a barra mostra quanto
  // falta sem precisar fazer conta de cabeca.
  const carpasAgora = gemasTotal / porCarpa;
  const meta = Number(localStorage.getItem("meta")) || 0;
  // A caixa fica sempre, senao nao haveria onde digitar a meta. O que some
  // quando nao ha meta e a barra.
  $("#barraMeta").parentElement.style.display = meta > 0 ? "" : "none";
  if (meta > 0) {
    const pct = Math.min(100, (carpasAgora / meta) * 100);
    $("#barraMeta").style.width = pct.toFixed(1) + "%";
    const faltam = Math.max(0, meta - carpasAgora);
    $("#textoMeta").textContent =
      faltam <= 0
        ? `Meta batida: ${num(carpasAgora)} de ${num(meta)} carpas.`
        : `${num(carpasAgora)} de ${num(meta)} carpas (${pct.toFixed(0)}%) · ` +
          `faltam ${num(faltam * porCarpa)} gemas, cerca de ${num(faltam)} carpas.`;
  } else {
    $("#textoMeta").textContent = "Escreva quantas carpas voce quer nesta live e a barra aparece.";
  }

  // Chegou carpa? o cartao pisca uma vez.
  if (carpasAgora > ultimasCarpas && ultimasCarpas >= 0) {
    const c = $("#c-carpas").closest(".cartao");
    c.classList.remove("pulsa");
    void c.offsetWidth; // reinicia a animacao
    c.classList.add("pulsa");
  }
  ultimasCarpas = carpasAgora;

  const fonteRecente = emocoes.length ? emocoes : eventos;
  $("#c-recentes").textContent = num(gemasRecentes(fonteRecente, 5 * 60 * 1000));

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

  // O resto das metricas da live. A lista e montada no gemas.js, que tem
  // teste: campo faltando ja derrubou a tela inteira uma vez.
  const tempo = (seg) => (seg >= 60 ? `${Math.floor(seg / 60)}min ${Math.round(seg % 60)}s` : `${Math.round(seg)}s`);
  const pct = (v) => (v * 100).toFixed(0) + "%";
  const metricas = listaDeMetricas(M, { num, reais, tempo, pct });
  $("#caixa-metricas").style.display = metricas.length ? "" : "none";
  linhas(
    $("#t-metricas tbody"),
    metricas,
    ([k, v]) => `<tr><td>${esc(k)}</td><td class="n forte">${esc(v)}</td></tr>`,
    2,
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
      cxSorteio.innerHTML = opcoes;
      // So devolve a escolha se foi ELA que escolheu. Antes o painel guardava
      // o padrao de quando ainda nao havia emotion nenhuma, e por isso nunca
      // caia sozinho em "quem mandou carpa" quando a carpa aparecia.
      if (sorteioEscolhido && [...cxSorteio.options].some((o) => o.value === sorteioEscolhido)) {
        cxSorteio.value = sorteioEscolhido;
      }
    }
  }

  // Cada numero vem de um lugar, e nem todo lugar esta aberto. Em vez de
  // mostrar tracinho calado, o painel diz o que falta e onde abrir.
  const faltando = [];
  if (!p && LIVE_DA_PAGINA) {
    faltando.push(
      "Ainda nao chegou nada desta live. Os numeros aparecem nos primeiros segundos; " +
        "se demorar, recarregue a pagina da live.",
    );
  } else if (p && !p.doPainel) {
    faltando.push(
      "Live de outro vendedor: faturamento, vendas, audiencia e quem mandou qual " +
        "emotion vem normal. O que nao vem e gemas por pessoa e espectadores unicos " +
        "-- esses sao do painel do vendedor, so na sua live.",
    );
  } else if (p) {
    if (!M) faltando.push("Nenhum numero ainda: deixe a pagina da live aberta, ou abra a live em Painel -> Lives.");
    if (M && !M.espectadores) faltando.push("Espectadores unicos, funil e pos-taxas: abra a aba Desempenho da sua live (ou clique em Ler agora).");
    if (!linhasP.length) faltando.push("Gemas por pessoa: abra a aba Participacao da sua live.");
    if (!emocoes.length) faltando.push("Quem mandou qual icone: deixe a pagina da live aberta -- so chega o que passar com ela aberta.");
  }
  $("#falta").innerHTML = faltando.length
    ? faltando.map((t) => `<div>• ${esc(t)}</div>`).join("")
    : "";

  // Número velho enganando é pior do que número nenhum: se a leitura parou de
  // chegar enquanto o "atualizar sozinho" está ligado, avisa em vez de deixar
  // a tela parecer viva.
  const parado = p && Number($("#intervalo").value) > 0 ? Date.now() - p.quando : 0;
  $("#avisoVelho").textContent =
    parado > 150000
      ? `Estes números são de ${hora(p.quando)} e não chegou leitura nova desde então. ` +
        `Confira se a aba da Jamble com a participação continua aberta.`
      : "";

  const rotuloEu = $("#rotuloSemEu");
  if (rotuloEu) rotuloEu.textContent = eu?.handle ? ` nao incluir @${eu.handle}` : " nao me incluir";

  const quantos = Object.keys(tabela).length;
  $("#rodape").textContent = p
    ? `A Jamble entrega quantas gemas cada pessoa enviou no total, mas não diz qual ícone foi. ` +
      `"Carpas" aqui é o total de gemas dividido por ${num(porCarpa)} (o preço da Carpa Zika), ` +
      `então é equivalência, não contagem carpa a carpa.` +
      (quantos ? ` Tabela de preços lida da Jamble: ${quantos} ícones.` : "") +
      (emocoes.length || eventos.length
        ? ""
        : ` O "ao vivo" começa a encher na segunda leitura: a primeira serve de ponto de partida.`)
    : "";
}

// Se uma conta estourar no meio do desenho, a tela inteira parava de
// atualizar sem dizer nada -- foi o que aconteceu quando um campo de metrica
// veio faltando. Agora o erro aparece na tela e o painel continua de pe.
let ultimoErro = "";
async function pintar() {
  try {
    await desenhar();
    if (ultimoErro) {
      ultimoErro = "";
      $("#aviso").textContent = "";
    }
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg !== ultimoErro) {
      ultimoErro = msg;
      console.error("painel:", e);
    }
    $("#aviso").textContent =
      "Alguma coisa quebrou ao desenhar o painel: " + msg + ". Os numeros podem estar velhos.";
  }
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

// Guarda a escolha dela para o painel não desfazer no próximo desenho. Só a
// escolha dela: sem isso, o painel guardava o padrão de quando ainda não havia
// emotion nenhuma e nunca caía sozinho em "quem mandou carpa".
$("#quemSorteia").addEventListener("change", () => {
  sorteioEscolhido = $("#quemSorteia").value;
});

$("#qualLive").addEventListener("change", () => {
  liveEscolhida = $("#qualLive").value || null;
  pintar();
});

// ---------- sorteio ----------

async function sortear() {
  const { p, emocoes, tabela, nomes, eu } = await ler();
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

  // Voce manda emotion para testar: sem isso, ganharia o proprio sorteio.
  if ($("#semEu").checked && eu?.handle) {
    candidatos = candidatos.filter((c) => c.handle !== eu.handle);
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

$("#meta").addEventListener("change", () => {
  localStorage.setItem("meta", String(Math.max(0, Number($("#meta").value) || 0)));
  pintar();
});

$("#imprimir").addEventListener("click", () => window.print());

// Planilha da live, para abrir no Excel. Tudo que o painel sabe: os envios um
// a um, o total por pessoa, o ranking de participacao e os sorteios.
$("#planilha").addEventListener("click", async () => {
  const { p, nomes } = await ler();
  if (!p) return;
  const csv = planilhaDaLive(p, nomes);
  // O BOM na frente faz o Excel entender os acentos.
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  const quando = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "h");
  a.download = `live ${(p.titulo || p.id).replace(/[\/:*?"<>|]/g, "-").slice(0, 50)} - ${quando}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

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

// Carregado dentro da pagina da live (overlay.js): layout de faixa estreita.
if (new URLSearchParams(location.search).has("embutido")) document.body.classList.add("embutido");

$("#meta").value = localStorage.getItem("meta") || "";
$("#intervalo").value = localStorage.getItem("intervalo") ?? "30";
ligarRelogio();
pintar();
setInterval(pintar, 2000);
