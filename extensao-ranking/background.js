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

// As contas de gemas ficam em gemas.js, compartilhadas com o painel e o teste.
importScripts("gemas.js");

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

// Quem mandou qual icone, ao vivo. Diferente da participacao (que e a foto do
// total e chega de tempos em tempos), isto e evento: vem na hora, um por envio.
// So cobre o tempo em que a aba da live ficou aberta -- por isso os totais
// grandes continuam saindo da participacao, que e a Jamble quem calcula.
// Numa live movimentada chegam muitas emotions seguidas. Gravar uma por uma
// significaria ler e reescrever o armazenamento inteiro a cada envio -- entao
// elas se juntam por um instante e vao de uma vez so.
const ESPERA_EMOCAO_MS = 800;
const MAXIMO_NA_FILA = 40;
let filaEmocoes = [];
let agendadoEmocao = null;

async function descarregarEmocoes() {
  agendadoEmocao = null;
  const lote = filaEmocoes;
  filaEmocoes = [];
  if (!lote.length) return;

  const g = await ler(["lives"]);
  const lives = g.lives ?? {};

  for (const { evento, ctx } of lote) {
    const id = ctx?.showId || ctx?.liveId || "sem-live";
    const live = (lives[id] = lives[id] ?? {
      id,
      titulo: ctx?.titulo ?? "",
      doPainel: ctx?.doPainel ?? false,
      quando: Date.now(),
      linhas: [],
      eventos: [],
      sorteios: [],
    });
    const emocoes = (live.emocoes = live.emocoes ?? []);
    // O mesmo evento chega repetido no WebSocket; o id da Jamble resolve.
    if (emocoes.some((e) => e.id === String(evento.id))) continue;
    emocoes.push({
      id: String(evento.id),
      handle: String(evento.handle ?? "").replace(/^@/, ""),
      nome: evento.nome || evento.handle || "",
      icone: String(evento.icone ?? ""),
      gemas: Number(evento.gemas) || 0,
      ts: Number(evento.ts) || Date.now(),
    });
    if (emocoes.length > 5000) live.emocoes = emocoes.slice(-5000);
    if (!live.titulo && ctx?.titulo) live.titulo = ctx.titulo;
  }

  await chrome.storage.local.set({ lives });
}

function guardarEmocao(evento, ctx) {
  if (!evento?.id) return;
  filaEmocoes.push({ evento, ctx });
  if (filaEmocoes.length >= MAXIMO_NA_FILA) {
    if (agendadoEmocao) clearTimeout(agendadoEmocao);
    descarregarEmocoes();
    return;
  }
  if (!agendadoEmocao) agendadoEmocao = setTimeout(descarregarEmocoes, ESPERA_EMOCAO_MS);
}

// As metricas da live como a Jamble calcula. Vem de duas respostas que se
// completam (summary e dashboard), entao juntamos em cima do que ja tinha em
// vez de substituir -- senao uma apagaria os campos da outra.
async function guardarMetricas(dados, ctx) {
  const valores = dados?.valores;
  if (!valores || typeof valores !== "object") return;
  const id = ctx?.showId || ctx?.liveId || "sem-live";
  const g = await ler(["lives"]);
  const lives = g.lives ?? {};
  const live = lives[id] ?? {
    id,
    titulo: ctx?.titulo ?? "",
    doPainel: ctx?.doPainel ?? false,
    quando: Date.now(),
    linhas: [],
    eventos: [],
    sorteios: [],
    emocoes: [],
  };
  live.metricas = { ...(live.metricas ?? {}), ...valores, quando: dados.quando ?? Date.now() };
  if (!live.titulo && ctx?.titulo) live.titulo = ctx.titulo;
  lives[id] = live;
  await chrome.storage.local.set({ lives });
}

// Quantas lives guardamos ao mesmo tempo. Ela costuma abrir a live de outra
// pessoa durante a propria live (para ver o ranking mensal), e aquela live
// tambem manda participacao. Se tudo caisse num balde so, uma apagaria o
// historico da outra -- entao cada live tem o seu.
const LIVES_GUARDADAS = 4;

// O ranking por pessoa vem pronto da Jamble (aba "Participacao"). A resposta e
// a foto completa da live, entao substitui a anterior em vez de somar -- mas
// antes comparamos com a foto de antes para saber quem enviou gemas agora.
async function guardarParticipacao(dados, ctx) {
  const id = ctx?.showId || ctx?.liveId || "sem-live";
  const g = await ler(["lives"]);
  const lives = g.lives ?? {};
  const antes = lives[id];

  const quando = dados.quando ?? Date.now();
  const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
  const { eventos, agora } = diffGemas(antes?.anterior, linhas, quando);

  lives[id] = {
    id,
    titulo: ctx?.titulo || antes?.titulo || "",
    doPainel: ctx?.doPainel ?? antes?.doPainel ?? false,
    quando,
    aoVivo: !!dados.aoVivo,
    pesos: dados.pesos ?? null,
    linhas,
    anterior: agora,
    eventos: (antes?.eventos ?? []).concat(eventos).slice(-3000),
    sorteios: antes?.sorteios ?? [],
    emocoes: antes?.emocoes ?? [],
    metricas: antes?.metricas ?? null,
  };

  // Deixa so as lives mexidas mais recentemente, para o armazenamento nao
  // crescer sem fim depois de muitas lives.
  const vivas = Object.values(lives)
    .sort((a, b) => b.quando - a.quando)
    .slice(0, LIVES_GUARDADAS);

  await chrome.storage.local.set({ lives: Object.fromEntries(vivas.map((l) => [l.id, l])) });
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
    if (msg?.tipo === "metricas") {
      await guardarMetricas(msg.dados, msg.contexto);
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "emocao") {
      await guardarEmocao(msg.dados, msg.contexto);
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "participacao") {
      await guardarParticipacao(msg.dados, msg.contexto);
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "eu") {
      // So o @ e o nome. Serve para o painel poder tirar voce do sorteio.
      await chrome.storage.local.set({ eu: { handle: msg.dados?.handle ?? "", nome: msg.dados?.nome ?? "" } });
      responder({ ok: true });
      return;
    }
    if (msg?.tipo === "tabela-emocoes") {
      await chrome.storage.local.set({
        tabelaEmocoes: msg.dados?.tabela ?? {},
        nomesEmocoes: msg.dados?.nomes ?? {},
      });
      responder({ ok: true });
      return;
    }
    // Sorteio e contagem "ao vivo" pertencem a UMA live. Passam por aqui em vez
    // de o painel escrever direto, para duas gravacoes nao se atropelarem.
    if (msg?.tipo === "mexer-na-live") {
      const { lives } = await ler(["lives"]);
      const todas = lives ?? {};
      const live = todas[msg.id];
      if (!live) {
        responder({ ok: false });
        return;
      }
      if (msg.acao === "zerar-ao-vivo") live.eventos = [];
      else if (msg.acao === "sortear") live.sorteios = (live.sorteios ?? []).concat(msg.sorteio);
      else if (msg.acao === "limpar-sorteios") live.sorteios = [];
      await chrome.storage.local.set({ lives: todas });
      responder({ ok: true });
      return;
    }
    // Pedido do painel: manda a aba da Jamble apertar o "Atualizar" dela. Vale
    // tanto o painel do vendedor quanto a página da live -- as duas têm a
    // participação, e quem acha o botão é o content.js de cada aba.
    if (msg?.tipo === "atualizar-participacao") {
      let pedidos = 0;
      try {
        const abas = await chrome.tabs.query({ url: "https://*.jamble.com/*" });
        for (const aba of abas) {
          try {
            const r = await chrome.tabs.sendMessage(aba.id, { tipo: "atualizar-participacao" });
            if (r?.ok) pedidos++;
          } catch {
            // Aba sem o content script ainda: recarregar a pagina resolve.
          }
        }
      } catch {}
      responder({ ok: pedidos > 0, pedidos });
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

// Chaves de versoes antigas que ninguem le mais. A de emotions chegava a
// guardar 20.000 registros por live; nao faz sentido ficar ocupando espaco.
const LIXO_ANTIGO = [
  "emocoes",
  "emocoesLive",
  "emocoesTitulo",
  "participacao",
  "participacaoLive",
  "participacaoTitulo",
  "gemasAnterior",
  "gemasEventos",
  "sorteios",
];

async function limparLixo() {
  try {
    await chrome.storage.local.remove(LIXO_ANTIGO);
  } catch {
    // Navegador sem suporte ou sem permissao: nao e motivo para quebrar nada.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  limparLixo();
  darSinal("instalada");
});
chrome.runtime.onStartup.addListener(() => {
  limparLixo();
  darSinal("navegador aberto");
});
