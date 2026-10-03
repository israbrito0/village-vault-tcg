// Teste de escape: rode com `node extensao-ranking/teste-escape.js`.
//
// Nome de espectador, @ e título de live são escritos por outras pessoas e
// entram em HTML no painel e na janelinha da extensão. Essas páginas são da
// extensão: enxergam o chrome.storage, onde fica o token do site. Um nome com
// <img onerror=...> rodando ali daria acesso ao token -- por isso tudo que vem
// de fora passa pelo esc() antes de virar HTML.
const fs = require("fs");
const path = require("path");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

// Usa o esc() como está escrito em cada arquivo, não uma cópia.
function escDe(arquivo) {
  const fonte = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
  const corpo = fonte.match(/const ESCAPES = \{[\s\S]*?\n(?:const esc =[^\n]*\n)/);
  if (!corpo) return null;
  return new Function(`${corpo[0]}; return esc;`)();
}

const ATAQUES = [
  ['<img src=x onerror="alert(1)">', /<img/],
  ["<script>roubar()</script>", /<script/],
  ['" onmouseover="roubar()', /onmouseover="/],
  ["'><svg onload=roubar()>", /<svg/],
  ["</td><td><a href=javascript:roubar()>", /<a /],
];

for (const arquivo of ["painel.js", "popup.js"]) {
  const esc = escDe(arquivo);
  conferir(!!esc, `${arquivo} define esc()`);
  if (!esc) continue;

  for (const [ataque, marca] of ATAQUES) {
    const saida = esc(ataque);
    conferir(!marca.test(saida), `${arquivo}: neutraliza ${ataque.slice(0, 28)}`, saida.slice(0, 50));
  }

  conferir(esc("jako") === "jako", `${arquivo}: nome normal passa inteiro`);
  conferir(esc("fabio.meneguello") === "fabio.meneguello", `${arquivo}: ponto no nome não vira nada`);
  conferir(esc("Tom & Jerry") === "Tom &amp; Jerry", `${arquivo}: & vira &amp;`, esc("Tom & Jerry"));
  conferir(esc(null) === "" && esc(undefined) === "", `${arquivo}: vazio não quebra`);
}

// ---------- nenhum campo de fora entra em HTML sem escapar ----------
// Regra direta: estes campos são escritos por outras pessoas (espectador,
// vendedor, LigaPokemon, resposta de servidor). Numa linha que monta HTML,
// cada um deles tem que estar dentro de um esc().
//
// Olha só acesso a propriedade (.nome, .handle). Assim um texto literal como
// "erro:" escrito no HTML não vira alarme falso.

const DE_FORA = /\.(nome|handle|titulo|ganhador|icone|erro|message|displayName|username)\b/;

// Funções que escapam por dentro e por isso valem como esc(). Cada uma é
// conferida mais abaixo: precisa mesmo passar o que recebe pelo esc().
const ESCAPAM = ["esc(", "quem(", "figura(", "chip(", "avatar("];

// Tira os esc(...) com os argumentos, contando parênteses -- esc(String(x))
// tem parêntese dentro e uma regex simples pararia no lugar errado.
function semEscapados(texto) {
  let t = texto;
  for (let volta = 0; volta < 20; volta++) {
    const achados = ESCAPAM.map((f) => [t.indexOf(f), f]).filter(([i]) => i >= 0);
    if (!achados.length) break;
    const [i, f] = achados.sort((a, b) => a[0] - b[0])[0];
    let nivel = 0;
    let fim = -1;
    for (let j = i + f.length - 1; j < t.length; j++) {
      if (t[j] === "(") nivel++;
      else if (t[j] === ")" && --nivel === 0) {
        fim = j;
        break;
      }
    }
    if (fim < 0) break;
    t = t.slice(0, i) + t.slice(fim + 1);
  }
  return t;
}

const cru = (linha) => DE_FORA.test(semEscapados(linha));

for (const arquivo of ["painel.js", "popup.js"]) {
  const fonte = fs.readFileSync(path.join(__dirname, arquivo), "utf8");
  const suspeitas = fonte
    .split("\n")
    .filter((l) => /<\w|<\//.test(l) && l.includes("${") && cru(l))
    .map((l) => l.trim().slice(0, 70));
  conferir(suspeitas.length === 0, `${arquivo}: campo de fora só entra em HTML escapado`, suspeitas.join(" | "));
}

// quem() conta como escapado: então ela tem que escapar mesmo. Roda a função
// de verdade, do jeito que está escrita no painel.js.
{
  const fonte = fs.readFileSync(path.join(__dirname, "painel.js"), "utf8");
  const def = fonte.match(/const quem = [^\n]*\n/);
  conferir(!!def, "painel.js define quem()");
  if (def) {
    const quem = new Function("esc", `${def[0]}; return quem;`)(escDe("painel.js"));
    const saida = quem('<img src=x onerror="alert(1)">');
    conferir(!/<img/.test(saida) && saida.startsWith("@"), "quem() escapa o @ que recebe", saida);
    conferir(/anonimo/.test(quem(null)), "quem() sem @ mostra 'ainda sem nome'");
  }
}

// figura() e chip() também contam como escapadas: a figurinha do emotion é um
// endereço que vem de fora e vira <img src="...">. Rodam aqui de verdade, com
// nome de ícone e endereço montados para atacar.
{
  const fonte = fs.readFileSync(path.join(__dirname, "painel.js"), "utf8").replace(/\r\n/g, "\n");
  const defs = [/const nomeIcone = [^\n]*\n/, /function figura\([\s\S]*?\n}\n/, /function chip\([\s\S]*?\n}\n/].map(
    (re) => (fonte.match(re) || [""])[0],
  );
  conferir(defs.every(Boolean), "painel.js define figura() e chip()");
  if (defs.every(Boolean)) {
    const { urlDeImagem } = require("./gemas.js");
    const { figura, chip } = new Function("esc", "num", "urlDeImagem", `${defs.join("")}; return { figura, chip };`)(
      escDe("painel.js"),
      (n) => String(n),
      urlDeImagem,
    );
    const BOA = "https://jamble-test.b-cdn.net/like_icons/magikarp_shiny.png";
    const nomeRuim = { x: '<img src=x onerror="alert(1)">' };
    const comNomeRuim = figura("x", nomeRuim, { x: BOA }) + chip("x", 3, nomeRuim, { x: BOA });
    conferir(
      (comNomeRuim.match(/<img/g) || []).length === 2 && !/onerror="/.test(comNomeRuim),
      "nome de ícone com <img onerror> não vira código",
      comNomeRuim.slice(0, 90),
    );
    conferir(figura("x", {}, { x: BOA }).includes(`src="${BOA}"`), "a figurinha de verdade aparece");
    for (const ruim of [
      "javascript:alert(1)",
      'https://jamble-test.b-cdn.net/a.png" onerror="alert(1)',
      "https://site-qualquer.com/a.png",
      "http://jamble-test.b-cdn.net/a.png",
      "data:image/svg+xml,<svg onload=alert(1)>",
    ]) {
      conferir(figura("x", {}, { x: ruim }) === "", `endereço recusado: ${ruim.slice(0, 40)}`);
    }
    conferir(chip("x", 2, { x: "<b>x</b>" }, {}) === '<span class="chip texto">&lt;b&gt;x&lt;/b&gt; ×2</span>', "sem figurinha, o nome entra escapado");
  }
}

// avatar() também conta como escapada: a foto de perfil é endereço de fora, e
// o @ e o nome são escritos pela própria pessoa.
{
  const fonte = fs.readFileSync(path.join(__dirname, "painel.js"), "utf8").replace(/\r\n/g, "\n");
  const defs = [/function corDe\([\s\S]*?\n}\n/, /function avatar\([\s\S]*?\n}\n/].map((re) => (fonte.match(re) || [""])[0]);
  conferir(defs.every(Boolean), "painel.js define avatar()");
  if (defs.every(Boolean)) {
    const { urlDeImagem } = require("./gemas.js");
    const avatar = new Function("esc", "urlDeImagem", `${defs.join("")}; return avatar;`)(escDe("painel.js"), urlDeImagem);
    const FOTO = "https://jamble.b-cdn.net/profiles/user_id=abc/profile_images/a.png";
    conferir(avatar("ana", "Ana", { ana: FOTO }).includes(`src="${FOTO}"`), "a foto de perfil de verdade aparece");
    const ruins = [
      avatar("ana", "Ana", { ana: 'https://jamble.b-cdn.net/a.png" onerror="alert(1)' }),
      avatar("ana", "Ana", { ana: "javascript:alert(1)" }),
      avatar('"><img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>', {}),
    ];
    conferir(ruins.every((h) => !/onerror=|javascript:|<img src=x/.test(h)), "foto, @ e nome montados para atacar não viram código", ruins.join(" | ").slice(0, 120));
    conferir(/^<span class="avatar letra" style="background:hsl\(\d+ 45% 42%\)">A<\/span>$/.test(avatar("ana", "Ana", {})), "sem foto: a inicial num círculo de cor fixa");
  }
}

// O verificador só vale se reprovar de verdade.
conferir(cru("`<td>${d.nome}</td>`"), "a regra reprova nome cru");
conferir(cru("`<td>@${d.handle}</td>`"), "reprova @ cru");
conferir(!cru("`<td>${esc(d.nome)}</td>`"), "aprova nome escapado");
conferir(!cru("`<td>${esc(d.nome)} @${esc(d.handle)}</td>`"), "aprova nome e @ escapados juntos");
conferir(!cru("`<option>${esc(String(l.titulo || l.id).slice(0, 40))}</option>`"), "aprova esc() com parêntese dentro");
conferir(!cru('`<td>${d.gemas ? num(d.gemas) : "—"}</td>`'), "número não é campo de fora");
conferir(!cru('`<div class="erro">erro: ${esc(e.stats.ultimoErro)}</div>`'), "texto literal 'erro:' não é alarme falso");

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
