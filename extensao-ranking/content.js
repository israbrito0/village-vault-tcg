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
      // liveId é o que o ranking do site sempre usou para agrupar as vendas.
      // Mexer nele mudaria o agrupamento de dado que já está lá, então fica.
      liveId: m ? m[1] : location.pathname.replace(/\W+/g, "-").slice(0, 60) || "sem-live",
      // showId é o identificador de verdade da live (o liveId acima pega o
      // nome do vendedor quando a página é /live/<vendedor>/<id>). Só o painel
      // de gemas usa, para cada live ter a sua própria contagem.
      showId: idDaLive(location.pathname),
      doPainel: ehPainelDoVendedor(location.pathname),
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

  // Só passam adiante os tipos conhecidos: a página pode mandar qualquer
  // mensagem, e o background não é lugar de recebê-las às cegas.
  const TIPOS = new Set([
    "venda",
    "candidato",
    "ligado",
    "emocao",
    "participacao",
    "metricas",
    "eu",
    "tabela-emocoes",
    "quadro",
    "perfis",
    "ranking-mensal",
    "amostra",
    "vendidos",
    "batalha-participantes",
  ]);

  // ---------- histórico desde o começo da live ----------
  // Quem entra depois que a live começou não recebe o que já passou. Mas a
  // própria página da live guarda duas listas que cobrem a live inteira, e
  // busca cada uma quando a aba dela é aberta:
  //   "Vendidos" (coluna dos produtos)  -> tudo que saiu, com quem comprou
  //   "Batalha"  (coluna do chat)       -> os pontos de cada pessoa
  // Aqui a extensão abre essas abas como ela faria, aperta "Carregar Mais" até
  // acabar, e volta para a aba onde ela estava. O inject.js lê as respostas no
  // caminho, como sempre -- nenhuma chamada por fora.
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const textoDe = (el) => (el.textContent || "").trim();
  const porTexto = (re) => [...document.querySelectorAll("button,[role=tab]")].find((b) => re.test(textoDe(b)));
  const ABA_PRODUTOS = /^(Disponíveis|Vendidos|Não vendido|Available|Sold|Unsold)\b/i;
  const ATIVA_PRODUTOS = /bg-\[var\(--bg-inverse\)\]/;

  async function carregarMais() {
    for (let i = 0; i < 30; i++) {
      const mais = porTexto(/^(Carregar Mais|Load More)$/i);
      if (!mais || mais.disabled) return;
      mais.click();
      await espera(1500);
    }
  }

  let carregando = false;
  async function carregarHistorico() {
    if (carregando || !/^\/live\//.test(location.pathname)) return { ok: false, feito: [] };
    carregando = true;
    const feito = [];
    try {
      // Vendidos: abre, carrega tudo, volta para a aba que estava.
      const vendidos = porTexto(/^(Vendidos|Sold)\b/i);
      if (vendidos) {
        const grupo = [...document.querySelectorAll("button")].filter((b) => ABA_PRODUTOS.test(textoDe(b)));
        const estava = grupo.find((b) => ATIVA_PRODUTOS.test(String(b.className)));
        vendidos.click();
        await espera(1500);
        await carregarMais();
        // Volta para a aba onde ela estava. Se já estava nos Vendidos, fica;
        // se não deu para saber, vai para Disponíveis (a que a página abre).
        if (estava !== vendidos) (estava ?? porTexto(/^(Disponíveis|Available)\b/i))?.click();
        feito.push("vendidos");
      }
      // Batalha: abre a aba (se já estiver nela, passa por outra para buscar
      // de novo), carrega tudo e volta.
      const abas = [...document.querySelectorAll('[role="tab"]')];
      const batalha = abas.find((b) => /^(Batalha|Battle)$/i.test(textoDe(b)));
      if (batalha) {
        const estava = abas.find((b) => b.getAttribute("aria-selected") === "true");
        if (estava === batalha) {
          abas.find((b) => b !== batalha)?.click();
          await espera(600);
        }
        batalha.click();
        await espera(1800);
        await carregarMais();
        // Se ela já estava na Batalha, fica nela; senão volta (ou vai para o Chat).
        if (estava !== batalha) (estava ?? abas.find((b) => /^Chat$/i.test(textoDe(b))))?.click();
        feito.push("batalha");
      }
    } finally {
      carregando = false;
    }
    return { ok: feito.length > 0, feito };
  }
  // O overlay.js (mesmo mundo isolado) chama ao abrir o painel e no ↻.
  self.vvCarregarHistorico = carregarHistorico;

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.marca !== MARCA) return;
    if (TIPOS.has(e.data.tipo)) mandar(e.data.tipo, e.data.dados);
  });

  chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
    if (msg?.tipo === "modo") {
      window.postMessage({ marca: MARCA, tipo: "modo", dados: msg.dados }, "*");
    }
    if (msg?.tipo === "contexto") responder(contexto());

    // O painel pede o ranking mensal: aperta o botão "Ranking do vendedor: #N"
    // da própria live, que busca a lista na Jamble -- o inject.js lê a resposta
    // no caminho, como sempre. Se abrir uma janelinha por cima da live, fecha.
    if (msg?.tipo === "atualizar-ranking-mensal") {
      const botao = ehPaginaDeLive(location.pathname)
        ? [...document.querySelectorAll("button")].find((b) =>
            /^(ranking do vendedor|seller ranking)/i.test((b.getAttribute("aria-label") || "").trim()),
          )
        : null;
      if (!botao) {
        responder({ ok: false });
        return true;
      }
      // O botão troca a coluna do chat para a aba Ranking: depois de ler,
      // volta para a aba onde ela estava.
      const estava = [...document.querySelectorAll('[role="tab"]')].find((b) => b.getAttribute("aria-selected") === "true");
      botao.click();
      setTimeout(() => {
        if (document.querySelector('[role="dialog"]')) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }
        const agora = [...document.querySelectorAll('[role="tab"]')].find((b) => b.getAttribute("aria-selected") === "true");
        if (estava && agora && agora !== estava) estava.click();
        responder({ ok: true });
      }, 1500);
      return true;
    }

    // O painel pede o histórico desde o começo da live (botão ↻).
    if (msg?.tipo === "carregar-historico") {
      carregarHistorico().then((r) => responder(r));
      return true;
    }

    // O painel pede para atualizar os numeros: aperta o proprio botao
    // "Atualizar" da pagina da Jamble, que refaz a chamada e o inject.js le a
    // resposta nova. Nao inventa requisicao nenhuma por fora.
    //
    // So em pagina de live. Em outra tela da Jamble pode existir um botao
    // "Atualizar" que faz outra coisa, e nao e para sair clicando sozinho.
    if (msg?.tipo === "atualizar-participacao") {
      const ehLive = ehPaginaDeLive(location.pathname);
      if (!ehLive) {
        responder({ ok: false });
        return true;
      }
      // Passa pelas duas abas: Desempenho traz as metricas da live inteira e
      // Participacao traz as gemas pessoa a pessoa. O inject.js le as duas
      // respostas no caminho. No fim volta para Participacao, que e onde o
      // "Atualizar" existe e onde ela costuma deixar a tela.
      (async () => {
        const espera = (ms) => new Promise((r) => setTimeout(r, ms));
        // Os nomes vão em português e em inglês: se a conta estiver no outro
        // idioma, o automático pararia de funcionar sem dizer nada.
        const aba = (...nomes) => {
          const alvo = nomes.map((n) => n.toLowerCase());
          return [...document.querySelectorAll("button,[role=tab]")].find((b) =>
            alvo.includes((b.textContent || "").trim().toLowerCase()),
          );
        };
        let achou = false;
        const desempenho = aba("Desempenho", "Performance");
        if (desempenho) {
          desempenho.click();
          achou = true;
          await espera(1500);
        }
        const participacao = aba("Participação", "Participation");
        if (participacao) {
          participacao.click();
          achou = true;
          await espera(1200);
        }
        const atualizar = [...document.querySelectorAll("button")].find((b) =>
          ["atualizar", "refresh", "update"].includes((b.textContent || "").trim().toLowerCase()),
        );
        if (atualizar) {
          atualizar.click();
          achou = true;
        }
        responder({ ok: achou });
      })();
      return true;
    }
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
