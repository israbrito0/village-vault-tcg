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

  // A amostra crua serve para depurar, mas o canal show_user da Jamble carrega
  // CPF, telefone e e-mail do dono da conta. Isso some antes de sair daqui: o
  // arquivo de depuracao nao pode virar um vazamento de dado pessoal.
  const SEGREDOS =
    /"(cpf|cnpj|phone_number|phoneNumber|telefone|email|birth_?date|document|rg|pix_key|bank_account|postal_code|zip_?code|street|address_line\w*|full_name|first_name|last_name|recipient_name)"\s*:\s*("[^"]*"|-?\d+(\.\d+)?|null)/gi;

  function semSegredo(texto) {
    return texto.replace(SEGREDOS, (_, campo) => '"' + campo + '":"(escondido)"');
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
      else candidatos.push({ ...registro, _amostra: semSegredo(JSON.stringify(valor)).slice(0, 600) });
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

  // ---------- emotions e participação ----------

  // A própria Jamble publica a tabela de preços em /api/live/emojis. Em vez de
  // chutar quanto vale cada ícone, a extensão lê essa resposta quando a página
  // pede e guarda os valores. São 36 ícones hoje, e a lista muda sozinha
  // quando eles criam um novo -- por isso nada fica escrito na unha aqui.

  function guardarTabela(dados) {
    if (!Array.isArray(dados?.emojis)) return;
    const tabela = {};
    const nomes = {};
    const icones = {}; // a figurinha de cada um, para o painel mostrar
    for (const e of dados.emojis) {
      if (typeof e?.id !== "string" || typeof e?.gemPrice !== "number") continue;
      tabela[e.id] = e.gemPrice;
      if (typeof e.name === "string") nomes[e.id] = e.name;
      if (typeof e.iconUrl === "string") icones[e.id] = e.iconUrl;
    }
    if (!Object.keys(tabela).length) return;
    avisar("tabela-emocoes", { tabela, nomes, icones });
  }

  // O ranking por pessoa vem pronto em /api/seller/show-participation: cada
  // linha diz quanto a pessoa comprou, quantas gemas mandou e quantos pontos
  // fez. É exatamente o que a aba "Participação" mostra no painel do vendedor,
  // calculado pela Jamble -- não é conta nossa.
  function guardarParticipacao(dados, origem) {
    const p = dados?.participation;
    if (!Array.isArray(p?.rows)) return;
    avisar("participacao", {
      origem,
      quando: Date.now(),
      aoVivo: p.isLive === true,
      pesos: p.weights ?? null,
      linhas: p.rows.map((r) => ({
        handle: String(r.username ?? "").replace(/^@/, ""),
        nome: r.displayName || r.username || "",
        pontos: Number(r.score) || 0,
        gastou: Number(r.spent) || 0,
        gemas: Number(r.gems) || 0,
        mensagens: Number(r.messages) || 0,
        foto: typeof r.avatarUrl === "string" ? r.avatarUrl : null,
      })),
    });
  }

  // Quem mandou qual ícone, ao vivo. Chega no canal "show" do WebSocket, em
  // data.events[], com event_type "LIKE". Confirmado numa live de verdade em
  // 03/10/2026: 10 envios, 10 eventos, cada um com o ícone, o valor em gemas e
  // o perfil de quem mandou.
  //
  // Antes eu tinha concluído que isso não existia -- estava errado: na live em
  // que testei ninguém mandou emotion nenhuma, então nunca passou um LIKE.
  // A foto pequena do perfil: profile_image.low (ou a original, se não houver).
  const fotoDe = (perfil) => {
    const img = perfil?.profile_image;
    const url = typeof img === "string" ? img : img?.low || img?.medium || img?.original_url;
    return typeof url === "string" ? url : null;
  };

  function guardarEventos(dados, origem) {
    const lista = dados?.data?.events;
    if (!Array.isArray(lista)) return;
    for (const e of lista) {
      if (!e || e.event_type !== "LIKE" || !e.id) continue;
      const id = `like:${e.id}`;
      if (jaVistos.has(id)) continue; // o mesmo evento chega repetido
      jaVistos.add(id);
      const p = e.liker_profile ?? {};
      avisar("emocao", {
        id: String(e.id),
        handle: String(p.username ?? "").replace(/^@/, ""),
        nome: p.display_name || p.username || "",
        icone: String(e.like_icon_id ?? ""),
        // A Jamble chama de "battle_entry_count", mas é o preço em gemas:
        // bateu com a tabela de /api/live/emojis nos ícones testados.
        gemas: Number(e.like_icon_battle_entry_count) || 0,
        // A figurinha, caso a tabela de preços ainda não tenha passado.
        iconeUrl: typeof e.like_icon_url === "string" ? e.like_icon_url : null,
        // A foto de quem mandou, para a lista ao vivo do painel.
        foto: fotoDe(p) || (typeof e.user_profile_picture === "string" ? e.user_profile_picture : null),
        // Em batalha, para qual time foi ("red" / "blue").
        time: typeof e.battle_team === "string" ? e.battle_team : null,
        ts: e.created_at ? Math.round(Number(e.created_at) * 1000) : Date.now(),
        origem,
      });
    }
  }

  // As métricas da live, como a Jamble calcula: faturamento, vendas, ticket,
  // espectadores, funil, chat. Vêm de dois lugares que se completam --
  //   /api/seller/show-summary    a aba Desempenho (quase tudo)
  //   /api/seller/show-dashboard  o cabeçalho (traz o "pós taxas", que o
  //                               summary não tem)
  function guardarMetricas(dados, origem) {
    const m = dados?.performance?.metrics;
    if (m && typeof m === "object") {
      avisar("metricas", {
        quando: Date.now(),
        de: "summary",
        valores: {
          faturamento: Number(m.revenue) || 0,
          vendas: Number(m.orders) || 0,
          ticketMedio: Number(m.avgOrderValue) || 0,
          gastoPorComprador: Number(m.avgBuyerSpend) || 0,
          compradores: Number(m.buyers) || 0,
          ofertaram: Number(m.bidders) || 0,
          porMinuto: Number(m.revenuePerMinute) || 0,
          segundosEntreVendas: Number(m.secondsBetweenSales) || 0,
          frete: Number(m.shippingRevenue) || 0,
          espectadores: Number(m.uniqueViewers) || 0,
          pico: Number(m.maxConcurrent) || 0,
          mediaSimultanea: Number(m.avgConcurrent) || 0,
          segundosAssistidos: Number(m.avgWatchSeconds) || 0,
          ficaramUmMinuto: Number(m.watchedOneMinute) || 0,
          voltaram: Number(m.returningViewers) || 0,
          sessoesPorPessoa: Number(m.avgSessionsPerViewer) || 0,
          produtosMostrados: Number(m.productsPresented) || 0,
          produtosVendidos: Number(m.productsSold) || 0,
          escoamento: Number(m.sellThrough) || 0,
          mensagens: Number(m.messages) || 0,
          pessoasNoChat: Number(m.chatParticipants) || 0,
          seguidoresNovos: Number(m.newFollowers) || 0,
          minutos: Number(m.durationMinutes) || 0,
          compradoresNovos: Number(dados?.performance?.newBuyerCount) || 0,
        },
      });
      return;
    }
    // O show-dashboard: dali só interessa o líquido e os totais do cabeçalho.
    const s = dados?.dashboard?.show ?? dados?.show ?? dados?.dashboard;
    if (s && (s.totalProductPrice != null || s.totalSaleProductPrice != null)) {
      avisar("metricas", {
        quando: Date.now(),
        de: "dashboard",
        valores: {
          faturamento: Number(s.totalProductPrice ?? s.totalSaleProductPrice) || 0,
          liquido: Number(s.totalProductPriceWithFees) || 0,
          vendas: Number(s.soldCount ?? s.soldSaleCount) || 0,
          compradores: Number(s.buyerCount) || 0,
        },
      });
    }
  }

  // O objeto "show" do WebSocket vem de QUALQUER live, inclusive a de outro
  // vendedor, e já traz faturamento, vendas e audiência. Não precisa ser dona
  // da live para ter isso -- serve para acompanhar amigos também.
  let ultimaFoto = "";
  function guardarAoVivo(dados) {
    const s = dados?.data?.show;
    if (!s || typeof s !== "object" || !s.id) return;
    const v = {
      faturamento: Number(s.total_sale_product_price) || 0,
      vendas: Number(s.sold_sale_count) || 0,
      audienciaAgora: Number(s.audience_count) || 0,
      likes: Number(s.like_count) || 0,
      produtosVendidos: Number(s.sold_product_count) || 0,
      produtosDisponiveis: Number(s.available_product_count) || 0,
      produtosTotal: Number(s.total_product_count) || 0,
      compartilhamentos: Number(s.share_count) || 0,
      salvos: Number(s.bookmark_count) || 0,
      comecouEm: s.started_at ? Math.round(Number(s.started_at) * 1000) : null,
      acabou: s.is_over === true,
      titulo: typeof s.title === "string" ? s.title : "",
    };
    // Esses frames chegam a cada poucos segundos: só avisa quando muda algo,
    // para não ficar gravando a mesma coisa sem parar.
    const foto = JSON.stringify(v);
    if (foto === ultimaFoto) return;
    ultimaFoto = foto;
    avisar("metricas", { quando: Date.now(), de: "ao-vivo", valores: v });
  }

  // Quem está logado. O canal show_user manda o perfil inteiro, com CPF,
  // telefone e e-mail -- daqui sai SÓ o @ e o nome, que é o que o painel
  // precisa para poder tirar você do próprio sorteio. O resto nem é lido.
  let euJaMandei = false;
  function guardarEu(dados) {
    const p = dados?.data?.my_profile;
    if (!p || typeof p.username !== "string" || euJaMandei) return;
    euJaMandei = true;
    avisar("eu", { handle: p.username.replace(/^@/, ""), nome: p.display_name || p.username });
  }

  // ---------- o resto da live: leilão, batalha, chat, oferta, sorteio ----------
  //
  // Tudo isso chega pelo WebSocket. Daqui sai só o pedaço que interessa, já
  // enxugado (nada de foto, descrição ou texto de mensagem); quem faz as contas
  // é o analises.js, no background.

  // A mesma lista de campos do semSegredo, para conferir nome de campo.
  const CAMPO_SECRETO = new RegExp("^" + SEGREDOS.source.slice(1, SEGREDOS.source.indexOf(")") + 1) + "$", "i");

  // Copia só os campos simples de um objeto (texto, número, sim/não), mais as
  // configurações do leilão, listas de códigos e o @ de perfis.
  function raso(o, profundidade = 0) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      if (CAMPO_SECRETO.test(k)) continue;
      if (v == null || typeof v !== "object") r[k] = v;
      else if (/_profile$|^(winner|buyer|user)$/.test(k) && typeof v.username === "string")
        r[k] = { id: v.id ?? null, username: v.username, display_name: v.display_name ?? null };
      else if (k === "settings" && profundidade === 0) r[k] = raso(v, 1);
      else if (Array.isArray(v) && v.every((x) => typeof x === "string")) r[k] = v.slice(0, 500);
    }
    return r;
  }

  // Quem é quem: a Jamble manda muita coisa só com o código do usuário (quem
  // deu lance, quem está na batalha). Sempre que um código aparece junto com o
  // @ -- no chat, num lance vencedor, numa emotion --, o par vai para o
  // background, que monta um dicionário que vale para as próximas lives.
  const perfisVistos = new Set();
  function juntarPerfis(valor, saida, profundidade = 0) {
    if (!valor || typeof valor !== "object" || profundidade > 8) return;
    if (Array.isArray(valor)) {
      for (const v of valor) juntarPerfis(v, saida, profundidade + 1);
      return;
    }
    const id = typeof valor.id === "string" ? valor.id : typeof valor.userId === "string" ? valor.userId : null;
    if (id && typeof valor.username === "string" && valor.username) saida[id] = valor.username.replace(/^@/, "");
    for (const v of Object.values(valor)) juntarPerfis(v, saida, profundidade + 1);
  }
  function guardarPerfis(dados) {
    const achados = {};
    juntarPerfis(dados, achados);
    const novos = {};
    for (const [id, handle] of Object.entries(achados)) {
      const chave = id + "=" + handle;
      if (perfisVistos.has(chave)) continue;
      perfisVistos.add(chave);
      novos[id] = handle;
    }
    if (Object.keys(novos).length) avisar("perfis", novos);
  }

  // O leilão em andamento. Os lances e a lista de quem disputou às vezes chegam
  // sem dizer de qual leilão são -- valem para o último que apareceu.
  let leilaoAtual = null;
  // O chat da live é o group_message que a própria live informa. Até ela
  // informar, as mensagens esperam aqui em vez de serem contadas no escuro.
  let grupoDaLive = null;
  let chatEsperando = [];
  let ultimoQuadro = "";
  const amostrasVistas = new Set();
  // Campos que eu ainda não vi com dado numa live de verdade. Na primeira vez
  // que aparecerem, vai uma amostra (sem dado pessoal) para o arquivo de
  // depuração, para a leitura poder ser conferida depois.
  const NUNCA_VISTOS = [
    "offer",
    "giveaway",
    "giveaway_product",
    "giveaway_participant",
    "giveaway_participants",
    "transaction",
    "purchase_intent",
    "sale_max_bid",
  ];

  function mandarChat(mensagens) {
    if (mensagens.length) avisar("quadro", { grupoDaLive, data: { messages: mensagens } });
  }

  function guardarQuadro(dados, origem) {
    const d = dados?.data;
    if (!d || typeof d !== "object" || Array.isArray(d)) return;

    for (const k of NUNCA_VISTOS) {
      if (d[k] == null || amostrasVistas.has(k)) continue;
      amostrasVistas.add(k);
      avisar("amostra", { chave: k, origem, texto: semSegredo(JSON.stringify(d[k])).slice(0, 1500) });
    }

    if (typeof d.show?.group_message_id === "string" && d.show.group_message_id !== grupoDaLive) {
      grupoDaLive = d.show.group_message_id;
      const fila = chatEsperando;
      chatEsperando = [];
      mandarChat(fila.filter((m) => m.group_message_id === grupoDaLive));
    }

    if (Array.isArray(d.messages)) {
      const grupoDaUrl = (origem.match(/group_message\/([\w-]+)/) || [])[1] || null;
      const novas = [];
      for (const m of d.messages) {
        if (!m?.id || jaVistos.has("msg:" + m.id)) continue;
        jaVistos.add("msg:" + m.id);
        novas.push({
          id: String(m.id),
          created_at: m.created_at ?? null,
          message_type: m.message_type ?? null,
          group_message_id: m.group_message_id || grupoDaUrl,
          is_visible: m.is_visible !== false,
          // O texto vai junto: é o chat público da live, e o painel mostra o
          // que as pessoas estão falando. Conversa privada não sai daqui (o
          // filtro do grupo, logo abaixo).
          content: typeof m.content === "string" ? m.content.slice(0, 500) : "",
          sender_profile: m.sender_profile?.username
            ? {
                id: m.sender_profile.id ?? null,
                username: m.sender_profile.username,
                display_name: m.sender_profile.display_name ?? null,
                foto: fotoDe(m.sender_profile),
              }
            : null,
        });
      }
      // Conversa privada (outro grupo) não sai daqui.
      if (grupoDaLive) mandarChat(novas.filter((m) => m.group_message_id === grupoDaLive));
      else chatEsperando = chatEsperando.concat(novas).slice(-500);
    }

    // Mensagem editada ou apagada pela moderação: o painel acompanha (e some
    // com a apagada, em vez de continuar mostrando).
    if (Array.isArray(d.updated_messages) && grupoDaLive) {
      const mudadas = d.updated_messages
        .filter((m) => m?.id && m.group_message_id === grupoDaLive)
        .map((m) => ({
          id: String(m.id),
          group_message_id: m.group_message_id,
          is_visible: m.is_visible !== false,
          content: typeof m.content === "string" ? m.content.slice(0, 500) : "",
        }));
      if (mudadas.length) avisar("quadro", { grupoDaLive, data: { updated_messages: mudadas } });
    }

    if (d.sale?.id) leilaoAtual = String(d.sale.id);
    const q = {};
    for (const k of ["sale", "sale_best_entry", "battle", "giveaway", "offer"]) {
      if (d[k] && typeof d[k] === "object") q[k] = raso(d[k]);
    }
    if (d.sale_entry_count != null) q.sale_entry_count = Number(d.sale_entry_count) || 0;
    if (Array.isArray(d.sale_entry_user_ids)) {
      q.sale_entry_user_ids = d.sale_entry_user_ids.filter((x) => typeof x === "string").slice(0, 500);
    }
    for (const k of ["sale_product", "giveaway_product", "product"]) {
      if (typeof d[k]?.title === "string") q[k] = { title: d[k].title };
    }
    // De quem é a live: separa, no histórico de clientes, as lives dela das
    // lives de outros vendedores que ela acompanha.
    if (typeof d.seller?.username === "string") q.seller = { username: d.seller.username.replace(/^@/, "") };
    if (!Object.keys(q).length) return;
    // O frame da live chega a cada poucos segundos repetindo o mesmo estado:
    // só vai adiante quando alguma coisa mudou.
    const foto = JSON.stringify([leilaoAtual, q]);
    if (foto === ultimoQuadro) return;
    ultimoQuadro = foto;
    avisar("quadro", { leilaoAtual, grupoDaLive, data: q });
  }

  // O ranking mensal de vendedores, quando a página pede (o botão "Ranking do
  // vendedor: #N" da live). A resposta traz o top 20, o dono da live à parte
  // (mesmo fora do top 20) e as regras de pontos da Jamble. Sai só posição,
  // pontos e @ -- sem foto nem código.
  function guardarRankingMensal(dados) {
    if (!Array.isArray(dados?.participants)) return;
    const resumo = (p) => ({ rank: p?.rank, points: p?.points, username: p?.username });
    avisar("ranking-mensal", {
      quando: Date.now(),
      titulo: typeof dados.title === "string" ? dados.title : "",
      participants: dados.participants.map(resumo),
      seller: dados.seller ? resumo(dados.seller) : null,
      // "+3 pontos para cada R$1 gasto", "+2 pontos para cada gema enviada".
      rules: Array.isArray(dados.rules)
        ? dados.rules.map((r) => ({ icon: r?.icon ?? null, entryPoints: r?.entryPoints ?? null, rule: r?.rule ?? "" }))
        : [],
    });
  }

  function analisar(texto, origem) {
    if (!texto || texto.length > 400000) return;
    let dados;
    try {
      dados = JSON.parse(texto);
    } catch {
      return;
    }
    guardarEventos(dados, origem);
    guardarAoVivo(dados);
    guardarEu(dados);
    guardarPerfis(dados);
    guardarQuadro(dados, origem);
    if (origem.includes("/api/live/seller-ranking")) guardarRankingMensal(dados);
    if (/show-summary|show-dashboard/.test(origem)) guardarMetricas(dados, origem);
    if (origem.includes("/api/live/emojis")) guardarTabela(dados);
    // Dois endereços dão a mesma coisa: o do painel do vendedor e o da
    // própria página da live. Vale o que chegar.
    if (origem.includes("show-participation") || origem.includes("/api/live/participation")) {
      guardarParticipacao(dados, origem);
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
