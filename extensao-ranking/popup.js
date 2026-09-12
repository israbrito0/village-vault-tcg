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
