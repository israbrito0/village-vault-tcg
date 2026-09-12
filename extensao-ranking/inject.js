// Roda dentro da página da Jamble (mesmo mundo do site) para enxergar o que
// chega pelo WebSocket e pelas chamadas de API. Não altera nada da página:
// só copia o que passa e manda para o content.js por postMessage.
(() => {
  const MARCA = "vv-ranking";
  const jaVistos = new Set();

  const avisar = (tipo, dados) => window.postMessage({ marca: MARCA, tipo, dados }, "*");

  // ---------- leitura dos valores ----------

  const CHAVES_CENTAVOS = /(cents|centavos|_in_cents|inCents)$/i;
  const CHAVES_VALOR = /^(price|amount|total|value|valor|preco|preço|totalPrice|grandTotal|subtotal|paid|paidAmount)$/i;
  const CHAVES_USUARIO = /^(username|handle|nickname|nick|slug|login|user_name|userName|displayName|name)$/i;
  const CHAVES_DONO = /^(user|buyer|customer|comprador|cliente|purchaser|winner|bidder|account|profile)$/i;
  const CHAVES_ID = /^(id|_id|uuid|orderId|order_id|orderNumber|purchaseId|saleId|transactionId)$/i;
  const PISTA_VENDA = /(order|purchase|sale|checkout|bought|buy|sold|compra|venda|pedido|arremat)/i;

  function dinheiroDeTexto(txt) {
    const m = String(txt).match(/R\$\s*([\d.]+,\d{2}|\d+)/i);
    if (!m) return null;
    const limpo = m[1].replace(/\./g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  // Devolve o valor em centavos e como ele foi descoberto, para dar para
  // conferir depois na depuração se a conta ficou certa.
  function acharValor(obj, modo) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && CHAVES_CENTAVOS.test(k)) return { centavos: Math.round(v), de: k, jaEmCentavos: true };
    }
    for (const [k, v] of Object.entries(obj)) {
      if (!CHAVES_VALOR.test(k)) continue;
      if (typeof v === "number") {
        if (modo === "centavos") return { centavos: Math.round(v), de: k, jaEmCentavos: true };
        if (modo === "reais") return { centavos: Math.round(v * 100), de: k, jaEmCentavos: false };
        // Automático: número quebrado é reais; inteiro costuma ser centavos.
        const emCentavos = Number.isInteger(v);
        return { centavos: emCentavos ? v : Math.round(v * 100), de: k, jaEmCentavos: emCentavos };
      }
      if (typeof v === "string") {
        const c = dinheiroDeTexto(v);
        if (c !== null) return { centavos: c, de: k, jaEmCentavos: false };
      }
    }
    return null;
  }

  function acharUsuario(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && CHAVES_USUARIO.test(k) && v.trim()) return v.trim();
    }
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && CHAVES_DONO.test(k)) {
        const achado = acharUsuario(v);
        if (achado) return achado;
      }
    }
    return null;
  }

  function acharId(obj, usuario, centavos) {
    for (const [k, v] of Object.entries(obj)) {
      if (CHAVES_ID.test(k) && (typeof v === "string" || typeof v === "number")) return String(v);
    }
    // Sem id no payload: monta um a partir do conteúdo, arredondado em blocos
    // de 5 segundos para o mesmo pedido não entrar duas vezes.
    return `sem-id:${usuario}:${centavos}:${Math.floor(Date.now() / 5000)}`;
  }

  function pareceVenda(obj, caminho) {
    if (PISTA_VENDA.test(caminho)) return true;
    const tipo = obj.type || obj.event || obj.kind || obj.action || obj.name || "";
    return PISTA_VENDA.test(String(tipo));
  }

  // Percorre o JSON inteiro procurando objetos que tenham comprador e valor.
  // "dica" diz que algum objeto acima já se apresentou como venda (por exemplo
  // { type: "order.created", payload: {...} }), e vale para os filhos.
  function varrer(valor, caminho, saida, candidatos, modo, profundidade = 0, dica = false) {
    if (!valor || typeof valor !== "object" || profundidade > 8) return;
    if (Array.isArray(valor)) {
      valor.forEach((v, i) => varrer(v, `${caminho}[${i}]`, saida, candidatos, modo, profundidade + 1, dica));
      return;
    }
    const ehVenda = dica || pareceVenda(valor, caminho);
    const usuario = acharUsuario(valor);
    const dinheiro = acharValor(valor, modo);
    if (usuario && dinheiro && dinheiro.centavos > 0) {
      const registro = {
        id: acharId(valor, usuario, dinheiro.centavos),
        handle: usuario,
        centavos: dinheiro.centavos,
        ts: Date.now(),
        _de: dinheiro.de,
        _caminho: caminho,
        _confiavel: ehVenda,
      };
      if (registro._confiavel) saida.push(registro);
      else candidatos.push({ ...registro, _amostra: JSON.stringify(valor).slice(0, 600) });
    }
    for (const [k, v] of Object.entries(valor)) {
      varrer(v, `${caminho}.${k}`, saida, candidatos, modo, profundidade + 1, ehVenda);
    }
  }

  let modoValor = "auto";
  window.addEventListener("message", (e) => {
    if (e.source === window && e.data?.marca === MARCA && e.data?.tipo === "modo") {
      modoValor = e.data.dados || "auto";
    }
  });

  function analisar(texto, origem) {
    if (!texto || texto.length > 400000) return;
    let dados;
    try {
      dados = JSON.parse(texto);
    } catch {
      return;
    }
    const vendas = [];
    const candidatos = [];
    varrer(dados, origem, vendas, candidatos, modoValor);
    for (const v of vendas) {
      if (jaVistos.has(v.id)) continue;
      jaVistos.add(v.id);
      avisar("venda", { ...v, origem });
    }
    if (candidatos.length) avisar("candidato", { origem, itens: candidatos.slice(0, 3) });
  }

  // ---------- ganchos ----------

  const WSOriginal = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new WSOriginal(...args);
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") analisar(ev.data, `ws:${String(args[0]).split("?")[0]}`);
    });
    return ws;
  };
  window.WebSocket.prototype = WSOriginal.prototype;
  Object.assign(window.WebSocket, WSOriginal);

  const fetchOriginal = window.fetch;
  window.fetch = async function (...args) {
    const resposta = await fetchOriginal.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
      const tipo = resposta.headers.get("content-type") ?? "";
      if (tipo.includes("json") || tipo.includes("text")) {
        resposta
          .clone()
          .text()
          .then((t) => analisar(t, `fetch:${url.split("?")[0]}`))
          .catch(() => {});
      }
    } catch {}
    return resposta;
  };

  const abrirOriginal = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (metodo, url, ...resto) {
    this.addEventListener("load", () => {
      try {
        if (typeof this.responseText === "string") analisar(this.responseText, `xhr:${String(url).split("?")[0]}`);
      } catch {}
    });
    return abrirOriginal.call(this, metodo, url, ...resto);
  };

  avisar("ligado", { url: location.href });
})();
