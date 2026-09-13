// Roda nas páginas da LigaPokemon, mas fica calado: só responde quando você
// clica em "Ler preço" na janelinha da extensão. Não envia nada sozinho.

const CONDICOES = /\b(NM|SP|MP|HP|D|M)\b|\b(Near ?Mint|Slightly ?Played|Moderately ?Played|Heavily ?Played|Damaged)\b/i;

// A condição costuma estar ao lado do preço, não no mesmo elemento: sobe
// alguns níveis procurando NM, SP, MP, HP ou D.
function condicaoPerto(el) {
  let atual = el;
  for (let i = 0; i < 4 && atual; i += 1) {
    const texto = (atual.innerText || "").replace(/\s+/g, " ");
    const achou = texto.match(CONDICOES);
    if (achou) return (achou[1] || achou[2]).toUpperCase().replace(/\s/g, "");
    atual = atual.parentElement;
  }
  return "";
}

function lerPrecos() {
  const texto = document.body.innerText;
  const codigo = texto.match(/\b(\d{1,3}\s*\/\s*\d{1,3})\b/)?.[1]?.replace(/\s/g, "") ?? "";
  const vistos = new Set();
  const achados = [];

  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || "").trim();
    const m = t.match(/^R\$\s*([\d.]+,\d{2})$/);
    if (!m) continue;
    const centavos = Math.round(Number(m[1].replace(/\./g, "").replace(",", ".")) * 100);
    if (!centavos || vistos.has(centavos)) continue;
    vistos.add(centavos);
    achados.push({
      centavos,
      condicao: condicaoPerto(el),
      contexto: (el.parentElement?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 70),
    });
    if (achados.length >= 12) break;
  }

  achados.sort((a, b) => a.centavos - b.centavos);
  return { titulo: document.title.slice(0, 80), codigo, achados };
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg?.tipo !== "ler-precos") return;
  responder(lerPrecos());
  return true;
});
