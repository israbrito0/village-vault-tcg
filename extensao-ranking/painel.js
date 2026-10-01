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
const num = (n) => Math.round(n).toLocaleString("pt-BR");
const reais = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

let sorteios = [];
let ordem = "gemas";

// Fora da extensão (servindo a pasta só para conferir a tela) não existe
// chrome.storage: aí usa o que estiver em window.__teste, se alguém pôs.
const temStorage = typeof chrome !== "undefined" && chrome.storage?.local;

async function ler() {
  const g = temStorage
    ? await chrome.storage.local.get([
        "participacao",
        "participacaoTitulo",
        "gemasEventos",
        "tabelaEmocoes",
        "sorteios",
      ])
    : window.__teste ?? {};
  sorteios = g.sorteios ?? [];
  return {
    p: g.participacao ?? null,
    titulo: g.participacaoTitulo || "",
    eventos: g.gemasEventos ?? [],
    tabela: g.tabelaEmocoes ?? {},
  };
}

async function salvar(dados) {
  if (temStorage) await chrome.storage.local.set(dados);
  else window.__teste = { ...(window.__teste ?? {}), ...dados };
}

function linhas(tbody, dados, montar, colunas) {
  tbody.innerHTML = "";
  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="${colunas}" class="vazio">nada ainda</td></tr>`;
    return;
  }
  for (const d of dados) tbody.insertAdjacentHTML("beforeend", montar(d));
}

const PORORDEM = {
  gemas: (a, b) => b.gemas - a.gemas,
  pontos: (a, b) => b.pontos - a.pontos,
  gastou: (a, b) => b.gastou - a.gastou,
};

async function pintar() {
  const { p, titulo, eventos, tabela } = await ler();
  const linhasP = p?.linhas ?? [];
  const r = resumirGemas(linhasP);

  $("#titulo").textContent = titulo || "Painel da live";
  $("#periodo").textContent = p
    ? `${p.aoVivo ? "● ao vivo" : "encerrada"} · lido às ${hora(p.quando)}`
    : "abra a sua live no painel da Jamble, na aba Participação";
  $("#periodo").classList.toggle("vivo", !!p?.aoVivo);

  $("#c-gemas").textContent = num(r.gemas);
  $("#c-recentes").textContent = num(gemasRecentes(eventos, 5 * 60 * 1000));
  $("#c-carpas").textContent = num(r.carpas);
  $("#c-pontos").textContent = num(r.pontos);
  $("#c-enviaram").textContent = `${num(r.enviaram)}/${num(r.pessoas)}`;
  $("#c-comprado").textContent = reais(r.comprado);

  const ordenado = linhasP.slice().sort(PORORDEM[ordem] ?? PORORDEM.gemas);
  linhas(
    $("#t-ranking tbody"),
    ordenado.slice(0, 80).map((l, i) => ({ i: i + 1, ...l })),
    (d) =>
      `<tr><td>${d.i}</td><td>${d.nome} <span class="fraco">@${d.handle}</span></td>` +
      `<td class="n gema">${d.gemas ? num(d.gemas) : "—"}</td>` +
      `<td class="n">${d.gastou ? reais(d.gastou) : "—"}</td>` +
      `<td class="n">${num(d.mensagens)}</td><td class="n forte">${num(d.pontos)}</td></tr>`,
    6,
  );

  linhas(
    $("#t-feed tbody"),
    eventos.slice(-40).reverse(),
    (e) =>
      `<tr><td>${hora(e.ts)}</td><td>${e.nome} <span class="fraco">@${e.handle}</span></td>` +
      `<td class="n gema forte">+${num(e.gemas)}</td><td class="n fraco">${num(e.total)}</td></tr>`,
    4,
  );

  linhas(
    $("#t-sorteios tbody"),
    sorteios.slice().reverse(),
    (s) => `<tr><td>${hora(s.ts)}</td><td>@${s.ganhador}</td><td>${s.entre} pessoas</td></tr>`,
    3,
  );

  const quantos = Object.keys(tabela).length;
  $("#rodape").textContent = p
    ? `A Jamble entrega quantas gemas cada pessoa enviou no total, mas não diz qual ícone foi. ` +
      `"Carpas" aqui é o total de gemas dividido por ${GEMAS_POR_CARPA} (o preço da Carpa Zika), ` +
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

// ---------- sorteio ----------

async function sortear() {
  const { p } = await ler();
  const soGemas = document.querySelector('input[name="quem"]:checked').value === "gemas";
  const comPeso = $("#peso").checked;
  const semRepetir = $("#semRepetir").checked;

  let candidatos = (p?.linhas ?? []).filter((l) => l.handle && (!soGemas || l.gemas > 0));

  if (semRepetir) {
    const jaGanharam = new Set(sorteios.map((s) => s.ganhador));
    const sobra = candidatos.filter((c) => !jaGanharam.has(c.handle));
    if (sobra.length) candidatos = sobra;
  }

  if (!candidatos.length) {
    $("#ganhador").textContent = "";
    $("#detalheSorteio").textContent = soGemas
      ? "Ninguém enviou gemas nesta live ainda."
      : "Ainda não tenho a participação desta live.";
    return;
  }

  // Com peso, cada carpa equivalente vale um bilhete (quem enviou pouco fica
  // com um). Sem peso, uma chance por pessoa.
  const bilhetes = [];
  for (const c of candidatos) {
    const n = comPeso ? Math.max(1, Math.round(c.gemas / GEMAS_POR_CARPA)) : 1;
    for (let i = 0; i < n; i++) bilhetes.push(c);
  }
  const ganho = bilhetes[Math.floor(Math.random() * bilhetes.length)];

  sorteios.push({ ts: Date.now(), ganhador: ganho.handle, entre: candidatos.length, soGemas, comPeso });
  await salvar({ sorteios });

  $("#ganhador").textContent = "@" + ganho.handle;
  $("#detalheSorteio").textContent =
    `${num(ganho.gemas)} gemas · sorteado entre ${candidatos.length} pessoas` +
    (comPeso ? " · mais gemas, mais chance" : " · chance igual") +
    (semRepetir ? " · sem repetir" : "");
  pintar();
}

$("#sortear").addEventListener("click", sortear);

$("#limparSorteios").addEventListener("click", async () => {
  sorteios = [];
  await salvar({ sorteios });
  $("#ganhador").textContent = "";
  $("#detalheSorteio").textContent = "";
  pintar();
});

$("#imprimir").addEventListener("click", () => window.print());

$("#intervalo").value = localStorage.getItem("intervalo") ?? "30";
ligarRelogio();
pintar();
setInterval(pintar, 2000);
