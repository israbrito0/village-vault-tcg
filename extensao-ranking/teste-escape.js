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

// Tira os esc(...) com os argumentos, contando parênteses -- esc(String(x))
// tem parêntese dentro e uma regex simples pararia no lugar errado.
function semEscapados(texto) {
  let t = texto;
  for (let volta = 0; volta < 20; volta++) {
    const i = t.indexOf("esc(");
    if (i < 0) break;
    let nivel = 0;
    let fim = -1;
    for (let j = i + 3; j < t.length; j++) {
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
