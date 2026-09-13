const $ = (id) => document.getElementById(id);
const pedir = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

function reais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function quando(ts) {
  if (!ts) return "nunca";
  const seg = Math.round((Date.now() - ts) / 1000);
  if (seg < 60) return `há ${seg}s`;
  if (seg < 3600) return `há ${Math.round(seg / 60)} min`;
  return `há ${Math.round(seg / 3600)}h`;
}

function valorEmCentavos(txt) {
  const limpo = String(txt).replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

async function pintar() {
  const e = await pedir({ tipo: "estado" });
  $("endpoint").value = e.config.endpoint;
  $("token").value = e.config.token;
  $("modo").value = e.config.modoValor;
  $("ativo").checked = e.config.ativo;
  const guardado = await new Promise((r) => chrome.storage.local.get("tokenPainel", (g) => r(g.tokenPainel ?? "")));
  if (guardado && !$("tokenPainel").value) $("tokenPainel").value = guardado;

  const topo = e.stats.ultimaResposta?.top ?? [];
  $("painel").innerHTML = `
    <div><b>${e.liveAtual?.titulo || "Nenhuma live detectada"}</b></div>
    <div>na fila: ${e.fila.length} · enviados: ${e.stats.enviados ?? 0}</div>
    <div>última venda: ${quando(e.stats.ultimaVenda)} · último envio: ${quando(e.stats.ultimoEnvio)}</div>
    ${e.stats.ultimoErro ? `<div class="erro">erro: ${e.stats.ultimoErro}</div>` : '<div class="ok">sem erros</div>'}
    ${topo.length ? `<div style="margin-top:6px">${topo.map((c, i) => `${i + 1}. @${c.handle} — ${reais(c.centavos)}`).join("<br>")}</div>` : ""}
    ${e.candidatos.length ? `<div style="margin-top:6px;color:#6b7280">${e.candidatos.length} payloads em dúvida (use "Baixar depuração")</div>` : ""}
  `;
}

$("salvar").onclick = async () => {
  await pedir({
    tipo: "config",
    dados: {
      endpoint: $("endpoint").value.trim(),
      token: $("token").value.trim(),
      modoValor: $("modo").value,
      ativo: $("ativo").checked,
    },
  });
  pintar();
};

$("enviar").onclick = async () => {
  await pedir({ tipo: "enviar-agora" });
  pintar();
};

$("somar").onclick = async () => {
  const handle = $("mHandle").value.trim().replace(/^@/, "");
  const centavos = valorEmCentavos($("mValor").value);
  if (!handle || !centavos) {
    alert("Escreva o @ da pessoa e o valor, ex.: 250,00");
    return;
  }
  await pedir({ tipo: "manual", dados: { handle, centavos } });
  $("mHandle").value = "";
  $("mValor").value = "";
  pintar();
};

$("zerarLive").onclick = async () => {
  if (!confirm("Zerar o ranking da live atual? O acumulado continua.")) return;
  const r = await pedir({ tipo: "comando", dados: { acao: "zerar-live" } });
  alert(r?.erro ? `Erro: ${r.erro}` : "Ranking da live zerado.");
  pintar();
};

// ---------------------------------------------------------- preço da Liga
// Lê apenas a aba que VOCÊ abriu, quando você clica. Não navega, não varre.

function lerPrecosDaPagina() {
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
  return { titulo: document.title.slice(0, 80), codigo, achados };
}

$("ligaLer").onclick = async () => {
  const caixa = $("ligaResultado");
  caixa.innerHTML = "lendo…";
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.url?.includes("ligapokemon.com.br")) {
    caixa.innerHTML = '<span class="erro">Abra a carta na LigaPokemon nesta aba primeiro.</span>';
    return;
  }
  let leitura;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: lerPrecosDaPagina });
    leitura = r?.result;
  } catch (e) {
    caixa.innerHTML = `<span class="erro">${e.message}</span>`;
    return;
  }
  if (!leitura?.achados?.length) {
    caixa.innerHTML = '<span class="erro">Não achei preço nessa página.</span>';
    return;
  }
  if (leitura.codigo && !$("ligaCodigo").value) $("ligaCodigo").value = leitura.codigo;

  caixa.innerHTML = `<div class="painel"><b>${leitura.titulo}</b><div id="ligaLista"></div></div>`;
  const lista = document.getElementById("ligaLista");
  for (const achado of leitura.achados.slice(0, 6)) {
    const b = document.createElement("button");
    b.textContent = `${reais(achado.centavos)} — ${achado.contexto || "usar este"}`;
    b.style.cssText = "display:block;width:100%;text-align:left;margin-top:6px";
    b.onclick = () => salvarPrecoDaLiga(achado.centavos);
    lista.appendChild(b);
  }
};

async function salvarPrecoDaLiga(centavos) {
  const caixa = $("ligaResultado");
  const codigo = $("ligaCodigo").value.trim();
  const painel = $("tokenPainel").value.trim();
  if (!codigo) return (caixa.innerHTML = '<span class="erro">Escreva o código da carta.</span>');
  if (!painel) return (caixa.innerHTML = '<span class="erro">Falta a chave do painel.</span>');

  const site = new URL($("endpoint").value.trim()).origin;
  caixa.innerHTML = "procurando a carta…";
  const busca = await fetch(`${site}/api/cartas/buscar`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${painel}` },
    body: JSON.stringify({ codigo }),
  }).then((r) => r.json());
  const carta = busca.cartas?.[0];
  if (!carta) return (caixa.innerHTML = '<span class="erro">Não achei essa carta pelo código.</span>');

  const r = await fetch(`${site}/api/cartas/preco`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${painel}` },
    body: JSON.stringify({ cartaId: carta.id, nome: carta.nome, centavos, fonte: "liga" }),
  });
  const resposta = await r.json();
  caixa.innerHTML = r.ok
    ? `<span class="ok">${carta.nome}: ${reais(centavos)} salvo como preço da casa.</span>`
    : `<span class="erro">${resposta.erro ?? "não deu"}</span>`;
  chrome.storage.local.set({ tokenPainel: painel });
}

$("depurar").onclick = async () => {
  const e = await pedir({ tipo: "estado" });
  const conteudo = JSON.stringify({ ...e, config: { ...e.config, token: "(escondido)" } }, null, 2);
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  await chrome.downloads?.download?.({ url, filename: "ranking-depuracao.json" }).catch?.(() => {});
  // Sem permissão de download: abre numa aba para salvar na mão.
  chrome.tabs.create({ url });
};

pintar();
setInterval(pintar, 3000);
