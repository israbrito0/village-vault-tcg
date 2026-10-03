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

// As contas de gemas ficam em gemas.js, e as de leilão, batalha, chat e
// clientes em analises.js -- as mesmas que o painel e os testes usam.
importScripts("gemas.js");
importScripts("analises.js");

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

// ---------- uma gravação por vez ----------
//
// Tudo da live mora numa chave só ("lives"), e cada gravação é ler, mexer e
// escrever de volta. Se duas acontecessem juntas -- uma emotion e uma métrica
// chegando no mesmo instante, o que numa live movimentada é o normal --, a
// segunda escreveria por cima da primeira e um dos dois sumiria. Então todas
// passam por esta fila e acontecem uma depois da outra.
let trava = Promise.resolve();
function emOrdem(fn) {
  const vez = trava.then(fn);
  trava = vez.catch(() => {});
  return vez;
}

// Quantas lives guardamos inteiras ao mesmo tempo. Ela costuma abrir a live de
// outra pessoa durante a propria live (para ver o ranking mensal), e aquela
// live tambem manda dados. Se tudo caisse num balde so, uma apagaria a outra
// -- entao cada live tem o seu. As que saem daqui continuam no histórico de
// clientes, resumidas.
const LIVES_GUARDADAS = 4;
// O histórico de clientes guarda o resumo por pessoa de até tantas lives.
const HISTORICO_MAX = 60;
// O dicionário código → @ cresce a cada live; acima disso, saem os mais antigos.
const PERFIS_MAX = 40000;

function novaLive(id, ctx) {
  return {
    id,
    titulo: ctx?.titulo ?? "",
    doPainel: ctx?.doPainel ?? false,
    quando: Date.now(),
    linhas: [],
    eventos: [],
    sorteios: [],
    emocoes: [],
  };
}

// "mexida" decide quem fica quando passa de LIVES_GUARDADAS. Não é o mesmo
// que "quando", que o painel usa para dizer se o número está velho. Sempre
// cresce, mesmo com duas lives mexidas no mesmo milissegundo: a última mexida
// é sempre a mais recente.
let ultimaMexida = 0;
function liveDe(lives, ctx) {
  const id = ctx?.showId || ctx?.liveId || "sem-live";
  const live = (lives[id] = lives[id] ?? novaLive(id, ctx));
  ultimaMexida = Math.max(Date.now(), ultimaMexida + 1);
  live.mexida = ultimaMexida;
  if (!live.titulo && ctx?.titulo) live.titulo = ctx.titulo;
  return live;
}

// O resumo de cada live no histórico é refeito a partir da live inteira, no
// máximo a cada 20 segundos por live (e sempre antes de ela sair do balde).
const ultimoResumo = {};
async function atualizarHistorico(lives, tocadas, saindo) {
  const agora = Date.now();
  const alvo = [
    ...tocadas.filter((id) => agora - (ultimoResumo[id] || 0) > 20000),
    ...saindo,
  ].filter((id, i, todos) => lives[id] && todos.indexOf(id) === i);
  if (!alvo.length) return;
  const g = await ler(["historico", "perfis"]);
  const historico = g.historico ?? {};
  for (const id of alvo) {
    const resumo = resumoDaLive(lives[id], g.perfis ?? {});
    if (Object.keys(resumo.pessoas).length) historico[id] = resumo;
    ultimoResumo[id] = agora;
  }
  const ficam = Object.entries(historico)
    .sort((a, b) => (b[1].quando || 0) - (a[1].quando || 0))
    .slice(0, HISTORICO_MAX);
  await chrome.storage.local.set({ historico: Object.fromEntries(ficam) });
}

async function gravarLives(lives, tocadas = []) {
  const ordem = Object.values(lives).sort((a, b) => (b.mexida || b.quando || 0) - (a.mexida || a.quando || 0));
  const ficam = ordem.slice(0, LIVES_GUARDADAS);
  const saindo = ordem.slice(LIVES_GUARDADAS).map((l) => l.id);
  await chrome.storage.local.set({ lives: Object.fromEntries(ficam.map((l) => [l.id, l])) });
  await atualizarHistorico(lives, tocadas, saindo);
}

function mexerNasLives(mudar) {
  return emOrdem(async () => {
    const g = await ler(["lives"]);
    const lives = g.lives ?? {};
    const r = await mudar(lives);
    if (r === false) return false;
    await gravarLives(lives, typeof r === "string" ? [r] : []);
    return r;
  });
}

// ---------- o que chega da live a toda hora ----------
//
// Emotions, leilões, batalha e chat chegam muitas vezes por minuto (num
// leilão, um frame a cada lance). Gravar cada um na hora seria reescrever o
// armazenamento inteiro a cada evento -- então eles se juntam por um instante
// e vão de uma vez só. 1,5s é menos do que o painel leva para redesenhar (2s):
// ninguém vê a diferença, e o computador grava metade das vezes.
const ESPERA_EMOCAO_MS = 1500;
const MAXIMO_NA_FILA = 40;
let filaLive = [];
let agendadoLive = null;

function enfileirar(tipo, dados, ctx) {
  filaLive.push({ tipo, dados, ctx });
  if (filaLive.length >= MAXIMO_NA_FILA) {
    if (agendadoLive) clearTimeout(agendadoLive);
    return descarregar();
  }
  if (!agendadoLive) agendadoLive = setTimeout(descarregar, ESPERA_EMOCAO_MS);
}

function descarregar() {
  agendadoLive = null;
  const lote = filaLive;
  filaLive = [];
  if (!lote.length) return Promise.resolve();

  return emOrdem(async () => {
    const g = await ler(["lives", "perfis", "iconesEmocoes", "fotos"]);
    const lives = g.lives ?? {};
    const perfis = g.perfis ?? {};
    const icones = g.iconesEmocoes ?? {};
    const fotos = g.fotos ?? {};
    let perfisNovos = 0;
    let iconesNovos = 0;
    let fotosNovas = 0;
    const anotarFoto = (handle, url) => {
      const certa = urlDeImagem(url);
      const h = String(handle ?? "").replace(/^@/, "");
      if (!certa || !h || fotos[h] === certa) return;
      delete fotos[h]; // vai para o fim: a mais recente fica
      fotos[h] = certa;
      fotosNovas++;
    };
    const tocadas = new Set();

    for (const { tipo, dados, ctx } of lote) {
      if (tipo === "perfis") {
        for (const [id, handle] of Object.entries(dados ?? {})) {
          if (typeof handle !== "string" || !handle || perfis[id] === handle) continue;
          perfis[id] = handle;
          perfisNovos++;
        }
        continue;
      }
      const live = liveDe(lives, ctx);
      tocadas.add(live.id);
      if (tipo === "emocao") {
        juntarEmocao(live, dados);
        anotarFoto(dados?.handle, dados?.foto);
        // A figurinha do ícone vem junto em cada envio: vale para o painel
        // mostrar mesmo antes de a tabela de preços passar por aqui.
        const url = urlDeImagem(dados?.iconeUrl);
        const icone = String(dados?.icone ?? "");
        if (url && icone && icones[icone] !== url) {
          icones[icone] = url;
          iconesNovos++;
        }
      } else if (tipo === "quadro") {
        juntarQuadro(live, dados);
        for (const m of dados?.data?.messages ?? []) anotarFoto(m?.sender_profile?.username, m?.sender_profile?.foto);
      }
    }

    if (iconesNovos) await chrome.storage.local.set({ iconesEmocoes: icones });
    if (fotosNovas) {
      const nomes = Object.keys(fotos);
      for (const h of nomes.slice(0, Math.max(0, nomes.length - FOTOS_MAX))) delete fotos[h];
      await chrome.storage.local.set({ fotos });
    }
    if (perfisNovos) {
      const ids = Object.keys(perfis);
      const sobra = ids.length - PERFIS_MAX;
      if (sobra > 0) for (const id of ids.slice(0, sobra)) delete perfis[id];
      await chrome.storage.local.set({ perfis });
    }
    if (tocadas.size) await gravarLives(lives, [...tocadas]);
  });
}

// Quem mandou qual icone, ao vivo. Diferente da participacao (que e a foto do
// total e chega de tempos em tempos), isto e evento: vem na hora, um por envio.
// So cobre o tempo em que a aba da live ficou aberta -- por isso os totais
// grandes continuam saindo da participacao, que e a Jamble quem calcula.
function juntarEmocao(live, evento) {
  if (!evento?.id) return;
  const emocoes = (live.emocoes = live.emocoes ?? []);
  // O mesmo evento chega repetido no WebSocket; o id da Jamble resolve.
  if (emocoes.some((e) => e.id === String(evento.id))) return;
  emocoes.push({
    id: String(evento.id),
    handle: String(evento.handle ?? "").replace(/^@/, ""),
    nome: evento.nome || evento.handle || "",
    icone: String(evento.icone ?? ""),
    gemas: Number(evento.gemas) || 0,
    ts: Number(evento.ts) || Date.now(),
    // Em batalha, para qual time foi o envio.
    ...(evento.time === "red" || evento.time === "blue" ? { time: evento.time } : {}),
  });
  if (emocoes.length > 5000) live.emocoes = emocoes.slice(-5000);
}

const semVazios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));

// Quantas mensagens do chat (com o texto) cada live guarda para o painel.
const CHAT_GUARDADAS = 300;
// Fotos de perfil (@ -> endereço), para a lista ao vivo. Acima disso, saem as
// mais antigas.
const FOTOS_MAX = 8000;

// Um pedaço do WebSocket da live (já enxugado pelo inject.js): pode trazer o
// leilão, a batalha, mensagens do chat, uma oferta ou um sorteio da Jamble.
function juntarQuadro(live, q) {
  if (typeof q?.data?.seller?.username === "string") live.vendedor = q.data.seller.username;

  const leilao = leilaoDoFrame(q, q?.leilaoAtual);
  if (leilao) {
    const leiloes = (live.leiloes = live.leiloes ?? {});
    leiloes[leilao.id] = mesclarLeilao(leiloes[leilao.id], leilao);
    const ids = Object.keys(leiloes);
    if (ids.length > 400) {
      ids.sort((a, b) => (leiloes[a].inicio || 0) - (leiloes[b].inicio || 0));
      for (const id of ids.slice(0, ids.length - 400)) delete leiloes[id];
    }
  }

  const batalha = batalhaDoFrame(q);
  if (batalha) {
    const batalhas = (live.batalhas = live.batalhas ?? {});
    batalhas[batalha.id] = { ...batalha, visto: Date.now() };
    const ids = Object.keys(batalhas);
    if (ids.length > 10) {
      ids.sort((a, b) => batalhas[a].visto - batalhas[b].visto);
      for (const id of ids.slice(0, ids.length - 10)) delete batalhas[id];
    }
  }

  const mensagens = mensagensDoFrame(q);
  if (mensagens.length) {
    const chat = (live.chat = live.chat ?? { total: 0, porPessoa: {}, porTipo: {}, ts: [], ids: [] });
    chat.msgs = chat.msgs ?? [];
    const vistas = new Set(chat.ids);
    for (const m of mensagens) {
      // Duas abas da mesma live (a página e o painel do vendedor) recebem a
      // mesma mensagem: o id evita contar duas vezes.
      if (vistas.has(m.id)) continue;
      vistas.add(m.id);
      chat.ids.push(m.id);
      chat.total++;
      const p = (chat.porPessoa[m.handle] = chat.porPessoa[m.handle] ?? { nome: m.nome, n: 0 });
      p.n++;
      if (m.nome) p.nome = m.nome;
      chat.porTipo[m.tipo] = (chat.porTipo[m.tipo] || 0) + 1;
      chat.ts.push(m.ts);
      // As últimas mensagens, com o texto, para o painel mostrar o chat.
      if (m.visivel) chat.msgs.push({ id: m.id, handle: m.handle, nome: m.nome, texto: m.texto, ts: m.ts });
    }
    chat.ids = chat.ids.slice(-4000);
    chat.ts = chat.ts.slice(-2000);
    chat.msgs = chat.msgs.sort((a, b) => a.ts - b.ts).slice(-CHAT_GUARDADAS);
  }

  // Editada: troca o texto. Apagada: sai da lista (a contagem fica).
  for (const e of edicoesDoFrame(q)) {
    const msgs = live.chat?.msgs;
    if (!msgs) break;
    const i = msgs.findIndex((m) => m.id === e.id);
    if (i < 0) continue;
    if (!e.visivel) msgs.splice(i, 1);
    else if (e.texto) msgs[i].texto = e.texto;
  }

  const sorteio = sorteioJambleDoFrame(q);
  if (sorteio) {
    const sorteios = (live.sorteiosJamble = live.sorteiosJamble ?? {});
    sorteios[sorteio.id] = { ...(sorteios[sorteio.id] ?? {}), ...semVazios(sorteio) };
  }

  const oferta = ofertaDoFrame(q);
  if (oferta) {
    const ofertas = (live.ofertas = live.ofertas ?? {});
    ofertas[oferta.id] = { ...(ofertas[oferta.id] ?? {}), ...semVazios(oferta) };
  }
}

// As metricas da live como a Jamble calcula. Vem de duas respostas que se
// completam (summary e dashboard), entao juntamos em cima do que ja tinha em
// vez de substituir -- senao uma apagaria os campos da outra.
function guardarMetricas(dados, ctx) {
  const valores = dados?.valores;
  if (!valores || typeof valores !== "object") return Promise.resolve();
  return mexerNasLives((lives) => {
    const live = liveDe(lives, ctx);
    live.metricas = { ...(live.metricas ?? {}), ...valores, quando: dados.quando ?? Date.now() };
    // Numa live de outro vendedor nao existe participacao, entao e daqui que
    // sai o "esta no ar" e a hora da ultima leitura. Sem isso o painel dizia
    // "encerrada" com a live rodando, e disparava o aviso de numero velho.
    if (typeof valores.acabou === "boolean") live.aoVivo = !valores.acabou;
    live.quando = dados.quando ?? Date.now();
    return live.id;
  });
}

// O ranking por pessoa vem pronto da Jamble (aba "Participacao"). A resposta e
// a foto completa da live, entao substitui a anterior em vez de somar -- mas
// antes comparamos com a foto de antes para saber quem enviou gemas agora.
function guardarParticipacao(dados, ctx) {
  return mexerNasLives((lives) => {
    const live = liveDe(lives, ctx);
    const quando = dados.quando ?? Date.now();
    const linhas = Array.isArray(dados.linhas) ? dados.linhas : [];
    const { eventos, agora } = diffGemas(live.anterior, linhas, quando);

    if (ctx?.titulo) live.titulo = ctx.titulo;
    if (typeof ctx?.doPainel === "boolean") live.doPainel = ctx.doPainel;
    live.quando = quando;
    live.aoVivo = !!dados.aoVivo;
    live.pesos = dados.pesos ?? null;
    live.linhas = linhas;
    live.anterior = agora;
    live.eventos = (live.eventos ?? []).concat(eventos).slice(-3000);
    return live.id;
  });
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
    if (msg?.tipo === "emocao" || msg?.tipo === "quadro" || msg?.tipo === "perfis") {
      enfileirar(msg.tipo, msg.dados, msg.contexto);
      responder({ ok: true });
      return;
    }
    // O ranking mensal de vendedores não é de uma live: é do mês.
    if (msg?.tipo === "ranking-mensal") {
      const lista = rankingDaResposta(msg.dados);
      if (lista?.length) {
        await emOrdem(() =>
          chrome.storage.local.set({
            rankingMensal: {
              quando: msg.dados.quando ?? Date.now(),
              titulo: msg.dados.titulo ?? "",
              lista,
              regras: regrasDoRanking(msg.dados),
            },
          }),
        );
      }
      responder({ ok: !!lista?.length });
      return;
    }
    // Primeira vez que aparece um campo que eu nunca tinha visto com dado (uma
    // oferta, um sorteio da Jamble). Fica guardado para conferir a leitura.
    if (msg?.tipo === "amostra") {
      await emOrdem(async () => {
        const { amostrasNovas } = await ler(["amostrasNovas"]);
        const todas = amostrasNovas ?? {};
        const chave = String(msg.dados?.chave ?? "");
        if (chave && !todas[chave] && Object.keys(todas).length < 30) {
          todas[chave] = {
            quando: Date.now(),
            origem: String(msg.dados?.origem ?? ""),
            texto: String(msg.dados?.texto ?? "").slice(0, 1500),
          };
          await chrome.storage.local.set({ amostrasNovas: todas });
        }
      });
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
      await emOrdem(async () => {
        // As figurinhas: só endereço válido, por cima das que já tinha (uma
        // tabela sem iconUrl não apaga as que vieram nos envios).
        const { iconesEmocoes } = await ler(["iconesEmocoes"]);
        const icones = { ...(iconesEmocoes ?? {}) };
        for (const [id, url] of Object.entries(msg.dados?.icones ?? {})) {
          if (urlDeImagem(url)) icones[id] = url;
        }
        await chrome.storage.local.set({
          tabelaEmocoes: msg.dados?.tabela ?? {},
          nomesEmocoes: msg.dados?.nomes ?? {},
          iconesEmocoes: icones,
        });
      });
      responder({ ok: true });
      return;
    }
    // Sorteio e contagem "ao vivo" pertencem a UMA live. Passam por aqui em vez
    // de o painel escrever direto, para duas gravacoes nao se atropelarem.
    if (msg?.tipo === "mexer-na-live") {
      const ok = await mexerNasLives((todas) => {
        const live = todas[msg.id];
        if (!live) return false;
        if (msg.acao === "zerar-ao-vivo") live.eventos = [];
        else if (msg.acao === "sortear") live.sorteios = (live.sorteios ?? []).concat(msg.sorteio);
        else if (msg.acao === "limpar-sorteios") live.sorteios = [];
        return true;
      });
      responder({ ok: ok !== false });
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
    // Pedido do painel: o ranking mensal. Basta uma aba de live apertar o
    // botão -- a lista é a mesma em todas.
    if (msg?.tipo === "atualizar-ranking-mensal") {
      let ok = false;
      try {
        const abas = await chrome.tabs.query({ url: "https://*.jamble.com/*" });
        for (const aba of abas) {
          try {
            const r = await chrome.tabs.sendMessage(aba.id, { tipo: "atualizar-ranking-mensal" });
            if (r?.ok) {
              ok = true;
              break;
            }
          } catch {
            // Aba sem o content script ainda: recarregar a pagina resolve.
          }
        }
      } catch {}
      responder({ ok });
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
