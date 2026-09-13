// Roda nas páginas da LigaPokemon, mas fica calado: só responde quando você
// clica em "Ler preço" na janelinha da extensão. Não envia nada sozinho.
chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg?.tipo !== "ler-precos") return;

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
    const contexto = (el.parentElement?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60);
    achados.push({ centavos, contexto });
    if (achados.length >= 10) break;
  }

  achados.sort((a, b) => a.centavos - b.centavos);
  responder({ titulo: document.title.slice(0, 80), codigo, achados });
  return true;
});
