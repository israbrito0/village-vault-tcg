// Painel da live: mostra o ranking de participação que a própria Jamble
// calcula (aba "Participação" do painel do vendedor) e faz o sorteio em cima
// dele. Tudo local -- nada daqui vai para o site.
//
// De onde vem cada número:
//   gemas, comprou, mensagens e pontos -> /api/seller/show-participation
//   valor de cada ícone (quando houver)  -> /api/live/emojis
// A extensão não inventa conta nenhuma: só lê o que a página já pediu.

const GEMAS_POR_CARPA = 500; // "Carpa Zika" custa 500 gemas na tabela da Jamble

const $ = (s) => document.querySelector(s);
const num = (n) => Math.round(n).toLocaleString("pt-BR");
const reais = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

let sorteios = [];

// Fora da extensão (servindo a pasta só para conferir a tela) não existe
// chrome.storage: aí usa o que estiver em window.__teste, se alguém pôs.
const temStorage = typeof chrome !== "undefined" && chrome.storage?.local;

async function ler() {
  const g = temStorage
    ? await chrome.storage.local.get([
        "participacao",
        "participacaoTitulo",
        "emocoes",
        "tabelaEmocoes",
        "sorteios",
      ])
    : window.__teste ?? {};
  sorteios = g.sorteios ?? [];
  return {
    p: g.participacao ?? null,
    titulo: g.participacaoTitulo || "",
    emocoes: g.emocoes ?? [],
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

// Quem entra no sorteio, na mesma ordem em que o ranking mostra.
function candidatosDe(p, soGemas) {
  return (p?.linhas ?? []).filter((l) => l.handle && (!soGemas || l.gemas > 0));
}

async function pintar() {
  const { p, titulo, emocoes, tabela } = await ler();
  const linhasP = p?.linhas ?? [];

  const gemas = linhasP.reduce((s, l) => s + l.gemas, 0);
  const pontos = linhasP.reduce((s, l) => s + l.pontos, 0);
  const comprado = linhasP.reduce((s, l) => s + l.gastou, 0);

  $("#titulo").textContent = titulo || "Painel da live";
  $("#periodo").textContent = p
    ? `${p.aoVivo ? "ao vivo" : "encerrada"} · números de ${hora(p.quando)}`
    : "abra a aba Participação da sua live no painel da Jamble";

  $("#c-carpas").textContent = num(gemas / GEMAS_POR_CARPA);
  $("#c-gemas").textContent = num(gemas);
  $("#c-pontos").textContent = num(pontos);
  $("#c-pessoas").textContent = num(linhasP.length);
  $("#c-comprado").textContent = reais(comprado);

  linhas(
    $("#t-ranking tbody"),
    linhasP.slice(0, 60).map((l, i) => ({ i: i + 1, ...l })),
    (d) =>
      `<tr><td>${d.i}</td><td>${d.nome} <span class="fraco">@${d.handle}</span></td>` +
      `<td class="n">${d.gastou ? reais(d.gastou) : "—"}</td>` +
      `<td class="n carpa">${d.gemas ? num(d.gemas) : "—"}</td>` +
      `<td class="n">${num(d.mensagens)}</td><td class="n forte">${num(d.pontos)}</td></tr>`,
    6,
  );

  // A conta por ícone só aparece se algum evento de emotion for capturado. A
  // participação da Jamble dá o total de gemas, mas não diz qual ícone foi.
  const porIcone = new Map();
  for (const e of emocoes) {
    const v = porIcone.get(e.icone) ?? { qtd: 0, pontos: 0 };
    v.qtd += e.quantidade || 1;
    v.pontos += e.pontos || 0;
    porIcone.set(e.icone, v);
  }
  $("#caixa-icones").style.display = porIcone.size ? "" : "none";
  linhas(
    $("#t-icones tbody"),
    [...porIcone.entries()].sort((a, b) => b[1].pontos - a[1].pontos).map(([ic, v]) => ({ ic, ...v })),
    (d) => `<tr><td>${d.ic}</td><td class="n">${num(d.qtd)}</td><td class="n">${num(d.pontos)}</td></tr>`,
    3,
  );

  linhas(
    $("#t-sorteios tbody"),
    sorteios.slice().reverse(),
    (s) => `<tr><td>${hora(s.ts)}</td><td>@${s.ganhador}</td><td>${s.entre} pessoas</td></tr>`,
    3,
  );

  const quantosIcones = Object.keys(tabela).length;
  $("#rodape").textContent = p
    ? `Uma carpa custa ${GEMAS_POR_CARPA} gemas, então o número de carpas aqui é o total de gemas ` +
      `dividido por ${GEMAS_POR_CARPA}: a Jamble entrega quantas gemas cada pessoa mandou, mas não ` +
      `diz qual ícone foi.` +
      (quantosIcones ? ` Tabela de preços lida da Jamble: ${quantosIcones} ícones.` : "")
    : "";
}

// ---------- atualizar ----------

$("#atualizar").addEventListener("click", async () => {
  const b = $("#atualizar");
  const antes = b.textContent;
  b.disabled = true;
  b.textContent = "atualizando…";
  if (temStorage) {
    const r = await chrome.runtime.sendMessage({ tipo: "atualizar-participacao" }).catch(() => null);
    $("#aviso").textContent = r?.ok
      ? ""
      : "Não achei a aba da live no painel da Jamble. Abra Painel → Lives → a sua live → aba Participação e deixe a aba aberta.";
  }
  setTimeout(() => {
    b.disabled = false;
    b.textContent = antes;
    pintar();
  }, 2500);
});

// ---------- sorteio ----------

async function sortear() {
  const { p } = await ler();
  const soGemas = document.querySelector('input[name="quem"]:checked').value === "gemas";
  const comPeso = $("#peso").checked;
  const semRepetir = $("#semRepetir").checked;

  let candidatos = candidatosDe(p, soGemas);

  if (semRepetir) {
    const jaGanharam = new Set(sorteios.map((s) => s.ganhador));
    const sobra = candidatos.filter((c) => !jaGanharam.has(c.handle));
    if (sobra.length) candidatos = sobra;
  }

  if (!candidatos.length) {
    $("#ganhador").textContent = "";
    $("#detalheSorteio").textContent = soGemas
      ? "Ninguém mandou gemas nesta live ainda."
      : "Ainda não tenho a participação desta live.";
    return;
  }

  // Com peso, cada carpa equivalente vale um bilhete. Sem peso, um por pessoa.
  const bilhetes = [];
  for (const c of candidatos) {
    const n = comPeso ? Math.max(1, Math.round(c.gemas / GEMAS_POR_CARPA)) : 1;
    for (let i = 0; i < n; i++) bilhetes.push(c);
  }
  const ganho = bilhetes[Math.floor(Math.random() * bilhetes.length)];

  sorteios.push({ ts: Date.now(), ganhador: ganho.handle, entre: candidatos.length, soGemas, comPeso });
  await salvar({ sorteios });

  const carpas = Math.round(ganho.gemas / GEMAS_POR_CARPA);
  $("#ganhador").textContent = "@" + ganho.handle;
  $("#detalheSorteio").textContent =
    `${num(ganho.gemas)} gemas (${num(carpas)} ${carpas === 1 ? "carpa" : "carpas"}) · ` +
    `sorteado entre ${candidatos.length} pessoas` +
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

pintar();
setInterval(pintar, 2000);
