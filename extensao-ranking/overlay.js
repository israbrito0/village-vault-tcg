// Painel encostado na live, dentro da própria página da Jamble: não precisa
// trocar de aba para ver as métricas enquanto a live roda.
//
// O painel em si é o mesmo painel.html de sempre, carregado aqui dentro num
// iframe. Assim existe um código só: o que arrumar lá, arruma nos dois.
(() => {
  const ID = "vv-painel-ao-lado";
  const BOTAO = "vv-painel-botao";
  const CAPA = "vv-painel-capa";
  const ATUALIZAR = "vv-painel-atualizar";
  const PADRAO = 400;
  const MIN = 300;
  // Nunca mais do que metade da janela: a página da live encolhe para dar
  // lugar ao painel, e abaixo disso as três colunas dela ficam apertadas demais.
  const maximo = () => Math.max(MIN, Math.min(900, Math.round(window.innerWidth * 0.5)));

  const ehLive = () => /^\/(live|seller\/dashboard\/lives)\//.test(location.pathname);

  let largura = PADRAO;
  let aberto = false;

  // garantir() roda a cada 2s e chama mostrar(), que chamaria guardar(): sem
  // esta trava seria uma gravacao a cada 2 segundos, para sempre, sem motivo.
  let guardadoComo = "";
  function guardar() {
    const agora = aberto + ":" + largura;
    if (agora === guardadoComo) return;
    guardadoComo = agora;
    try {
      chrome.storage.local.set({ overlay: { aberto, largura } });
    } catch {
      // A extensão foi recarregada: a página precisa ser recarregada também.
    }
  }

  // ---------- abrir espaço na página ----------
  // A página da live é um bloco preso nas duas bordas da janela (position
  // fixed, inset-x-0), com três colunas: produtos, vídeo e CHAT. Se o painel
  // só encostasse por cima, cobriria o chat inteiro -- medido em 1280px, o
  // chat vai de 913 a 1256. Então, com o painel aberto, a borda direita desse
  // bloco recua a largura do painel e a própria Jamble reacomoda as três
  // colunas no espaço que sobrou. Nada fica escondido.
  const MARCA = "data-vv-recuado"; // guarda o "right" original para devolver
  let ultimaVarredura = 0;

  function ehDaPagina(el) {
    if (el.id === ID || el.id === BOTAO || el.id === CAPA) return false;
    if (getComputedStyle(el).position !== "fixed") return false;
    const r = el.getBoundingClientRect();
    // De ponta a ponta na largura (ou já recuado por nós).
    return r.left <= 1 && r.width >= window.innerWidth - largura - 2;
  }

  function recuarPagina(px) {
    const marcados = [...document.querySelectorAll(`[${MARCA}]`)];

    if (!px) {
      // Fechou: devolve tudo como era.
      for (const el of marcados) {
        el.style.right = el.getAttribute(MARCA);
        el.removeAttribute(MARCA);
      }
      // E libera a próxima busca: o freio de 5s existe para a conferência de
      // fundo, não para quando você reabre o painel. Sem isso, fechar e abrir
      // em seguida deixava o painel em cima do chat por alguns segundos.
      ultimaVarredura = 0;
      return;
    }

    // Os que já recuamos: só acerta a medida (a largura pode ter mudado).
    for (const el of marcados) el.style.right = px + "px";

    // Procurar de novo custa caro (olha a página inteira), então só quando
    // não sobrou nenhum -- a Jamble remonta a página ao trocar de live -- e no
    // máximo a cada 5 segundos.
    if (marcados.some((el) => el.isConnected)) return;
    if (Date.now() - ultimaVarredura < 5000) return;
    ultimaVarredura = Date.now();
    for (const el of document.body.querySelectorAll("*")) {
      if (el.hasAttribute(MARCA) || !ehDaPagina(el)) continue;
      el.setAttribute(MARCA, el.style.right || "");
      el.style.right = px + "px";
    }
  }

  // ---------- as peças ----------

  function montarBotao() {
    const b = document.createElement("button");
    b.id = BOTAO;
    b.type = "button";
    b.textContent = "Painel";
    b.title = "Mostrar o painel da live ao lado (gemas, carpas e sorteio)";
    // Na borda direita, na altura do meio. O canto de cima e onde ficam os
    // icones da propria Jamble (mensagens, presentes, perfil) -- la o botao
    // cobriria algo do site.
    b.style.cssText = `
      position: fixed; top: 50%; right: 0; transform: translateY(-50%);
      z-index: 2147483000; padding: 10px 9px; border: 0;
      border-radius: 10px 0 0 10px; cursor: pointer;
      background: #ffc83d; color: #2a2000;
      font: 700 12px/1.15 system-ui, sans-serif; letter-spacing: .02em;
      writing-mode: vertical-rl; text-orientation: mixed;
      box-shadow: -2px 0 10px rgba(0,0,0,.35);
    `;
    b.addEventListener("click", () => mostrar(!aberto));
    return b;
  }

  function montarPainel() {
    const caixa = document.createElement("div");
    caixa.id = ID;
    caixa.style.cssText = `
      position: fixed; top: 0; right: 0; bottom: 0; width: ${largura}px;
      z-index: 2147482999; display: none; background: #16122b;
      box-shadow: -4px 0 24px rgba(0,0,0,.5);
    `;

    // Pega a borda e arrasta para a esquerda/direita para mudar a largura.
    const pegador = document.createElement("div");
    pegador.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0; width: 7px;
      cursor: ew-resize; background: #2f2760;
    `;
    pegador.title = "Arraste para mudar a largura";

    const fechar = document.createElement("button");
    fechar.type = "button";
    fechar.textContent = "✕";
    fechar.title = "Fechar o painel";
    fechar.style.cssText = `
      position: absolute; top: 8px; right: 10px; z-index: 2;
      width: 26px; height: 26px; padding: 0; border: 1px solid #2f2760;
      border-radius: 999px; background: #1e1940; color: #9a92c7;
      font: 13px/1 system-ui, sans-serif; cursor: pointer;
    `;
    fechar.addEventListener("click", () => mostrar(false));

    // ↻ Atualizar: recarrega o painel na live que está na tela agora e busca
    // de novo o histórico dela desde o começo (vendas e batalha).
    const atualizar = document.createElement("button");
    atualizar.type = "button";
    atualizar.id = ATUALIZAR;
    atualizar.textContent = "↻";
    atualizar.title = "Atualizar: mostra a live da tela e busca de novo tudo desde o começo dela";
    atualizar.style.cssText = `
      position: absolute; top: 8px; right: 42px; z-index: 2;
      height: 26px; padding: 0 10px; border: 1px solid #2f2760;
      border-radius: 999px; background: #1e1940; color: #ffc83d;
      font: 700 14px/1 system-ui, sans-serif; cursor: pointer;
    `;
    atualizar.addEventListener("click", () => atualizarTudo());

    // O painel em si só é carregado quando ela abre -- ver `mostrar`.
    caixa.append(pegador, fechar, atualizar);

    // Durante o arrasto, o iframe engole o mouse -- a capa resolve.
    let arrastando = false;
    const capa = document.createElement("div");
    capa.id = CAPA;
    capa.style.cssText = "position: fixed; inset: 0; z-index: 2147483001; display: none; cursor: ew-resize;";

    pegador.addEventListener("mousedown", (e) => {
      e.preventDefault();
      arrastando = true;
      capa.style.display = "block";
    });
    capa.addEventListener("mousemove", (e) => {
      if (!arrastando) return;
      largura = Math.min(maximo(), Math.max(MIN, window.innerWidth - e.clientX));
      caixa.style.width = largura + "px";
      recuarPagina(largura);
      const b = document.getElementById(BOTAO);
      if (b) b.style.right = largura + "px";
    });
    const soltar = () => {
      if (!arrastando) return;
      arrastando = false;
      capa.style.display = "none";
      guardar();
    };
    capa.addEventListener("mouseup", soltar);
    capa.addEventListener("mouseleave", soltar);

    document.getElementById(CAPA)?.remove();
    document.body.append(capa);
    return caixa;
  }

  // ---------- extensão atualizada com a página aberta ----------
  // Quando a extensão é atualizada (ou recarregada em chrome://extensions), o
  // que já estava rodando nesta página perde a ligação com ela -- o Chrome não
  // troca o script de uma página que já estava aberta. Daí não dá mais para
  // carregar o painel, e a faixa abria vazia, sem dizer nada. Agora ela diz o
  // que fazer.
  const AVISO = "vv-painel-aviso";

  function extensaoViva() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function montarAviso() {
    const a = document.createElement("div");
    a.id = AVISO;
    a.style.cssText = `
      position: absolute; inset: 0; padding: 48px 22px 0 26px;
      color: #ece9ff; font: 14px/1.5 system-ui, sans-serif;
    `;
    const titulo = document.createElement("div");
    titulo.textContent = "A extensão foi atualizada";
    titulo.style.cssText = "font-weight: 700; font-size: 16px; color: #ffc83d; margin-bottom: 8px;";
    const texto = document.createElement("div");
    texto.textContent =
      "Esta página ainda está com a versão de antes. Aperte F5 (recarregar) para o painel novo aparecer. " +
      "Se você está transmitindo por esta aba, recarregue só quando puder.";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Recarregar a página";
    botao.style.cssText = `
      margin-top: 14px; padding: 8px 14px; border: 0; border-radius: 8px;
      background: #ffc83d; color: #2a2000; font: 700 13px system-ui, sans-serif; cursor: pointer;
    `;
    botao.addEventListener("click", () => location.reload());
    a.append(titulo, texto, botao);
    return a;
  }

  // ---------- trocar de live e buscar o histórico ----------
  // A Jamble troca de live sem recarregar a página: o painel acompanha a live
  // da tela. E quem chega no meio da live não recebe o que já passou -- então,
  // na primeira vez que o painel abre em cada live, a extensão busca as vendas
  // e a batalha desde o começo (content.js, vvCarregarHistorico).
  let liveDoQuadro = null;
  const historicoFeito = new Set();
  let buscando = false;

  async function buscarHistorico(forcar) {
    const live = idDaLive(location.pathname);
    if (!live || buscando || (!forcar && historicoFeito.has(live))) return;
    if (typeof self.vvCarregarHistorico !== "function") return;
    historicoFeito.add(live);
    buscando = true;
    const b = document.getElementById(ATUALIZAR);
    if (b) b.textContent = "…";
    try {
      await self.vvCarregarHistorico();
    } catch {
      // Página mudou no meio: o próximo ↻ tenta de novo.
    } finally {
      buscando = false;
      if (b) b.textContent = "↻";
    }
  }

  function atualizarTudo() {
    const caixa = document.getElementById(ID);
    caixa?.querySelector("iframe")?.remove();
    liveDoQuadro = null;
    mostrar(true);
    buscarHistorico(true);
  }

  // ---------- liga e desliga ----------

  function mostrar(ligar) {
    aberto = !!ligar;
    const caixa = document.getElementById(ID);
    const b = document.getElementById(BOTAO);
    if (caixa) {
      caixa.style.display = aberto ? "block" : "none";
      // A janela pode ter mudado de tamanho desde a última vez.
      largura = Math.min(maximo(), Math.max(MIN, largura));
      caixa.style.width = largura + "px";

      // O painel só entra na página quando ela abre, e sai quando ela fecha.
      // Fechado, a página não carrega nada e volta a ser uma página comum --
      // o que também devolve ao Claude a capacidade de olhar a aba, que o
      // Chrome bloqueia enquanto existe o quadro de outra extensão aqui.
      let jaTem = caixa.querySelector("iframe");
      const aviso = document.getElementById(AVISO);
      // Trocou de live na mesma página: o painel passa para a live nova.
      const daTela = idDaLive(location.pathname);
      if (aberto && jaTem && daTela && liveDoQuadro && daTela !== liveDoQuadro) {
        jaTem.remove();
        jaTem = null;
      }
      if (aberto && !jaTem) {
        let endereco = null;
        try {
          if (extensaoViva()) endereco = chrome.runtime.getURL("painel.html");
        } catch {
          // Mesma coisa: a extensão foi trocada por baixo desta página.
        }
        if (!endereco) {
          if (!aviso) caixa.appendChild(montarAviso());
        } else {
          aviso?.remove();
          const quadro = document.createElement("iframe");
          // Diz ao painel qual live esta na tela, para ele mostrar essa e nao
          // a mais recente que estiver guardada.
          const daPagina = idDaLive(location.pathname);
          quadro.src = endereco + "?embutido=1" + (daPagina ? "&live=" + encodeURIComponent(daPagina) : "");
          quadro.style.cssText = "width: 100%; height: 100%; border: 0; display: block;";
          caixa.appendChild(quadro);
          liveDoQuadro = daPagina;
          // Primeira vez nesta live: busca o histórico, depois de a página
          // assentar (as abas da Jamble precisam existir).
          if (daPagina && !historicoFeito.has(daPagina)) setTimeout(() => buscarHistorico(false), 4000);
        }
      } else if (!aberto) {
        jaTem?.remove();
        aviso?.remove();
      }
    }
    recuarPagina(aberto ? largura : 0);
    if (b) {
      b.textContent = aberto ? "Fechar" : "Painel";
      // Com o painel aberto o botao encosta na borda dele.
      b.style.right = aberto ? largura + "px" : "0";
    }
    guardar();
  }

  function garantir() {
    if (!ehLive()) {
      // Saiu da live: tira tudo em vez de deixar sobrando por cima do site.
      document.getElementById(ID)?.remove();
      document.getElementById(BOTAO)?.remove();
      document.getElementById(CAPA)?.remove();
      recuarPagina(0);
      return;
    }
    if (!document.body) return;
    if (!document.getElementById(ID)) document.body.append(montarPainel());
    if (!document.getElementById(BOTAO)) document.body.append(montarBotao());
    mostrar(aberto);
  }

  // ---------- começa ----------

  (async () => {
    try {
      const g = await chrome.storage.local.get("overlay");
      aberto = !!g.overlay?.aberto;
      largura = Number(g.overlay?.largura) || PADRAO;
    } catch {}
    garantir();
    // A Jamble troca de página sem recarregar, e o React às vezes limpa o que
    // não é dele: conferir de vez em quando é mais barato do que adivinhar.
    setInterval(garantir, 2000);
  })();
})();
