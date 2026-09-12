// Ponte entre a página da Jamble e o serviço da extensão.
(() => {
  const MARCA = "vv-ranking";

  // Coloca o inject.js dentro da página (o content script não enxerga o
  // WebSocket do site, por isso o injetado precisa rodar no mundo da página).
  const tag = document.createElement("script");
  tag.src = chrome.runtime.getURL("inject.js");
  tag.onload = () => tag.remove();
  (document.head || document.documentElement).appendChild(tag);

  function contexto() {
    const m = location.pathname.match(/\/(?:live|lives|l)\/([\w-]+)/i);
    return {
      liveId: m ? m[1] : location.pathname.replace(/\W+/g, "-").slice(0, 60) || "sem-live",
      titulo: document.title.replace(/\s*\|\s*Jamble.*$/i, "").trim().slice(0, 80),
      url: location.href,
    };
  }

  function mandar(tipo, dados) {
    try {
      chrome.runtime.sendMessage({ tipo, dados, contexto: contexto() });
    } catch {
      // A extensão foi recarregada: a página precisa ser recarregada também.
    }
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.marca !== MARCA) return;
    if (e.data.tipo === "venda") mandar("venda", e.data.dados);
    else if (e.data.tipo === "candidato") mandar("candidato", e.data.dados);
    else if (e.data.tipo === "ligado") mandar("ligado", e.data.dados);
  });

  chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
    if (msg?.tipo === "modo") {
      window.postMessage({ marca: MARCA, tipo: "modo", dados: msg.dados }, "*");
    }
    if (msg?.tipo === "contexto") responder(contexto());
    return true;
  });

  // ---------- rede de segurança: ler o aviso de compra na tela ----------

  const FRASE = /@?([a-zA-Z0-9._-]{2,30})\s+(?:comprou|levou|arrematou|acabou de comprar|bought)/i;
  const VALOR = /R\$\s*([\d.]+,\d{2}|\d+)/i;
  const vistos = new Set();

  function daTela(texto) {
    const t = texto.replace(/\s+/g, " ").trim();
    if (t.length < 6 || t.length > 200) return;
    const quem = t.match(FRASE);
    const quanto = t.match(VALOR);
    if (!quem || !quanto) return;
    const centavos = Math.round(Number(quanto[1].replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) return;
    const id = `tela:${quem[1].toLowerCase()}:${centavos}:${Math.floor(Date.now() / 10000)}`;
    if (vistos.has(id)) return;
    vistos.add(id);
    mandar("venda", { id, handle: quem[1], centavos, ts: Date.now(), origem: "tela", _confiavel: true });
  }

  const observador = new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      for (const no of m.addedNodes) {
        if (no.nodeType === Node.TEXT_NODE) daTela(no.textContent || "");
        else if (no.nodeType === Node.ELEMENT_NODE) daTela(no.textContent || "");
      }
    }
  });

  const ligar = () => observador.observe(document.body, { childList: true, subtree: true });
  if (document.body) ligar();
  else document.addEventListener("DOMContentLoaded", ligar);
})();
