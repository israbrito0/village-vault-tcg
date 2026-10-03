// Contas sobre o que acontece na live além das gemas: leilões, quem disputou,
// batalha, chat, ranking mensal e o histórico de clientes entre lives.
//
// Tudo aqui é conta pura (entra dado, sai resultado), para o background, o
// painel e os testes usarem exatamente o mesmo código.
//
// Os formatos vêm do WebSocket da Jamble, canal "show" e "group_message",
// capturados em lives de verdade em 03/10/2026.

(function (raiz) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  // Funções do gemas.js: no navegador ele já foi carregado antes deste; no
  // Node (testes), vem pelo require.
  const doGemas = typeof module !== "undefined" && module.exports ? require("./gemas.js") : raiz;
  const ms = (seg) => (seg ? Math.round(Number(seg) * 1000) : null);

  // Perfis: a Jamble manda quem deu lance e quem está na batalha como CÓDIGO
  // de usuário, não como @. O @ só aparece quando a pessoa fala no chat, manda
  // emotion, ganha um leilão etc. O inject.js junta esses pares (código → @)
  // e o background guarda entre lives: quanto mais lives, mais gente ele
  // reconhece. Quem ainda não apareceu fica sem nome, nunca com nome chutado.
  const nomeDe = (id, perfis) => (perfis && perfis[id]) || null;
  const acabou = (l) => l.status === "FINISHED" || l.vendido === true || l.cancelado === true;

  // ---------------------------------------------------------------------------
  // Leilões
  // ---------------------------------------------------------------------------

  // Tira de um frame do WebSocket o que ele diz sobre a venda em andamento.
  // São dois tipos, vistos numa live de verdade em 03/10/2026:
  //   AUCTION      leilão: lances, quem disputou, quem levou e por quanto
  //   BUY_IT_NOW   compra direta: preço fixo e várias unidades; a Jamble só
  //                diz QUANTAS saíram (sold_count), não quem comprou
  // O item, os lances e quem disputou chegam em frames separados: este é só o
  // pedaço; quem junta é mesclarLeilao.
  function leilaoDoFrame(dados, idAtual) {
    const d = dados?.data;
    if (!d || typeof d !== "object") return null;
    const s = d.sale;
    const id = s?.id || d.sale_best_entry?.sale_id || (d.sale_entry_user_ids || d.sale_entry_count != null ? idAtual : null);
    if (!id) return null;

    const p = { id };
    if (s) {
      p.status = s.status || null;
      p.vendido = s.is_sold === true;
      p.cancelado = s.is_canceled === true;
      p.tipo = s.settings?.type || null;
      p.inicial = s.settings?.starting_price != null ? n(s.settings.starting_price) : null;
      p.duracao = s.settings?.duration_in_secs != null ? n(s.settings.duration_in_secs) : null;
      // available_count é o que ainda resta; sold_count o que já saiu.
      p.restam = s.available_count != null ? n(s.available_count) : null;
      p.vendidas = s.sold_count != null ? n(s.sold_count) : null;
      p.preco = s.price != null ? n(s.price) : null;
      p.inicio = ms(s.created_at);
      p.fim = ms(s.ended_at);
      if (s.sold_price != null) p.vendidoPor = n(s.sold_price);
      if (s.total_sold_price != null) p.totalVendido = n(s.total_sold_price);
      if (typeof s.buyer_id === "string") p.vencedorId = s.buyer_id;
    }
    if (d.sale_product?.title) p.titulo = String(d.sale_product.title);
    const best = d.sale_best_entry;
    if (best && (!best.sale_id || best.sale_id === id)) {
      p.melhor = n(best.price);
      if (typeof best.buyer_id === "string") p.vencedorId = best.buyer_id;
      if (best.buyer_profile?.username) p.vencedor = best.buyer_profile.username.replace(/^@/, "");
    }
    if (d.sale_entry_count != null) p.lances = n(d.sale_entry_count);
    if (Array.isArray(d.sale_entry_user_ids)) p.disputantes = d.sale_entry_user_ids.filter((x) => typeof x === "string");
    return p;
  }

  // Junta o pedaço novo no que já se sabia daquele leilão. Número só sobe (um
  // frame atrasado não pode desfazer lance), quem disputou só acumula, e o
  // leilão não "desacaba": a Jamble reenvia o leilão encerrado por um tempo,
  // e um frame velho de "rolando" chegando depois não pode reabrir nada.
  const ORDEM = { STARTED: 1, FINISHING: 2, FINISHED: 3 };
  function mesclarLeilao(antes, parcial) {
    const r = { ...(antes || {}) };
    const fechado = acabou(r);
    for (const [k, v] of Object.entries(parcial || {})) {
      if (v == null) continue;
      if (k === "lances" || k === "melhor" || k === "vendidas") r[k] = Math.max(n(r[k]), n(v));
      else if (k === "disputantes") r[k] = [...new Set([...(r[k] || []), ...v])];
      else if (k === "status") {
        if (!r.status || (ORDEM[v] || 0) >= (ORDEM[r.status] || 0)) r.status = v;
      } else if (k === "vendido" || k === "cancelado") r[k] = r[k] === true || v === true;
      else if (fechado && (k === "vencedorId" || k === "vencedor") && r[k]) continue;
      else r[k] = v;
    }
    return r;
  }

  const ehDireta = (l) => l.tipo === "BUY_IT_NOW";

  // Uma linha por venda vista ao vivo (WebSocket).
  function linhasDoAoVivo(leiloes, perfis) {
    return Object.values(leiloes || {}).map((l) => {
      const direta = ehDireta(l);
      const vendidas = n(l.vendidas) || (l.vendido ? 1 : 0);
      // Leilão: o lance que levou. Compra direta: o preço de cada unidade.
      const final = direta ? n(l.preco) : n(l.vendidoPor || l.melhor);
      const situacao = l.cancelado
        ? "cancelado"
        : l.vendido || (direta && acabou(l) && vendidas > 0)
          ? "vendido"
          : acabou(l)
            ? "sem venda"
            : "rolando";
      // Quanto entrou: o total da Jamble, quando ela manda; senão a conta.
      const total = l.cancelado
        ? 0
        : n(l.totalVendido) || (direta ? final * vendidas : situacao === "vendido" ? final : 0);
      return {
        id: l.id,
        titulo: l.titulo || "item sem nome",
        tipo: direta ? "compra direta" : "leilão",
        inicial: n(l.inicial),
        final,
        total,
        vendidas,
        restam: l.restam ?? null,
        multiplicador: !direta && l.inicial > 0 && final > 0 ? final / l.inicial : null,
        lances: n(l.lances),
        disputaram: (l.disputantes || []).length,
        // Com o leilão rolando, é quem está na frente; depois, quem levou.
        vencedor: direta ? null : l.vencedor || nomeDe(l.vencedorId, perfis),
        situacao,
        inicio: l.inicio,
        fonte: "ao vivo",
      };
    });
  }

  // Os números de resumo de uma lista de vendas.
  function resumoDasLinhas(linhas) {
    const lista = linhas.slice().sort((a, b) => n(b.inicio) - n(a.inicio));
    // Só uma venda roda por vez: a mais nova. Uma mais antiga que ficou
    // "rolando" é uma cujo fim não passou por aqui (a aba fechou no meio, por
    // exemplo). Unidade de compra direta que saiu é venda de verdade; o resto,
    // não dá para saber como acabou -- e não pode aparecer como "rolando agora".
    for (const l of lista.slice(1)) {
      if (l.situacao !== "rolando") continue;
      l.situacao = l.tipo === "compra direta" && l.vendidas > 0 ? "vendido" : "fim não visto";
    }
    const vendidos = lista.filter((l) => l.situacao === "vendido");
    const mults = vendidos.map((l) => l.multiplicador).filter((m) => m != null);
    return {
      lista,
      vendidos: vendidos.length,
      // Compra direta ainda aberta já vendeu unidades: isso também entrou.
      faturado: lista.reduce((s, l) => s + l.total, 0),
      unidades: lista.reduce((s, l) => s + (l.total > 0 ? l.vendidas : 0), 0),
      multiplicadorMedio: mults.length ? mults.reduce((s, m) => s + m, 0) / mults.length : null,
      maisDisputado: vendidos.filter((l) => l.lances > 0).sort((a, b) => b.lances - a.lances)[0] || null,
      rolando: lista.find((l) => l.situacao === "rolando") || null,
    };
  }

  // A lista para a tela e os números de resumo, só do que passou ao vivo.
  function resumirLeiloes(leiloes, perfis) {
    return resumoDasLinhas(linhasDoAoVivo(leiloes, perfis));
  }

  // Tudo que a live vendeu: a lista "Vendidos" da Jamble (desde o começo, com
  // quem comprou) junto com o que passou ao vivo depois dela, sem contar nada
  // duas vezes.
  //   - leilão: o mesmo saleId nas duas -- fica a linha da lista, com os
  //     lances e quem disputou que só o ao vivo sabe;
  //   - compra direta: na lista, cada compra é uma linha com quem comprou; ao
  //     vivo é um anúncio só. Do anúncio entram apenas as unidades que saíram
  //     depois da última leitura da lista (vendidasNaHistoria, no background).
  function resumirVendas(live, perfis) {
    const aoVivo = linhasDoAoVivo(live?.leiloes, perfis);
    const historia = Object.values(live?.vendidos || {});
    if (!historia.length) return { ...resumoDasLinhas(aoVivo), desdeInicio: false, lidoEm: null };

    const doAoVivo = new Map(aoVivo.map((l) => [l.id, l]));
    const linhas = historia.map((h) => {
      const ws = doAoVivo.get(h.saleId);
      const direta = h.tipo === "BUY_IT_NOW";
      const final = n(h.preco);
      const unidades = n(h.unidades) || 1;
      return {
        id: h.saleId,
        titulo: h.titulo || ws?.titulo || "item sem nome",
        tipo: direta ? "compra direta" : "leilão",
        inicial: n(h.inicial),
        final,
        total: h.cancelado ? 0 : n(h.total) || final * unidades,
        vendidas: unidades,
        restam: null,
        multiplicador: !direta && n(h.inicial) > 0 && final > 0 ? final / n(h.inicial) : null,
        lances: ws?.lances ?? 0,
        disputaram: ws?.disputaram ?? 0,
        vencedor: h.comprador || null,
        situacao: h.cancelado ? "cancelado" : "vendido",
        inicio: h.quando ?? ws?.inicio ?? null,
        fonte: "jamble",
      };
    });
    const naHistoria = new Set(historia.map((h) => h.saleId));
    for (const l of aoVivo) {
      if (naHistoria.has(l.id)) continue;
      if (l.tipo !== "compra direta") {
        linhas.push(l);
        continue;
      }
      const depois = Math.max(0, l.vendidas - n(live.leiloes?.[l.id]?.vendidasNaHistoria));
      if (l.situacao !== "rolando" && !depois) continue;
      linhas.push({ ...l, vendidas: depois, total: depois * l.final });
    }
    return { ...resumoDasLinhas(linhas), desdeInicio: true, lidoEm: n(live.vendidosEm) || null };
  }

  // Quem mais comprou na live, e o quê. Fontes, da mais certa para a menos:
  //   - a Participação da Jamble (só na live dela): o total que cada pessoa
  //     gastou, contado pela Jamble;
  //   - as vendas da live (resumirVendas): a lista "Vendidos" desde o começo,
  //     com quem comprou, mais os leilões que fecharam ao vivo depois dela.
  // O total é o maior: a Participação é lida de tempos em tempos e pode estar
  // uns segundos atrás de um leilão que acabou de fechar.
  function rankingDeCompras(live, perfis) {
    const pessoas = new Map();
    const pessoa = (handle, nome) => {
      const p = pessoas.get(handle) || { handle, nome: nome || handle, daJamble: null, itens: [] };
      if (nome && p.nome === handle) p.nome = nome;
      pessoas.set(handle, p);
      return p;
    };
    for (const l of live?.linhas || []) {
      if (l?.handle && n(l.gastou) > 0) pessoa(l.handle, l.nome).daJamble = n(l.gastou);
    }
    for (const v of resumirVendas(live, perfis).lista) {
      if (v.situacao !== "vendido" || !v.vencedor || v.total <= 0) continue;
      pessoa(v.vencedor).itens.push({
        titulo: v.titulo,
        valor: v.total,
        unidades: v.vendidas,
        tipo: v.tipo,
        quando: n(v.inicio),
      });
    }
    return [...pessoas.values()]
      .map((p) => {
        const dasVendas = p.itens.reduce((s, i) => s + i.valor, 0);
        return {
          handle: p.handle,
          nome: p.nome,
          total: Math.max(n(p.daJamble), dasVendas),
          itens: p.itens.sort((a, b) => b.valor - a.valor),
        };
      })
      .filter((p) => p.total > 0)
      .sort((a, b) => b.total - a.total || b.itens.length - a.itens.length);
  }

  // Gemas de cada pessoa desde o começo, numa live de outro vendedor: não há
  // Participação, mas há o ranking da batalha, que dá pontos por gema e por
  // real gasto (as regras vêm na resposta: hoje 1 por gema, 15 por real).
  // Tirando o que a pessoa comprou desde que a batalha começou (lista
  // Vendidos), sobra o que veio de gema. É estimativa: só vale com a lista
  // Vendidos lida, e cobre quem está no ranking da batalha.
  function gemasPelaBatalha(live) {
    const ranking = live?.batalhaRanking;
    if (!ranking?.lista?.length || !live?.vendidosEm) return [];
    const regras = regrasDoRanking({ rules: ranking.regras });
    if (!regras || !regras.porGema) return [];
    const batalha = Object.values(live.batalhas || {}).sort((a, b) => n(b.visto) - n(a.visto))[0];
    const comecou = n(batalha?.comecou);
    const gasto = new Map();
    for (const v of Object.values(live.vendidos || {})) {
      if (v.cancelado || !v.comprador || (comecou && n(v.quando) < comecou)) continue;
      gasto.set(v.comprador, (gasto.get(v.comprador) || 0) + n(v.total));
    }
    return ranking.lista
      .map((p) => ({
        handle: p.handle,
        time: p.time,
        pontos: n(p.pontos),
        gemas: Math.max(0, Math.round((n(p.pontos) - n(regras.porReal) * (gasto.get(p.handle) || 0)) / regras.porGema)),
      }))
      .filter((p) => p.gemas > 0);
  }

  // O ranking de gemas: as emotions vistas (sabem o ícone, mas só desde que a
  // página abriu) com o total desde o começo, quando existe -- a Participação
  // na live dela (exato) ou a estimativa pela batalha na de outro vendedor.
  function juntarGemas(porPessoaEmocoes, linhas, estimadas) {
    const m = new Map();
    for (const p of porPessoaEmocoes || []) {
      m.set(p.handle, { ...p, icones: { ...(p.icones || {}) }, vistas: n(p.gemas), desdeInicio: null });
    }
    const pega = (handle, nome) => {
      if (!m.has(handle)) m.set(handle, { handle, nome: nome || handle, qtd: 0, gemas: 0, icones: {}, vistas: 0, desdeInicio: null });
      return m.get(handle);
    };
    const temParticipacao = (linhas || []).some((l) => n(l.gemas) > 0);
    for (const l of linhas || []) {
      if (!l?.handle || n(l.gemas) <= 0) continue;
      const p = pega(l.handle, l.nome);
      p.desdeInicio = "jamble";
      p.gemas = Math.max(p.vistas, n(l.gemas));
    }
    if (!temParticipacao) {
      for (const e of estimadas || []) {
        const p = pega(e.handle);
        if (e.gemas > p.vistas) {
          p.gemas = e.gemas;
          p.desdeInicio = "estimado";
        }
      }
    }
    return [...m.values()].sort((a, b) => b.gemas - a.gemas || b.qtd - a.qtd);
  }

  // Quem deu lance e não levou: cliente quente para a próxima live.
  function quemDisputou(leiloes, perfis) {
    const pessoas = new Map();
    for (const l of Object.values(leiloes || {})) {
      if (!acabou(l)) continue; // leilão rolando ainda não tem perdedor
      const titulo = l.titulo || "item sem nome";
      for (const id of l.disputantes || []) {
        const p = pessoas.get(id) || { id, handle: nomeDe(id, perfis), disputou: 0, ganhou: 0, perdeu: 0, perdidos: [] };
        p.disputou++;
        if (l.vendido && id === l.vencedorId) p.ganhou++;
        else {
          p.perdeu++;
          p.perdidos.push(titulo);
        }
        pessoas.set(id, p);
      }
    }
    return [...pessoas.values()].sort(
      (a, b) => b.perdeu - a.perdeu || b.disputou - a.disputou || !!b.handle - !!a.handle,
    );
  }

  // ---------------------------------------------------------------------------
  // Batalha (time vermelho x azul)
  // ---------------------------------------------------------------------------

  function batalhaDoFrame(dados) {
    const b = dados?.data?.battle;
    if (!b || typeof b !== "object" || !b.id) return null;
    const time = (cor) => ({
      pessoas: n(b[`${cor}_team_participant_count`]),
      pontos: n(b[`${cor}_team_participant_total_entry_count`]),
      top: Array.isArray(b[`${cor}_team_participant_top_user_ids`]) ? b[`${cor}_team_participant_top_user_ids`] : [],
      todos: Array.isArray(b[`${cor}_team_participant_user_ids`]) ? b[`${cor}_team_participant_user_ids`] : [],
    });
    return {
      id: b.id,
      status: b.status || null,
      acabou: b.is_over === true,
      tier: b.tier || null,
      comecou: ms(b.started_at),
      termina: ms(b.ending_at),
      vermelho: time("red"),
      azul: time("blue"),
    };
  }

  function resumirBatalha(b, perfis) {
    if (!b) return null;
    const nomes = (ids) => ids.map((id) => nomeDe(id, perfis) || null);
    const v = b.vermelho || { pessoas: 0, pontos: 0, top: [] };
    const a = b.azul || { pessoas: 0, pontos: 0, top: [] };
    const lider = v.pontos === a.pontos ? "empate" : v.pontos > a.pontos ? "vermelho" : "azul";
    return {
      lider,
      diferenca: Math.abs(v.pontos - a.pontos),
      vermelho: { ...v, topNomes: nomes(v.top || []) },
      azul: { ...a, topNomes: nomes(a.top || []) },
      acabou: !!b.acabou,
      termina: b.termina,
      tier: b.tier,
    };
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  // Só as mensagens do chat DA LIVE. A Jamble usa o mesmo tipo de canal
  // (group_message) para conversa privada; o que separa uma da outra é o
  // group_message_id, que a live informa no objeto dela. Mensagem de outro
  // grupo (uma conversa privada aberta durante a live) não entra na conta.
  function mensagensDoFrame(dados) {
    const lista = dados?.data?.messages;
    const grupo = dados?.grupoDaLive;
    if (!Array.isArray(lista) || !grupo) return [];
    return lista
      .filter((m) => m && m.id && m.sender_profile?.username && m.group_message_id === grupo)
      .map((m) => ({
        id: String(m.id),
        handle: m.sender_profile.username.replace(/^@/, ""),
        nome: m.sender_profile.display_name || m.sender_profile.username,
        tipo: String(m.message_type || "STANDARD"),
        // O que a pessoa escreveu (chat público da live), para o painel mostrar.
        texto: typeof m.content === "string" ? m.content.slice(0, 500) : "",
        visivel: m.is_visible !== false,
        foto: m.sender_profile.foto || null,
        ts: ms(m.created_at) || Date.now(),
      }));
  }

  // Mensagem editada ou apagada (pela moderação ou por quem escreveu).
  function edicoesDoFrame(dados) {
    const lista = dados?.data?.updated_messages;
    const grupo = dados?.grupoDaLive;
    if (!Array.isArray(lista) || !grupo) return [];
    return lista
      .filter((m) => m && m.id && m.group_message_id === grupo)
      .map((m) => ({
        id: String(m.id),
        visivel: m.is_visible !== false,
        texto: typeof m.content === "string" ? m.content.slice(0, 500) : "",
      }));
  }

  function resumirChat(chat, agora = Date.now()) {
    const porPessoa = chat?.porPessoa || {};
    const ts = chat?.ts || [];
    const ultimos5 = ts.filter((t) => t >= agora - 5 * 60 * 1000).length;
    return {
      total: n(chat?.total),
      porMinuto: ultimos5 / 5,
      // Quase tudo é "STANDARD". Se a Jamble usar outro tipo (oferta, aviso de
      // compra...), aparece aqui separado em vez de sumir na conta.
      porTipo: { ...(chat?.porTipo || {}) },
      top: Object.entries(porPessoa)
        .map(([handle, v]) => ({ handle, nome: v.nome || handle, mensagens: n(v.n) }))
        .sort((a, b) => b.mensagens - a.mensagens),
    };
  }

  // ---------------------------------------------------------------------------
  // Ranking mensal de vendedores
  // ---------------------------------------------------------------------------

  // A Jamble manda o top 20 e, à parte, o dono da live que está aberta (mesmo
  // que ele esteja em #125). Os dois entram na mesma lista.
  function rankingDaResposta(dados) {
    const lista = dados?.participants;
    if (!Array.isArray(lista)) return null;
    const todos = dados.seller ? lista.concat([dados.seller]) : lista;
    const vistos = new Set();
    return todos
      .filter((p) => p && p.username)
      .map((p) => ({ posicao: n(p.rank), pontos: n(p.points), handle: String(p.username).replace(/^@/, "") }))
      .filter((p) => !vistos.has(p.handle) && vistos.add(p.handle))
      .sort((a, b) => a.posicao - b.posicao);
  }

  // As regras de pontos que vêm na própria resposta ("+3 pontos para cada R$1
  // gasto", "+2 pontos para cada gema enviada"). Lidas de lá, não escritas
  // aqui: se a Jamble mudar, o painel acompanha.
  function regrasDoRanking(dados) {
    const regras = Array.isArray(dados?.rules) ? dados.rules : [];
    const de = (icone) => {
      // entryPoints null é regra de prêmio ("Top 20: R$ 200 por indicação"),
      // não de pontos -- e Number(null) daria 0, não "nada".
      const r = regras.find((x) => x?.icon === icone && x.entryPoints != null && Number.isFinite(Number(x.entryPoints)));
      return r ? Number(r.entryPoints) : null;
    };
    const porReal = de("shop");
    const porGema = de("gem");
    return porReal == null && porGema == null ? null : { porReal, porGema };
  }

  // Quantos pontos uma live rende para o vendedor, pelas regras da Jamble.
  function pontosDaLive(regras, faturamento, gemas) {
    if (!regras) return null;
    return Math.round(n(faturamento) * n(regras.porReal) + n(gemas) * n(regras.porGema));
  }

  // Onde você está e quanto falta para subir.
  function minhaPosicao(ranking, meuHandle) {
    if (!Array.isArray(ranking) || !ranking.length) return null;
    const eu = ranking.find((p) => p.handle === meuHandle) || null;
    const corteTop20 = ranking.find((p) => p.posicao === 20) || null;
    if (!eu) return { eu: null, corteTop20 };
    // Fora do top 20, quem está logo acima não vem na lista: aí não dá para
    // dizer quanto falta para ele -- só para o top 20.
    const acima = ranking.find((p) => p.posicao === eu.posicao - 1) || null;
    return {
      eu,
      acima,
      faltaParaSubir: acima ? acima.pontos - eu.pontos + 1 : null,
      corteTop20,
      folgaNoTop20: corteTop20 && eu.posicao <= 20 ? eu.pontos - corteTop20.pontos : null,
      faltaParaTop20: corteTop20 && eu.posicao > 20 ? corteTop20.pontos - eu.pontos + 1 : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Histórico de clientes entre lives
  // ---------------------------------------------------------------------------

  // O resumo de UMA live por pessoa, para guardar no histórico. É recalculado
  // inteiro a partir da live toda vez -- nunca somado em cima --, para uma
  // leitura repetida não contar a mesma gema duas vezes.
  function resumoDaLive(live, perfis) {
    const pessoas = {};
    const p = (h) =>
      (pessoas[h] = pessoas[h] || { gemas: 0, gastou: 0, envios: 0, ganhou: 0, disputou: 0, mensagens: 0 });

    // Live dela: a participação da Jamble já traz gemas, compras e mensagens
    // de cada pessoa, contadas pela própria Jamble. É o número mais certo.
    const linhas = live?.linhas || [];
    for (const l of linhas) {
      if (!l.handle) continue;
      const x = p(l.handle);
      x.gemas = Math.max(x.gemas, n(l.gemas));
      x.gastou = Math.max(x.gastou, n(l.gastou));
      x.mensagens = Math.max(x.mensagens, n(l.mensagens));
    }
    // Sem participação (live de outro vendedor), sai do que a extensão viu.
    const temParticipacao = linhas.length > 0;
    for (const e of live?.emocoes || []) {
      if (!e.handle) continue;
      const x = p(e.handle);
      x.envios++;
      if (!temParticipacao) x.gemas += n(e.gemas);
    }
    if (!temParticipacao) {
      for (const [h, v] of Object.entries(live?.chat?.porPessoa || {})) p(h).mensagens += n(v.n);
    }
    // Quem disputou: só o ao vivo sabe (os códigos de quem deu lance).
    for (const l of Object.values(live?.leiloes || {})) {
      if (!acabou(l) || ehDireta(l)) continue;
      for (const id of l.disputantes || []) {
        const h = nomeDe(id, perfis);
        if (h) p(h).disputou++;
      }
    }
    // Quem levou e quanto gastou: as vendas da live, desde o começo quando a
    // lista Vendidos já foi lida (inclui compra direta).
    for (const v of resumirVendas(live, perfis).lista) {
      if (v.situacao !== "vendido" || !v.vencedor) continue;
      if (v.tipo === "leilão") p(v.vencedor).ganhou++;
      if (!temParticipacao) p(v.vencedor).gastou += n(v.total);
    }
    return {
      titulo: live?.titulo || "",
      vendedor: live?.vendedor || null,
      quando: n(live?.quando) || Date.now(),
      dela: !!live?.doPainel,
      pessoas,
    };
  }

  // O histórico guardado é refeito de tempos em tempos (no máximo a cada 20s
  // por live). Para a tela não ficar atrás do que acabou de acontecer, as lives
  // que ainda estão inteiras na memória entram resumidas na hora, por cima.
  function historicoComLives(historico, lives, perfis) {
    const junto = { ...(historico || {}) };
    for (const live of Object.values(lives || {})) {
      if (!live?.id) continue;
      const r = resumoDaLive(live, perfis);
      if (Object.keys(r.pessoas).length) junto[live.id] = r;
    }
    return junto;
  }

  // Junta o histórico inteiro por pessoa. "meu" é o @ de quem usa a extensão:
  // é o que separa as lives dela das lives de outros vendedores.
  function clientes(historico, meu) {
    const ehDela = (r) => r.dela || (!!meu && r.vendedor === meu);
    // As duas lives mais recentes dela: quem era de casa e não apareceu em
    // nenhuma das duas está "sumido".
    const recentes = Object.values(historico || {})
      .filter(ehDela)
      .map((r) => n(r.quando))
      .sort((a, b) => b - a);
    const corte = recentes.length >= 3 ? recentes[1] : null;

    const m = new Map();
    for (const [liveId, r] of Object.entries(historico || {})) {
      const dela = ehDela(r);
      for (const [handle, x] of Object.entries(r.pessoas || {})) {
        if (meu && handle === meu) continue;
        const c =
          m.get(handle) ||
          { handle, lives: 0, livesDela: 0, gemas: 0, gastou: 0, envios: 0, ganhou: 0, disputou: 0, mensagens: 0, ultima: 0, ultimaLive: "", ultimaDela: 0 };
        c.lives++;
        if (dela) {
          c.livesDela++;
          c.ultimaDela = Math.max(c.ultimaDela, n(r.quando));
        }
        c.gemas += n(x.gemas);
        c.gastou += n(x.gastou);
        c.envios += n(x.envios);
        c.ganhou += n(x.ganhou);
        c.disputou += n(x.disputou);
        c.mensagens += n(x.mensagens);
        if (n(r.quando) > c.ultima) {
          c.ultima = n(r.quando);
          c.ultimaLive = r.titulo || liveId;
        }
        m.set(handle, c);
      }
    }
    return [...m.values()]
      .map((c) => ({
        ...c,
        perfil:
          c.gastou > 0 && c.gemas > 0
            ? "compra e manda gema"
            : c.gastou > 0
              ? "só compra"
              : c.gemas > 0
                ? "só manda gema"
                : c.disputou > 0
                  ? "disputa e não leva"
                  : c.mensagens > 0
                    ? "só conversa"
                    : "só aparece",
        sumiu: corte != null && c.livesDela >= 2 && c.ultimaDela < corte,
      }))
      .sort((a, b) => b.gastou + b.gemas * 0.1 - (a.gastou + a.gemas * 0.1) || b.lives - a.lives);
  }

  // ---------------------------------------------------------------------------
  // Batalha ETB -- a da loja, não a da Jamble: abre-se uma ETB, cada booster
  // vai para uma pessoa, e quem tirar o maior hit leva. As vagas costumam ser
  // vendidas como um item da live (ex.: "Batalha 30 anos EUA", 9 unidades).
  // ---------------------------------------------------------------------------

  // Os itens já vendidos nesta live, com quantas unidades e quantas pessoas:
  // de onde puxar quem está na batalha. O mais recente primeiro.
  function itensComCompradores(vendas) {
    const m = new Map();
    for (const v of vendas?.lista || []) {
      if (v.situacao !== "vendido" || !v.vencedor) continue;
      const it = m.get(v.titulo) || { titulo: v.titulo, unidades: 0, compradores: new Set(), ultima: 0 };
      it.unidades += n(v.vendidas) || 1;
      it.compradores.add(v.vencedor);
      it.ultima = Math.max(it.ultima, n(v.inicio));
      m.set(v.titulo, it);
    }
    return [...m.values()]
      .map((i) => ({ titulo: i.titulo, unidades: i.unidades, compradores: i.compradores.size, ultima: i.ultima }))
      .sort((a, b) => b.ultima - a.ultima);
  }

  // Uma vaga por unidade comprada daquele item, na ordem em que compraram.
  function vagasDoItem(vendas, titulo, limite = 9) {
    const linhas = (vendas?.lista || [])
      .filter((v) => v.situacao === "vendido" && v.vencedor && v.titulo === titulo)
      .sort((a, b) => n(a.inicio) - n(b.inicio));
    const vagas = [];
    for (const v of linhas) for (let i = 0; i < (n(v.vendidas) || 1); i++) vagas.push(v.vencedor);
    return vagas.slice(0, limite);
  }

  // As batalhas ETB que aparecem nos nomes dos produtos vendidos na live
  // ("Batalha 1 ETB" -> nº 1): para cada número, quem pegou cada vaga (uma por
  // unidade, na ordem da compra) e quantas unidades já saíram sem o @ ainda
  // (compra direta ao vivo não diz quem comprou -- vem com a lista Vendidos).
  function batalhasPeloTitulo(vendas) {
    const m = new Map();
    const linhas = (vendas?.lista || []).slice().sort((a, b) => n(a.inicio) - n(b.inicio));
    for (const v of linhas) {
      const numero = doGemas?.numeroDaBatalhaETB?.(v.titulo);
      if (!numero) continue;
      const direta = v.tipo === "compra direta";
      // Leilão rolando: quem está na frente ainda não comprou nada.
      if (v.situacao !== "vendido" && !(direta && v.situacao === "rolando")) continue;
      const b = m.get(numero) || { numero, titulo: v.titulo, vagas: [], semDono: 0 };
      const unidades = n(v.vendidas) || (v.situacao === "vendido" ? 1 : 0);
      if (v.vencedor) for (let i = 0; i < unidades; i++) b.vagas.push(v.vencedor);
      else b.semDono += unidades;
      m.set(numero, b);
    }
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }

  // O número da próxima batalha na live (Batalha ETB nº 1, 2, 3...).
  function proximoNumeroETB(batalhas, liveId) {
    return (
      Object.values(batalhas || {})
        .filter((b) => b.liveId === liveId)
        .reduce((m, b) => Math.max(m, n(b.numero)), 0) + 1
    );
  }

  // Texto de fora (nome, @, hit) entra limpo e com tamanho máximo.
  const limpo = (t, max) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const arroba = (t) => limpo(t, 40).replace(/^@+/, "");

  // Toda mudança nas batalhas passa por aqui -- o background usa para gravar,
  // e o painel, quando roda fora da extensão. Devolve { ok, id }.
  //   criar     { liveId, titulo, boosters, vagas: [@...] }
  //   salvar    { id, titulo?, slots?: [{ handle, hit }] }
  //   encerrar  { id, ganhador, hit }
  //   reabrir   { id }
  //   apagar    { id }
  function novaBatalha(todas, { liveId, numero, titulo, boosters, vagas, auto }, agora) {
    const id = "etb-" + agora.toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    todas[id] = {
      id,
      liveId,
      numero,
      titulo,
      boosters,
      // "auto": o @ veio de quem comprou a vaga. Booster preenchido ou
      // corrigido na mão não é trocado pelo automático.
      slots: Array.from({ length: boosters }, (_, i) => ({ handle: arroba(vagas[i]), hit: "", auto: !!auto && !!arroba(vagas[i]) })),
      situacao: "rodando",
      ganhador: null,
      hit: "",
      criadaEm: agora,
      encerradaEm: null,
    };
    // Guarda as últimas 500.
    const ids = Object.keys(todas).sort((x, y) => n(todas[x].criadaEm) - n(todas[y].criadaEm));
    for (const velho of ids.slice(0, Math.max(0, ids.length - 500))) delete todas[velho];
    return todas[id];
  }

  function mudarBatalhaETB(todas, msg, agora = Date.now()) {
    const b = todas[msg?.id];
    if (msg?.acao === "criar") {
      const liveId = limpo(msg.liveId, 80);
      if (!liveId) return { ok: false };
      const nova = novaBatalha(
        todas,
        {
          liveId,
          numero: proximoNumeroETB(todas, liveId),
          titulo: limpo(msg.titulo, 80) || "ETB",
          boosters: Math.min(36, Math.max(1, Math.round(n(msg.boosters)) || 9)),
          vagas: Array.isArray(msg.vagas) ? msg.vagas : [],
          auto: false,
        },
        agora,
      );
      return { ok: true, id: nova.id };
    }
    // A batalha que veio do nome do produto ("Batalha 1 ETB"): cria se não
    // existe e preenche as vagas com quem comprou. Só mexe em booster vazio
    // ou que ela mesma preencheu antes; nunca no que foi escrito na mão, e
    // nunca numa batalha já encerrada.
    if (msg?.acao === "sincronizar") {
      const liveId = limpo(msg.liveId, 80);
      const numero = Math.round(n(msg.numero));
      if (!liveId || numero < 1) return { ok: false };
      const vagas = (Array.isArray(msg.vagas) ? msg.vagas : []).map(arroba).filter(Boolean).slice(0, 36);
      const semDono = Math.max(0, Math.round(n(msg.semDono)));
      let atual = Object.values(todas).find((x) => x.liveId === liveId && x.numero === numero);
      if (!atual) {
        atual = novaBatalha(
          todas,
          { liveId, numero, titulo: limpo(msg.titulo, 80) || `Batalha ${numero} ETB`, boosters: Math.min(36, Math.max(9, vagas.length)), vagas, auto: true },
          agora,
        );
        atual.automatica = true;
        atual.semDono = semDono;
        return { ok: true, id: atual.id, mudou: true };
      }
      if (atual.situacao !== "rodando") return { ok: true, id: atual.id, mudou: false };
      let mudou = false;
      if (vagas.length > atual.boosters) {
        while (atual.slots.length < vagas.length) atual.slots.push({ handle: "", hit: "", auto: false });
        atual.boosters = atual.slots.length;
        mudou = true;
      }
      atual.slots.forEach((s, i) => {
        const quem = vagas[i] || "";
        if (s.handle && !s.auto) return; // escrito na mão: fica
        if (s.handle === quem) return;
        s.handle = quem;
        s.auto = !!quem;
        mudou = true;
      });
      if (n(atual.semDono) !== semDono) {
        atual.semDono = semDono;
        mudou = true;
      }
      if (!atual.automatica) {
        atual.automatica = true;
        mudou = true;
      }
      return { ok: true, id: atual.id, mudou };
    }
    if (!b) return { ok: false };
    if (msg.acao === "salvar") {
      if (msg.titulo != null) b.titulo = limpo(msg.titulo, 80) || b.titulo;
      if (Array.isArray(msg.slots)) {
        b.slots = Array.from({ length: b.boosters }, (_, i) => {
          const quem = arroba(msg.slots[i]?.handle);
          const antes = b.slots[i];
          return {
            handle: quem,
            hit: limpo(msg.slots[i]?.hit, 120),
            // Continua automático só se ela não mexeu no @.
            auto: !!quem && quem === antes?.handle && !!antes?.auto,
          };
        });
      }
      return { ok: true, id: b.id };
    }
    if (msg.acao === "encerrar") {
      const ganhador = arroba(msg.ganhador);
      if (!ganhador) return { ok: false, id: b.id };
      b.ganhador = ganhador;
      b.hit = limpo(msg.hit, 120) || (b.slots.find((s) => s.handle === ganhador && s.hit)?.hit ?? "");
      b.situacao = "encerrada";
      b.encerradaEm = agora;
      return { ok: true, id: b.id };
    }
    if (msg.acao === "reabrir") {
      b.situacao = "rodando";
      b.ganhador = null;
      b.encerradaEm = null;
      return { ok: true, id: b.id };
    }
    if (msg.acao === "apagar") {
      delete todas[b.id];
      return { ok: true, id: b.id };
    }
    return { ok: false };
  }

  // Quem mais ganhou batalhas ETB, em todas as lives.
  function campeoesETB(batalhas) {
    const m = new Map();
    for (const b of Object.values(batalhas || {})) {
      if (b.situacao !== "encerrada" || !b.ganhador) continue;
      const c = m.get(b.ganhador) || { handle: b.ganhador, vitorias: 0, hits: [] };
      c.vitorias++;
      if (b.hit) c.hits.push(b.hit);
      m.set(b.ganhador, c);
    }
    return [...m.values()].sort((a, b) => b.vitorias - a.vitorias || a.handle.localeCompare(b.handle));
  }

  // ---------------------------------------------------------------------------
  // Sorteio da própria Jamble (giveaway). Ainda não vi um acontecer numa live,
  // então a leitura é defensiva: pega o que tiver cara de produto, de quantos
  // participam e de quem ganhou, e ignora o resto.
  // ---------------------------------------------------------------------------

  function sorteioJambleDoFrame(dados) {
    const d = dados?.data;
    const g = d?.giveaway;
    if (!g || typeof g !== "object" || !g.id) return null;
    const vencedor =
      g.winner_profile?.username || g.winner?.username || (typeof g.winner_username === "string" ? g.winner_username : null);
    return {
      id: String(g.id),
      titulo: d.giveaway_product?.title || g.title || null,
      status: g.status || null,
      acabou: g.is_over === true || g.status === "FINISHED",
      participantes: n(g.participant_count ?? g.entry_count ?? g.participants_count),
      vencedorId: typeof g.winner_id === "string" ? g.winner_id : null,
      vencedor: vencedor ? String(vencedor).replace(/^@/, "") : null,
      quando: ms(g.created_at) || Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Oferta feita pelo chat. Também não vi nenhuma com dado ainda (o campo
  // "offer" sempre veio vazio nas lives que acompanhei). Leitura defensiva:
  // valor, situação e quem ofereceu, quando houver.
  // ---------------------------------------------------------------------------

  function ofertaDoFrame(dados) {
    const o = dados?.data?.offer;
    if (!o || typeof o !== "object" || !o.id) return null;
    const perfil = o.buyer_profile || o.sender_profile || o.user_profile || o.profile || null;
    const valor = [o.price, o.amount, o.offer_price, o.value].map(Number).find((v) => Number.isFinite(v) && v > 0);
    return {
      id: String(o.id),
      handle: perfil?.username ? String(perfil.username).replace(/^@/, "") : null,
      quemId: typeof o.buyer_id === "string" ? o.buyer_id : typeof o.sender_id === "string" ? o.sender_id : null,
      valor: valor ?? null,
      situacao: o.status ? String(o.status).toLowerCase() : null,
      produto: dados.data.product?.title || o.product?.title || null,
      quando: ms(o.created_at) || Date.now(),
    };
  }

  function resumirOfertas(ofertas, perfis) {
    const lista = Object.values(ofertas || {})
      .map((o) => ({ ...o, handle: o.handle || nomeDe(o.quemId, perfis) }))
      .sort((a, b) => n(b.quando) - n(a.quando));
    const aceitas = lista.filter((o) => /accept|aceit|paid|pago|sold/.test(o.situacao || ""));
    return { lista, total: lista.length, aceitas: aceitas.length, valorAceito: aceitas.reduce((s, o) => s + n(o.valor), 0) };
  }

  const api = {
    leilaoDoFrame,
    mesclarLeilao,
    resumirLeiloes,
    quemDisputou,
    rankingDeCompras,
    resumirVendas,
    gemasPelaBatalha,
    juntarGemas,
    batalhaDoFrame,
    resumirBatalha,
    mensagensDoFrame,
    edicoesDoFrame,
    resumirChat,
    rankingDaResposta,
    regrasDoRanking,
    pontosDaLive,
    minhaPosicao,
    resumoDaLive,
    historicoComLives,
    clientes,
    sorteioJambleDoFrame,
    ofertaDoFrame,
    itensComCompradores,
    vagasDoItem,
    proximoNumeroETB,
    mudarBatalhaETB,
    batalhasPeloTitulo,
    campeoesETB,
    resumirOfertas,
  };
  if (raiz) Object.assign(raiz, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : undefined);
