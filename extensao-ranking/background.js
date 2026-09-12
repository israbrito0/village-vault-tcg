// Junta as vendas capturadas e envia de tempos em tempos para o site.

// config-local.js fica só neste computador (não vai para o GitHub) e traz o
// token já preenchido, para não precisar digitar nada na primeira vez.
let TOKEN_LOCAL = "";
try {
  importScripts("config-local.js");
  TOKEN_LOCAL = self.VV_TOKEN ?? "";
} catch {
  // Sem o arquivo: o token é o que estiver salvo pela janelinha da extensão.
}

const PADRAO = {
  endpoint: "https://www.villagetcg.com.br/api/ranking/eventos",
  token: "",
  modoValor: "auto",
  ativo: true,
};

const ESPERA_MS = 6000; // manda em lote, para não bater no site a cada compra
let agendado = null;

async function ler(chaves) {
  return chrome.storage.local.get(chaves);
}

async function config() {
  const { config } = await ler("config");
  const junto = { ...PADRAO, ...(config ?? {}) };
  if (!junto.token) junto.token = TOKEN_LOCAL;
  return junto;
}

// Avisa o site que a extensão está viva. Não mexe em nenhum número: serve só
// para o painel de métricas mostrar "extensão deu sinal há X".
async function darSinal(origem) {
  const cfg = await config();
  if (!cfg.token) return;
  const { stats } = await estado();
  if (stats.ultimoSinal && Date.now() - stats.ultimoSinal < 10 * 60 * 1000) return;
  try {
    const r = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ acao: "ping", origem }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await chrome.storage.local.set({ stats: { ...stats, ultimoSinal: Date.now(), ultimoErro: "" } });
  } catch (e) {
    await chrome.storage.local.set({ stats: { ...stats, ultimoErro: String(e.message || e) } });
  }
}

async function estado() {
  const g = await ler(["fila", "stats", "candidatos", "liveAtual"]);
  return {
    fila: g.fila ?? [],
    stats: g.stats ?? { enviados: 0, ultimoEnvio: 0, ultimoErro: "", ultimaVenda: 0 },
    candidatos: g.candidatos ?? [],
    liveAtual: g.liveAtual ?? null,
  };
}

async function guardarVenda(evento, ctx) {
  const cfg = await config();
  if (!cfg.ativo) return;
  const { fila, stats } = await estado();
  if (fila.some((e) => e.id === evento.id)) return;
  fila.push({
    id: String(evento.id),
    handle: String(evento.handle).replace(/^@/, ""),
    centavos: Math.round(Number(evento.centavos)),
    ts: evento.ts ?? Date.now(),
    origem: evento.origem ?? "",
  });
  stats.ultimaVenda = Date.now();
  await chrome.storage.local.set({
    fila: fila.slice(-2000),
    stats,
    liveAtual: ctx ? { id: ctx.liveId, titulo: ctx.titulo, url: ctx.url } : null,
  });
  if (!agendado) agendado = setTimeout(enviar, ESPERA_MS);
}

async function enviar() {
  agendado = null;
  const cfg = await config();
  const { fila, stats, liveAtual } = await estado();
  if (!cfg.token || !fila.length) return;

  const lote = fila.slice(0, 300);
  try {
    const r = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({
        liveId: liveAtual?.id ?? "live",
        titulo: liveAtual?.titulo ?? undefined,
        eventos: lote.map(({ id, handle, centavos, ts }) => ({ id, handle, centavos, ts })),
      }),
    });
    const resposta = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(resposta?.erro || `HTTP ${r.status}`);
    const resto = fila.slice(lote.length);
    await chrome.storage.local.set({
      fila: resto,
      stats: {
        ...stats,
        enviados: (stats.enviados ?? 0) + lote.length,
        ultimoEnvio: Date.now(),
        ultimoErro: "",
        ultimaResposta: resposta,
      },
    });
    if (resto.length) agendado = setTimeout(enviar, 1500);
  } catch (e) {
    await chrome.storage.local.set({ stats: { ...stats, ultimoErro: String(e.message || e) } });
    // Tenta de novo no próximo alarme, sem perder a fila.
  }
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  (async () => {
    if (msg?.tipo === "venda") {
      await guardarVenda(msg.dados, msg.contexto);
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "candidato") {
      const { candidatos } = await estado();
      const novos = [...candidatos, { quando: Date.now(), ...msg.dados }].slice(-40);
      await chrome.storage.local.set({ candidatos: novos });
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "ligado") {
      // Avisa as abas da Jamble como interpretar os valores (centavos ou reais).
      const cfg = await config();
      try {
        const abas = await chrome.tabs.query({ url: "https://*.jamble.com/*" });
        for (const aba of abas) {
          try {
            await chrome.tabs.sendMessage(aba.id, { tipo: "modo", dados: cfg.modoValor });
          } catch {
            // Aba ainda sem o content script: ela pega o modo ao recarregar.
          }
        }
      } catch {}
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "enviar-agora") {
      await enviar();
      responder(await estado());
      return;
    }
    if (msg?.tipo === "estado") {
      responder({ ...(await estado()), config: await config() });
      return;
    }
    if (msg?.tipo === "config") {
      await chrome.storage.local.set({ config: { ...(await config()), ...msg.dados } });
      const { stats } = await estado();
      await chrome.storage.local.set({ stats: { ...stats, ultimoSinal: 0 } });
      await darSinal("configurada");
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "comando") {
      const cfg = await config();
      try {
        const r = await fetch(cfg.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
          body: JSON.stringify({ acao: msg.dados.acao, liveId: msg.dados.liveId }),
        });
        responder(await r.json().catch(() => ({ erro: `HTTP ${r.status}` })));
      } catch (e) {
        responder({ erro: String(e.message || e) });
      }
      return;
    }
    if (msg?.tipo === "manual") {
      await guardarVenda(
        {
          id: `manual:${Date.now()}`,
          handle: msg.dados.handle,
          centavos: msg.dados.centavos,
          ts: Date.now(),
          origem: "manual",
        },
        msg.dados.contexto,
      );
      await enviar();
      responder(await estado());
      return;
    }
    if (msg?.tipo === "limpar-fila") {
      await chrome.storage.local.set({ fila: [] });
      responder({ ok: true });
      return;
    }
    responder({ ok: false });
  })();
  return true;
});

// Rede de segurança: mesmo que a página fique quieta, tenta esvaziar a fila.
chrome.alarms.create("enviar", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "enviar") {
    enviar();
    darSinal("rotina");
  }
});

chrome.runtime.onInstalled.addListener(() => darSinal("instalada"));
chrome.runtime.onStartup.addListener(() => darSinal("navegador aberto"));
