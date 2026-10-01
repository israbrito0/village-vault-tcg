// Painel da live: lê as emotions que a extensão capturou e mostra contagem,
// ranking e sorteio. Tudo local -- nada daqui vai para o site.

const CARPA = "magikarp_shiny";

const $ = (s) => document.querySelector(s);
const num = (n) => n.toLocaleString("pt-BR");
const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

let sorteios = [];

// Fora da extensão (abrindo o arquivo direto, para conferir a tela) não existe
// chrome.storage: aí usa o que estiver em window.__teste, se alguém pôs.
const temStorage = typeof chrome !== "undefined" && chrome.storage?.local;

async function ler() {
  const g = temStorage
    ? await chrome.storage.local.get(["emocoes", "emocoesTitulo", "emocoesLive", "sorteios"])
    : window.__teste ?? {};
  sorteios = g.sorteios ?? [];
  return { emocoes: g.emocoes ?? [], titulo: g.emocoesTitulo || "", live: g.emocoesLive || "" };
}

async function salvar(dados) {
  if (temStorage) await chrome.storage.local.set(dados);
  else window.__teste = { ...(window.__teste ?? {}), ...dados };
}

function resumir(emocoes) {
  const porIcone = new Map();
  const porPessoa = new Map();
  let pontos = 0;
  let carpas = 0;

  for (const e of emocoes) {
    const q = e.quantidade || 1;
    pontos += e.pontos || 0;
    if (e.icone === CARPA) carpas += q;

    const i = porIcone.get(e.icone) ?? { qtd: 0, pontos: 0 };
    i.qtd += q;
    i.pontos += e.pontos || 0;
    porIcone.set(e.icone, i);

    if (!e.handle) continue;
    const p = porPessoa.get(e.handle) ?? { carpas: 0, pontos: 0, total: 0 };
    p.pontos += e.pontos || 0;
    p.total += q;
    if (e.icone === CARPA) p.carpas += q;
    porPessoa.set(e.handle, p);
  }

  return {
    pontos,
    carpas,
    total: emocoes.reduce((s, e) => s + (e.quantidade || 1), 0),
    porIcone: [...porIcone.entries()].sort((a, b) => b[1].pontos - a[1].pontos),
    porPessoa: [...porPessoa.entries()].sort((a, b) => b[1].pontos - a[1].pontos),
  };
}

function linhas(tbody, dados, montar) {
  tbody.innerHTML = "";
  if (!dados.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="vazio">nada ainda</td></tr>`;
    return;
  }
  for (const d of dados) tbody.insertAdjacentHTML("beforeend", montar(d));
}

async function pintar() {
  const { emocoes, titulo, live } = await ler();
  const r = resumir(emocoes);

  $("#titulo").textContent = titulo || "Painel da live";
  $("#periodo").textContent = emocoes.length
    ? `${hora(emocoes[0].ts)} às ${hora(emocoes[emocoes.length - 1].ts)} · live ${live}`
    : "esperando a primeira emotion… deixe a aba da live aberta";

  $("#c-carpas").textContent = num(r.carpas);
  $("#c-emotions").textContent = num(r.total);
  $("#c-pontos").textContent = num(r.pontos);
  $("#c-pessoas").textContent = num(r.porPessoa.length);

  linhas($("#t-ranking tbody"), r.porPessoa.slice(0, 40).map(([h, v], i) => ({ i: i + 1, h, ...v })),
    (d) => `<tr><td>${d.i}</td><td>@${d.h}</td><td class="n">${num(d.carpas)}</td><td class="n">${num(d.pontos)}</td></tr>`);

  linhas($("#t-icones tbody"), r.porIcone.map(([ic, v]) => ({ ic, ...v })),
    (d) => `<tr><td>${d.ic === CARPA ? "🐟 " : ""}${d.ic}</td><td class="n">${num(d.qtd)}</td><td class="n">${num(d.pontos)}</td></tr>`);

  linhas($("#t-feed tbody"), emocoes.slice(-25).reverse(),
    (e) => `<tr><td>${hora(e.ts)}</td><td>${e.handle ? "@" + e.handle : "—"}</td><td>${e.icone}</td><td class="n">${num(e.pontos || 0)}</td></tr>`);

  linhas($("#t-sorteios tbody"), sorteios.slice().reverse(),
    (s) => `<tr><td>${hora(s.ts)}</td><td>@${s.ganhador}</td><td>${s.entre} pessoas</td></tr>`);

  const semValor = r.porIcone.filter(([, v]) => v.pontos === 0).map(([ic]) => ic);
  $("#rodape").textContent = semValor.length
    ? `Ícones ainda sem valor mapeado: ${semValor.join(", ")}. A contagem deles entra em "Emotions", mas não em "Pontos".`
    : "";
}

// ---------- sorteio ----------

async function sortear() {
  const { emocoes } = await ler();
  const soCarpa = document.querySelector('input[name="quem"]:checked').value === "carpa";
  const comPeso = $("#peso").checked;
  const semRepetir = $("#semRepetir").checked;

  const porPessoa = new Map();
  for (const e of emocoes) {
    if (!e.handle) continue;
    if (soCarpa && e.icone !== CARPA) continue;
    porPessoa.set(e.handle, (porPessoa.get(e.handle) ?? 0) + (e.quantidade || 1));
  }

  let candidatos = [...porPessoa.entries()];
  if (semRepetir) {
    const jaGanharam = new Set(sorteios.map((s) => s.ganhador));
    const sobra = candidatos.filter(([h]) => !jaGanharam.has(h));
    if (sobra.length) candidatos = sobra;
  }

  if (!candidatos.length) {
    $("#ganhador").textContent = "";
    $("#detalheSorteio").textContent = soCarpa
      ? "Ninguém mandou carpa ainda."
      : "Ninguém mandou emotion ainda.";
    return;
  }

  // Com peso, quem mandou mais tem mais bilhetes. Sem peso, uma chance cada.
  const bilhetes = [];
  for (const [h, qtd] of candidatos) {
    const n = comPeso ? qtd : 1;
    for (let i = 0; i < n; i++) bilhetes.push(h);
  }
  const ganhador = bilhetes[Math.floor(Math.random() * bilhetes.length)];

  sorteios.push({ ts: Date.now(), ganhador, entre: candidatos.length, soCarpa, comPeso });
  await salvar({ sorteios });

  $("#ganhador").textContent = "@" + ganhador;
  const qtd = porPessoa.get(ganhador);
  $("#detalheSorteio").textContent =
    `${qtd} ${soCarpa ? "carpa(s)" : "emotion(s)"} · sorteado entre ${candidatos.length} pessoas` +
    (comPeso ? " · com peso" : " · chance igual") +
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

$("#zerar").addEventListener("click", async () => {
  await salvar({ emocoes: [], sorteios: [] });
  sorteios = [];
  pintar();
});

pintar();
setInterval(pintar, 2000);
