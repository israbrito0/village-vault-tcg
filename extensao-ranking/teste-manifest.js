// Confere o manifest antes de o Chrome reclamar: arquivo citado que não existe
// faz a extensão não carregar, e aí nada funciona na hora da live.
const fs = require("fs");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

const m = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
const existe = (f) => fs.existsSync(path.join(__dirname, f));

conferir(m.manifest_version === 3, "manifest v3");
conferir(!!m.version, "tem versão", m.version);

// ---------- todo arquivo citado existe ----------

const citados = new Set();
citados.add(m.background.service_worker);
citados.add(m.action.default_popup);
for (const cs of m.content_scripts) for (const j of cs.js) citados.add(j);
for (const w of m.web_accessible_resources ?? []) for (const r of w.resources) citados.add(r);

for (const f of citados) conferir(existe(f), `existe: ${f}`);

// ---------- arquivos que o HTML carrega ----------

for (const html of ["popup.html", "painel.html"]) {
  const texto = fs.readFileSync(path.join(__dirname, html), "utf8");
  for (const m2 of texto.matchAll(/<script src="([^"]+)"/g)) {
    conferir(existe(m2[1]), `${html} carrega ${m2[1]}`);
  }
}

// ---------- ordem dos content scripts ----------
// content.js usa idDaLive/ehPainelDoVendedor, que vêm do gemas.js. Se o
// gemas.js não vier antes, o content.js quebra na primeira página da Jamble.

const naJamble = m.content_scripts.find((c) => c.js.includes("content.js"));
conferir(!!naJamble, "existe content script da Jamble");
conferir(
  naJamble.js.indexOf("gemas.js") >= 0 && naJamble.js.indexOf("gemas.js") < naJamble.js.indexOf("content.js"),
  "gemas.js vem antes do content.js",
  naJamble.js.join(" , "),
);

// O que o content.js usa de fora precisa estar no gemas.js.
const gemas = fs.readFileSync(path.join(__dirname, "gemas.js"), "utf8");
const content = fs.readFileSync(path.join(__dirname, "content.js"), "utf8");
for (const fn of ["idDaLive", "ehPainelDoVendedor"]) {
  if (!content.includes(fn)) continue;
  conferir(new RegExp(`function ${fn}\\b`).test(gemas), `gemas.js define ${fn}, usado pelo content.js`);
}

// O background carrega o gemas.js por importScripts e usa o diffGemas.
const bg = fs.readFileSync(path.join(__dirname, "background.js"), "utf8");
conferir(bg.includes('importScripts("gemas.js")'), "background carrega o gemas.js");
conferir(!bg.includes("diffGemas") || /function diffGemas\b/.test(gemas), "gemas.js define diffGemas");

// O painel usa as contas do gemas.js: o HTML precisa carregar antes.
const painelHtml = fs.readFileSync(path.join(__dirname, "painel.html"), "utf8");
conferir(
  painelHtml.indexOf('src="gemas.js"') >= 0 && painelHtml.indexOf('src="gemas.js"') < painelHtml.indexOf('src="painel.js"'),
  "painel.html carrega gemas.js antes de painel.js",
);

// As contas de leilão, batalha, chat e clientes ficam no analises.js. O
// background e o painel chamam essas funções pelo nome: se uma sumir ou mudar
// de nome lá, a chamada aqui quebra só na hora da live.
const analises = require("./analises.js");
conferir(bg.includes('importScripts("analises.js")'), "background carrega o analises.js");
conferir(
  painelHtml.indexOf('src="analises.js"') >= 0 &&
    painelHtml.indexOf('src="analises.js"') < painelHtml.indexOf('src="painel.js"'),
  "painel.html carrega analises.js antes de painel.js",
);
conferir(
  m.web_accessible_resources.some((w) => w.resources.includes("analises.js")),
  "analises.js pode ser carregado pelo painel dentro da live",
);
const painelJsTexto = fs.readFileSync(path.join(__dirname, "painel.js"), "utf8");
const ESPERADAS = {
  "background.js": [
    bg,
    ["leilaoDoFrame", "mesclarLeilao", "batalhaDoFrame", "mensagensDoFrame", "sorteioJambleDoFrame", "ofertaDoFrame", "resumoDaLive", "rankingDaResposta", "regrasDoRanking"],
  ],
  "painel.js": [
    painelJsTexto,
    ["resumirVendas", "rankingDeCompras", "gemasPelaBatalha", "juntarGemas", "quemDisputou", "resumirBatalha", "resumirChat", "resumirOfertas", "minhaPosicao", "pontosDaLive", "historicoComLives", "clientes"],
  ],
};
for (const [arquivo, [texto, funcoes]] of Object.entries(ESPERADAS)) {
  for (const fn of funcoes) {
    conferir(
      new RegExp(`\\b${fn}\\(`).test(texto) && typeof analises[fn] === "function",
      `${arquivo} chama ${fn}, e o analises.js define`,
    );
  }
}

// Cada aba tem botão e seção, e o painel.js liga uma na outra pelo nome.
const abasBotao = [...painelHtml.matchAll(/<button type="button" data-aba="(\w+)"/g)].map((x) => x[1]);
const abasSecao = [...painelHtml.matchAll(/<section data-aba="(\w+)"/g)].map((x) => x[1]);
conferir(
  abasBotao.length >= 4 && abasBotao.join() === abasSecao.join(),
  "cada aba do painel tem botão e seção",
  `${abasBotao} | ${abasSecao}`,
);

// ---------- todo id que o painel.js procura existe no HTML ----------
// $("#x") que não existe vira erro na hora de ligar o clique, e a página
// inteira para de funcionar.

const painelJs = fs.readFileSync(path.join(__dirname, "painel.js"), "utf8");
const idsUsados = [...painelJs.matchAll(/\$\("#([\w-]+)"\)/g)].map((x) => x[1]);
const faltando = [...new Set(idsUsados)].filter((id) => !painelHtml.includes(`id="${id}"`));
conferir(faltando.length === 0, "todo id usado pelo painel.js existe no painel.html", faltando.join(", "));

const popupHtml = fs.readFileSync(path.join(__dirname, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(__dirname, "popup.js"), "utf8");
const idsPopup = [...popupJs.matchAll(/\$\("([\w-]+)"\)/g)].map((x) => x[1]);
const faltandoPopup = [...new Set(idsPopup)].filter((id) => !popupHtml.includes(`id="${id}"`));
conferir(faltandoPopup.length === 0, "todo id usado pelo popup.js existe no popup.html", faltandoPopup.join(", "));

// ---------- permissões de host cobrem o que a extensão usa ----------

const hosts = m.host_permissions.join(" ");
conferir(/jamble\.com/.test(hosts), "tem permissão para a Jamble");
conferir(
  m.content_scripts.some((c) => c.matches.some((x) => x.includes("jamble.com"))),
  "o content script roda na Jamble",
);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
