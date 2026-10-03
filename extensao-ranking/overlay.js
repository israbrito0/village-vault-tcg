// Painel encostado na live, dentro da própria página da Jamble: não precisa
// trocar de aba para ver as métricas enquanto a live roda.
//
// O painel em si é o mesmo painel.html de sempre, carregado aqui dentro num
// iframe. Assim existe um código só: o que arrumar lá, arruma nos dois.
(() => {
  const ID = "vv-painel-ao-lado";
  const BOTAO = "vv-painel-botao";
  const PADRAO = 400;
  const MIN = 300;
  // Nunca mais do que metade da janela: numa tela menor, um painel largo
  // demais passaria a cobrir o vídeo da live. Medido na página da Jamble com
  // 1400px: o vídeo vai até 903 e um painel de 400 começa em 1000.
  const maximo = () => Math.max(MIN, Math.min(900, Math.round(window.innerWidth * 0.5)));

  const ehLive = () => /^\/(live|seller\/dashboard\/lives)\//.test(location.pathname);

  let largura = PADRAO;
  let aberto = false;

  function guardar() {
    try {
      chrome.storage.local.set({ overlay: { aberto, largura } });
    } catch {
      // A extensão foi recarregada: a página precisa ser recarregada também.
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

    // O painel em si só é carregado quando ela abre -- ver `mostrar`.
    caixa.append(pegador, fechar);

    // Durante o arrasto, o iframe engole o mouse -- a capa resolve.
    let arrastando = false;
    const capa = document.createElement("div");
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
    });
    const soltar = () => {
      if (!arrastando) return;
      arrastando = false;
      capa.style.display = "none";
      guardar();
    };
    capa.addEventListener("mouseup", soltar);
    capa.addEventListener("mouseleave", soltar);

    document.body.append(capa);
    return caixa;
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
      const jaTem = caixa.querySelector("iframe");
      if (aberto && !jaTem) {
        const quadro = document.createElement("iframe");
        // Diz ao painel qual live esta na tela, para ele mostrar essa e nao
        // a mais recente que estiver guardada.
        const daPagina = idDaLive(location.pathname);
        quadro.src =
          chrome.runtime.getURL("painel.html") +
          "?embutido=1" +
          (daPagina ? "&live=" + encodeURIComponent(daPagina) : "");
        quadro.style.cssText = "width: 100%; height: 100%; border: 0; display: block;";
        caixa.appendChild(quadro);
      } else if (!aberto && jaTem) {
        jaTem.remove();
      }
    }
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
