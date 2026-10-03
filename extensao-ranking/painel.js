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

async function desenhar(dados) {
  const { lives, p, titulo, eventos, emocoes, tabela, nomes, eu } = dados;
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
  // Da para ter o painel aberto na live e numa aba ao mesmo tempo: se a meta
  // mudar num, o campo do outro tem que acompanhar.
  const campoMeta = $("#meta");
  if (document.activeElement !== campoMeta && (Number(campoMeta.value) || 0) !== meta) {
    campoMeta.value = meta || "";
  }
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

  // Ranking ao vivo pelas emotions: quem mandou mais gemas, quantos envios e
  // O QUE cada um mandou. Funciona em qualquer live -- inclusive na de outro
  // vendedor, onde o ranking da Jamble (participação) simplesmente não existe.
  // Era por isso que snorlax "não contava": chegava, mas não tinha onde aparecer.
  const oQueMandou = (icones) =>
    Object.entries(icones)
      .sort((a, b) => b[1] - a[1])
      .map(([ic, q]) => `${q}x ${nomeIcone(ic, nomes)}`)
      .join(", ");
  $("#rankingVivoTotal").textContent = em.total
    ? `${num(em.porPessoa.length)} pessoas · ${num(em.total)} envios · ${num(em.gemas)} gemas`
    : "";
  linhas(
    $("#t-ranking-vivo tbody"),
    em.porPessoa.map((x, i) => ({ i: i + 1, ...x })),
    (d) =>
      `<tr${d.i <= 3 ? ' class="podio"' : ""}><td>${d.i}</td>` +
      `<td>${esc(d.nome)} <span class="fraco">@${esc(d.handle)}</span></td>` +
      `<td class="n gema forte">${num(d.gemas)}</td><td class="n">${num(d.qtd)}</td>` +
      `<td class="mandou">${esc(oQueMandou(d.icones))}</td></tr>`,
    5,
  );

  // O ranking da Jamble só existe na sua live (painel do vendedor). Em live de
  // outro vendedor ele ficaria vazio ocupando espaço -- então some.
  $("#caixa-ranking").style.display = linhasP.length ? "" : "none";

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

// ---------- as outras abas: leilões, batalha e chat, clientes ----------
//
// As contas ficam no analises.js (com teste); aqui é só desenhar.

let aba = "vivo";
try {
  aba = localStorage.getItem("aba") || "vivo";
} catch {}

const ABAS = ["vivo", "leiloes", "batalha", "clientes"];

function mostrarAba(nome) {
  if (!ABAS.includes(nome)) nome = "vivo";
  aba = nome;
  for (const el of document.querySelectorAll("#abas button, section[data-aba]")) {
    el.classList.toggle("ativa", el.dataset.aba === nome);
  }
  // O rodapé e o "Zerar o ao vivo" só aparecem na aba Ao vivo (ver o CSS).
  document.body.dataset.aba = nome;
  try {
    localStorage.setItem("aba", nome);
  } catch {}
  extrasLidosEm = 0; // trocou de aba: lê o dicionário e o histórico agora
  pintar();
}

for (const b of document.querySelectorAll("#abas button")) {
  b.addEventListener("click", () => mostrarAba(b.dataset.aba));
}

// O dicionário de nomes e o histórico de clientes são grandes e mudam devagar:
// ler a cada 2s, junto com o resto, seria esforço à toa. Vão a cada 10s, e só
// quando uma aba que usa está aberta.
let extras = { perfis: {}, historico: {}, rankingMensal: null };
let extrasLidosEm = 0;
async function lerExtras() {
  if (aba === "vivo") return extras;
  if (Date.now() - extrasLidosEm < 10000) return extras;
  extrasLidosEm = Date.now();
  const g = temStorage
    ? await chrome.storage.local.get(["perfis", "historico", "rankingMensal"])
    : window.__teste ?? {};
  extras = { perfis: g.perfis ?? {}, historico: g.historico ?? {}, rankingMensal: g.rankingMensal ?? null };
  return extras;
}

const plural = (q, um, varios) => `${num(q)} ${Number(q) === 1 ? um : varios}`;
const horaCurta = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dia = (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");
const quem = (handle) => (handle ? "@" + esc(handle) : `<span class="anonimo">ainda sem nome</span>`);
const restante = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
};
const CLASSE_SITUACAO = { vendido: "vendido", rolando: "rolando", cancelado: "cancelado", "sem venda": "semvenda" };

// A bolinha na aba Leilões avisa que tem venda rolando, mesmo com outra aba
// aberta.
function marcarAbaLeiloes(rolando) {
  const b = document.querySelector('#abas button[data-aba="leiloes"]');
  const html = "Leilões" + (rolando ? '<span class="bolinha"></span>' : "");
  if (b && b.innerHTML !== html) b.innerHTML = html;
}

function desenharLeiloes(p, perfis) {
  const r = resumirLeiloes(p?.leiloes, perfis);
  const disputas = quemDisputou(p?.leiloes, perfis);
  $("#l-faturado").textContent = r.lista.length ? reais(r.faturado) : "—";
  $("#l-vendidos").textContent = num(r.unidades);
  $("#l-mult").textContent = r.multiplicadorMedio ? "×" + r.multiplicadorMedio.toFixed(1) : "—";
  $("#l-disputando").textContent = num(disputas.length);

  const a = r.rolando;
  $("#caixa-agora").style.display = a ? "" : "none";
  if (a) {
    const direta = a.tipo === "compra direta";
    $("#agoraTipo").textContent = a.tipo;
    $("#agoraItem").textContent = a.titulo;
    $("#agoraLance").textContent = direta ? reais(a.final) : reais(a.final || a.inicial);
    $("#agoraQuem").textContent = direta
      ? `${num(a.vendidas)} vendidas` + (a.restam != null ? ` · restam ${num(a.restam)}` : "")
      : a.vencedor
        ? `na frente: @${a.vencedor}`
        : "sem lance ainda";
    $("#agoraLances").textContent = direta ? "cada" : `${num(a.lances)} lances · ${num(a.disputaram)} disputando`;
  }

  $("#l-total").textContent = r.lista.length ? `${num(r.lista.length)} na live` : "";
  linhas(
    $("#t-leiloes tbody"),
    r.lista.slice(0, 150),
    (l) => {
      const detalhe = [
        l.tipo,
        l.tipo === "leilão" && l.inicial ? `começou em ${reais(l.inicial)}` : "",
        l.tipo === "compra direta" ? `${num(l.vendidas)} vendidas` : "",
        l.vencedor ? (l.situacao === "rolando" ? "na frente @" : "@") + esc(l.vencedor) : "",
        l.disputaram ? `${num(l.disputaram)} disputaram` : "",
      ].filter(Boolean);
      return (
        `<tr><td>${l.inicio ? horaCurta(l.inicio) : "—"}</td>` +
        `<td>${esc(l.titulo)}<span class="linha2">${detalhe.join(" · ")}</span></td>` +
        `<td class="n">${l.lances ? num(l.lances) : "—"}</td>` +
        `<td class="n forte">${l.final ? reais(l.final) : "—"}` +
        (l.multiplicador ? `<span class="linha2">×${l.multiplicador.toFixed(1)}</span>` : "") +
        `</td><td><span class="tag ${CLASSE_SITUACAO[l.situacao] || ""}">${esc(l.situacao)}</span></td></tr>`
      );
    },
    5,
  );

  const perderam = disputas.filter((d) => d.perdeu > 0);
  $("#d-total").textContent = perderam.length ? `${num(perderam.length)} pessoas` : "";
  linhas(
    $("#t-disputas tbody"),
    perderam.slice(0, 100),
    (d) => {
      const itens = [...new Set(d.perdidos)];
      return (
        `<tr><td>${quem(d.handle)}<span class="linha2">perdeu: ${esc(itens.slice(0, 3).join(", "))}` +
        `${itens.length > 3 ? ` e mais ${itens.length - 3}` : ""}</span></td>` +
        `<td class="n">${num(d.disputou)}</td><td class="n">${num(d.ganhou)}</td><td class="n forte">${num(d.perdeu)}</td></tr>`
      );
    },
    4,
  );
  const semNome = disputas.filter((d) => !d.handle).length;
  $("#d-nota").textContent = semNome
    ? `${num(semNome)} de ${num(disputas.length)} ainda sem nome: a Jamble manda só o código de quem dá lance. ` +
      `O @ aparece quando a pessoa fala no chat, manda emotion ou ganha um leilão, e fica guardado para as próximas lives.`
    : "";
}

function desenharBatalha(p, perfis) {
  const atual = Object.values(p?.batalhas ?? {}).sort((x, y) => (y.visto || 0) - (x.visto || 0))[0];
  const b = resumirBatalha(atual, perfis);
  $("#b-vazio").style.display = b ? "none" : "";
  $("#b-conteudo").style.display = b ? "" : "none";
  $("#b-tempo").textContent = "";
  if (b) {
    const nomes = (lista) => {
      const conhecidos = lista.filter(Boolean).map((h) => "@" + h);
      const sem = lista.length - conhecidos.length;
      return conhecidos.concat(sem ? [`+${sem} sem nome`] : []).join(", ");
    };
    for (const [cor, t] of [
      ["v", b.vermelho],
      ["a", b.azul],
    ]) {
      $(`#b-${cor}-pts`).textContent = num(t.pontos);
      $(`#b-${cor}-pessoas`).textContent = `${num(t.pessoas)} pessoas`;
      $(`#b-${cor}-top`).textContent = t.topNomes.length ? "top: " + nomes(t.topNomes) : "";
    }
    $("#b-vermelho").classList.toggle("lider", b.lider === "vermelho");
    $("#b-azul").classList.toggle("lider", b.lider === "azul");
    const total = b.vermelho.pontos + b.azul.pontos;
    const pv = total ? (b.vermelho.pontos / total) * 100 : 50;
    $("#b-barra-v").style.width = pv.toFixed(1) + "%";
    $("#b-barra-a").style.width = (100 - pv).toFixed(1) + "%";
    const nivel = b.tier ? ` · nível ${String(b.tier).replace(/^tier_/, "")}` : "";
    $("#b-lider").textContent =
      (b.lider === "empate"
        ? b.acabou
          ? "Acabou empatada"
          : "Empatada"
        : `${b.acabou ? "Venceu o" : "Na frente:"} ${b.lider}, por ${num(b.diferenca)} pontos`) + nivel;
    $("#b-tempo").textContent = b.acabou
      ? "encerrada"
      : b.termina
        ? `termina às ${horaCurta(b.termina)} · faltam ${restante(b.termina - Date.now())}`
        : "";
  }

  const ch = resumirChat(p?.chat);
  $("#ch-total").textContent = num(ch.total);
  $("#ch-ritmo").textContent = ch.porMinuto.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  $("#ch-pessoas").textContent = num(ch.top.length);
  const outrosTipos = Object.entries(ch.porTipo).filter(([t]) => t !== "STANDARD");
  $("#ch-tipos").textContent = outrosTipos.map(([t, q]) => `${num(q)} ${t.toLowerCase()}`).join(" · ");
  linhas(
    $("#t-chat tbody"),
    ch.top.slice(0, 60).map((x, i) => ({ i: i + 1, ...x })),
    (d) =>
      `<tr${d.i <= 3 ? ' class="podio"' : ""}><td>${d.i}</td>` +
      `<td>${esc(d.nome)} <span class="fraco">@${esc(d.handle)}</span></td><td class="n forte">${num(d.mensagens)}</td></tr>`,
    3,
  );

  const of = resumirOfertas(p?.ofertas, perfis);
  $("#caixa-ofertas").style.display = of.total ? "" : "none";
  $("#of-total").textContent = of.total ? `${num(of.total)} ofertas · ${num(of.aceitas)} aceitas` : "";
  linhas(
    $("#t-ofertas tbody"),
    of.lista.slice(0, 60),
    (o) =>
      `<tr><td>${horaCurta(o.quando)}</td><td>${quem(o.handle)}` +
      (o.produto ? `<span class="linha2">${esc(o.produto)}</span>` : "") +
      `</td><td class="n">${o.valor != null ? reais(o.valor) : "—"}</td><td>${esc(o.situacao || "—")}</td></tr>`,
    4,
  );

  const sj = Object.values(p?.sorteiosJamble ?? {}).sort((x, y) => (y.quando || 0) - (x.quando || 0));
  $("#caixa-sorteios-jamble").style.display = sj.length ? "" : "none";
  linhas(
    $("#t-sorteios-jamble tbody"),
    sj,
    (s) =>
      `<tr><td>${horaCurta(s.quando)}</td><td>${esc(s.titulo || "—")}</td>` +
      `<td class="n">${s.participantes ? num(s.participantes) : "—"}</td>` +
      `<td>${s.vencedor ? "@" + esc(s.vencedor) : s.acabou ? quem(perfis[s.vencedorId]) : "rolando"}</td></tr>`,
    4,
  );
}

function desenharClientes(historicoGuardado, lives, perfis, rankingMensal, eu, p) {
  const historico = historicoComLives(historicoGuardado, lives, perfis);
  const lista = rankingMensal?.lista ?? [];
  const pos = minhaPosicao(lista, eu?.handle);
  let texto;
  if (!lista.length) {
    texto = "Ainda não li o ranking. Com uma live aberta (a sua ou a de outro vendedor), clique em Atualizar.";
  } else if (pos?.eu) {
    texto =
      `Você está em #${pos.eu.posicao} com ${num(pos.eu.pontos)} pontos` +
      (pos.eu.posicao === 1
        ? " · primeiro lugar"
        : pos.acima
          ? ` · faltam ${num(pos.faltaParaSubir)} para passar @${pos.acima.handle} (#${pos.acima.posicao})`
          : "") +
      (pos.faltaParaTop20 != null
        ? ` · faltam ${num(pos.faltaParaTop20)} para o top 20 (@${pos.corteTop20.handle} tem ${num(pos.corteTop20.pontos)})`
        : pos.folgaNoTop20 != null && pos.eu.posicao < 20
          ? ` · ${num(pos.folgaNoTop20)} de folga sobre o 20º`
          : "");
  } else {
    texto = eu?.handle
      ? `@${eu.handle} não está na lista que a Jamble mandou (${num(lista.length)} vendedores).`
      : `${num(lista.length)} vendedores na lista.`;
  }
  $("#rm-voce").textContent = texto + (rankingMensal?.quando ? ` · lido às ${horaCurta(rankingMensal.quando)}` : "");

  // Quanto a live aberta rende no ranking, pelas regras que a própria Jamble
  // manda junto com a lista (hoje: 3 pontos por real, 2 por gema). Os pontos
  // batem com o valor PÓS TAXAS: em 20/09, líquido × 3 + gemas × 2 deu os
  // 630.553 da tela no ponto. O líquido só existe na live dela (painel do
  // vendedor); na de outro vendedor a conta usa o faturamento bruto e passa
  // um pouco do real.
  const regras = rankingMensal?.regras ?? null;
  const liquido = Number(p?.metricas?.liquido) > 0 ? Number(p.metricas.liquido) : null;
  const base = liquido ?? p?.metricas?.faturamento;
  const gemas = resumirGemas(p?.linhas ?? []).gemas || resumirEmocoes(p?.emocoes ?? []).gemas;
  const pontos = p && Number.isFinite(Number(base)) ? pontosDaLive(regras, base, gemas) : null;
  $("#rm-live").textContent =
    pontos != null
      ? `Esta live rende ${liquido ? "" : "até "}≈ ${num(pontos)} pontos para ` +
        `${p.vendedor ? "@" + p.vendedor : "o vendedor"} ` +
        `(${reais(base)} ${liquido ? "pós taxas" : "bruto"} × ${num(regras.porReal)} + ` +
        `${num(gemas)} gemas × ${num(regras.porGema)}).`
      : "";

  // O topo da lista, e você no meio mesmo que esteja lá embaixo.
  const topo = lista.slice(0, 30);
  if (pos?.eu && !topo.includes(pos.eu)) topo.push(pos.eu);
  linhas(
    $("#t-ranking-mensal tbody"),
    topo,
    (v) => {
      // Você em destaque; os três primeiros com a cor do pódio.
      const classe = eu?.handle && v.handle === eu.handle ? "eu" : v.posicao <= 3 ? "podio" : "";
      return (
        `<tr class="${classe}"><td>${num(v.posicao)}</td><td>@${esc(v.handle)}</td>` +
        `<td class="n">${num(v.pontos)}</td></tr>`
      );
    },
    3,
  );
  const velho = rankingMensal?.quando && Date.now() - rankingMensal.quando > 30 * 60 * 1000;
  $("#rm-nota").textContent = velho ? "Esse ranking tem mais de meia hora. Clique em Atualizar." : "";

  const todos = clientes(historico, eu?.handle);
  const filtro = $("#filtroClientes").value;
  const busca = $("#buscaCliente").value.trim().replace(/^@/, "").toLowerCase();
  const FILTROS = {
    todos: () => true,
    compra: (c) => c.gastou > 0,
    gema: (c) => c.gemas > 0 && !c.gastou,
    disputa: (c) => c.disputou > c.ganhou,
    sumiu: (c) => c.sumiu,
    conversa: (c) => c.perfil === "só conversa",
  };
  const vistos = todos.filter((c) => (FILTROS[filtro] ?? FILTROS.todos)(c) && (!busca || c.handle.toLowerCase().includes(busca)));
  const nLives = Object.keys(historico ?? {}).length;
  $("#cl-total").textContent = todos.length ? `${num(vistos.length)} de ${num(todos.length)} · ${plural(nLives, "live", "lives")}` : "";
  linhas(
    $("#t-clientes tbody"),
    vistos.slice(0, 150),
    (c) => {
      const detalhe = [
        c.perfil,
        c.disputou ? `levou ${num(c.ganhou)} de ${num(c.disputou)} disputas` : "",
        c.mensagens ? plural(c.mensagens, "msg", "msgs") : "",
      ].filter(Boolean);
      return (
        `<tr><td>@${esc(c.handle)}${c.sumiu ? ' <span class="tag sumiu">sumiu</span>' : ""}` +
        `<span class="linha2">${esc(detalhe.join(" · "))}</span></td>` +
        `<td class="n">${num(c.lives)}${c.livesDela && c.livesDela !== c.lives ? `<span class="linha2">${num(c.livesDela)} suas</span>` : ""}</td>` +
        `<td class="n">${c.gastou ? reais(c.gastou) : "—"}</td>` +
        `<td class="n gema">${c.gemas ? num(c.gemas) : "—"}</td>` +
        `<td class="n">${dia(c.ultima)}</td></tr>`
      );
    },
    5,
  );
  $("#cl-nota").textContent = nLives
    ? `Cada live que passar com a extensão ligada entra aqui (guardo até 60). "Comprou": na sua live é o que a ` +
      `Jamble mostra na Participação; em live de outro vendedor, só os leilões que a pessoa ganhou com a página aberta.`
    : "Ainda não tenho nenhuma live guardada. Elas entram aqui sozinhas, conforme você abre lives com a extensão ligada.";
}

async function desenharAba(dados) {
  const { p, eu } = dados;
  // A bolinha vale para qualquer aba aberta.
  marcarAbaLeiloes(!!resumirLeiloes(p?.leiloes, {}).rolando);
  if (aba === "vivo") return;
  const { perfis, historico, rankingMensal } = await lerExtras();
  if (aba === "leiloes") desenharLeiloes(p, perfis);
  else if (aba === "batalha") desenharBatalha(p, perfis);
  else if (aba === "clientes") desenharClientes(historico, dados.lives, perfis, rankingMensal, eu, p);
}

$("#filtroClientes").addEventListener("change", () => pintar());
$("#buscaCliente").addEventListener("input", () => pintar());

$("#atualizarRanking").addEventListener("click", async () => {
  const b = $("#atualizarRanking");
  b.disabled = true;
  b.textContent = "lendo…";
  const r = temStorage ? await chrome.runtime.sendMessage({ tipo: "atualizar-ranking-mensal" }).catch(() => null) : null;
  if (!r?.ok) {
    $("#rm-nota").textContent =
      "Não achei uma live aberta com o botão do ranking. Abra uma live da Jamble (a sua ou a de outro vendedor) e tente de novo.";
  }
  setTimeout(() => {
    b.disabled = false;
    b.textContent = "Atualizar";
    extrasLidosEm = 0;
    pintar();
  }, 2500);
});

// Se uma conta estourar no meio do desenho, a tela inteira parava de
// atualizar sem dizer nada -- foi o que aconteceu quando um campo de metrica
// veio faltando. Agora o erro aparece na tela e o painel continua de pe.
let ultimoErro = "";
async function pintar() {
  try {
    // Uma leitura só para as duas partes da tela.
    const dados = await ler();
    await desenhar(dados);
    await desenharAba(dados);
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

// Carregado dentro da pagina da live (overlay.js): layout de faixa estreita.
const EMBUTIDO = new URLSearchParams(location.search).has("embutido");
if (EMBUTIDO) document.body.classList.add("embutido");

// ---------- modo transmissão ----------
// Deixa a aba só com os números, para pegar no OBS com "Captura de janela".
// O sorteio continua funcionando: o ganhador aparece grande na tela.
//
// É coisa da aba separada. A escolha fica guardada e as duas formas do painel
// leem o mesmo lugar -- e dentro da live o modo escondia as abas, os botões e
// o rodapé sem dar como sair (o botão de sair nem existe ali). Aconteceu em
// 03/10: ela abriu o painel na live e não achou menu nenhum. Dentro da live,
// então, ele não liga, e também não mexe na escolha guardada da aba separada.

function transmissao(ligado) {
  if (EMBUTIDO) return;
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

$("#meta").value = localStorage.getItem("meta") || "";
$("#intervalo").value = localStorage.getItem("intervalo") ?? "30";
// Para conferir de relance qual versão está carregada: depois de atualizar a
// extensão, a página da live precisa de F5 para pegar a nova.
try {
  if (temStorage) $("#versao").textContent = "Village & Vault " + chrome.runtime.getManifest().version;
} catch {}

ligarRelogio();
mostrarAba(aba);
setInterval(pintar, 2000);
