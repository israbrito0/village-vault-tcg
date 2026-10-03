// Contas de gemas da live, num arquivo só, para o background, o painel e o
// teste usarem exatamente o mesmo código.
//
// A Jamble não manda "fulano acabou de enviar 500 gemas". O que ela dá é a
// foto do momento: quantas gemas cada pessoa somou até agora
// (/api/seller/show-participation ou /api/live/participation). Para ter o
// "ao vivo", comparamos a foto nova com a anterior -- quem subiu, enviou.

(function (raiz) {
  const GEMAS_POR_CARPA = 500; // "Carpa Zika" custa 500 gemas

  // Transforma a foto em { handle: gemas }.
  function porPessoa(linhas) {
    const m = {};
    for (const l of linhas ?? []) {
      if (!l || !l.handle) continue;
      m[l.handle] = Number(l.gemas) || 0;
    }
    return m;
  }

  // Compara duas fotos e devolve quem enviou gemas entre uma e outra.
  //
  // `anterior` null (ou vazio) significa que esta é a primeira foto desta
  // live: aí NÃO inventamos eventos. As gemas que já estavam lá foram
  // enviadas antes de estarmos olhando, e não sabemos quando -- contar isso
  // como "acabou de enviar" encheria o feed de mentira no primeiro segundo.
  function diffGemas(anterior, linhas, quando) {
    const agora = porPessoa(linhas);
    const eventos = [];
    const primeiraFoto = !anterior || Object.keys(anterior).length === 0;

    if (!primeiraFoto) {
      for (const l of linhas ?? []) {
        if (!l || !l.handle) continue;
        const antes = anterior[l.handle] ?? 0;
        const depois = Number(l.gemas) || 0;
        // Só subida conta. Se cair (estorno, recontagem da Jamble), ignoramos
        // o evento mas o total novo vale -- quem manda no número é a Jamble.
        if (depois > antes) {
          eventos.push({
            ts: quando,
            handle: l.handle,
            nome: l.nome || l.handle,
            gemas: depois - antes,
            total: depois,
          });
        }
      }
      eventos.sort((a, b) => b.gemas - a.gemas);
    }

    return { eventos, agora, primeiraFoto };
  }

  // Os números grandes do topo do painel.
  function resumirGemas(linhas) {
    const l = linhas ?? [];
    const gemas = l.reduce((s, x) => s + (Number(x.gemas) || 0), 0);
    return {
      gemas,
      carpas: Math.round(gemas / GEMAS_POR_CARPA),
      pontos: l.reduce((s, x) => s + (Number(x.pontos) || 0), 0),
      comprado: l.reduce((s, x) => s + (Number(x.gastou) || 0), 0),
      pessoas: l.length,
      enviaram: l.filter((x) => (Number(x.gemas) || 0) > 0).length,
    };
  }

  // Quantas gemas entraram nos últimos `ms` milissegundos.
  function gemasRecentes(eventos, ms, agora) {
    const corte = (agora ?? Date.now()) - ms;
    return (eventos ?? []).reduce((s, e) => (e.ts >= corte ? s + e.gemas : s), 0);
  }

  // ---------- emotions: quem mandou qual ícone ----------
  // Vem dos eventos LIKE do WebSocket, um por envio. Só cobre o tempo em que a
  // aba ficou aberta, então serve para o "ao vivo" e para o sorteio por ícone;
  // os totais da live inteira continuam saindo da participação.

  function resumirEmocoes(emocoes) {
    const porIcone = new Map();
    const porPessoa = new Map();
    let gemas = 0;

    for (const e of emocoes ?? []) {
      if (!e) continue;
      const g = Number(e.gemas) || 0;
      gemas += g;

      const i = porIcone.get(e.icone) ?? { icone: e.icone, qtd: 0, gemas: 0 };
      i.qtd++;
      i.gemas += g;
      porIcone.set(e.icone, i);

      if (!e.handle) continue;
      const p = porPessoa.get(e.handle) ?? { handle: e.handle, nome: e.nome || e.handle, qtd: 0, gemas: 0, icones: {} };
      p.qtd++;
      p.gemas += g;
      p.icones[e.icone] = (p.icones[e.icone] ?? 0) + 1;
      porPessoa.set(e.handle, p);
    }

    return {
      total: (emocoes ?? []).length,
      gemas,
      porIcone: [...porIcone.values()].sort((a, b) => b.gemas - a.gemas),
      porPessoa: [...porPessoa.values()].sort((a, b) => b.gemas - a.gemas),
    };
  }

  // Quem mandou um ícone específico, e quantas vezes. É o que o sorteio de
  // carpa usa: "só quem mandou carpa" vira exatamente esta lista.
  function quemMandou(emocoes, icone) {
    const m = new Map();
    for (const e of emocoes ?? []) {
      if (!e?.handle) continue;
      if (icone && e.icone !== icone) continue;
      const p = m.get(e.handle) ?? { handle: e.handle, nome: e.nome || e.handle, qtd: 0, gemas: 0 };
      p.qtd++;
      p.gemas += Number(e.gemas) || 0;
      m.set(e.handle, p);
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd);
  }

  // ---------- a lista de métricas da live ----------
  // Monta os pares "nome: valor" do quadro de métricas. Fica aqui, e não no
  // painel, porque é conta e precisa de teste: um campo faltando chegou a
  // derrubar a tela inteira (reais(undefined) estourava).
  //
  // Os números chegam de duas fontes que se completam, e nem sempre as duas
  // estão presentes:
  //   do WebSocket da live (qualquer live)  -> faturamento, vendas, audiência
  //   do painel do vendedor (só a sua live) -> espectadores únicos, funil
  // Por isso cada linha é opcional: o que não veio simplesmente não aparece.
  function listaDeMetricas(M, fmt) {
    if (!M) return [];
    const { num, reais, tempo, pct } = fmt;
    const temNum = (v) => Number.isFinite(Number(v));

    const minutos = M.minutos || (M.comecouEm ? Math.max(1, Math.round((Date.now() - M.comecouEm) / 60000)) : null);
    const ticket = M.ticketMedio || (M.vendas ? (M.faturamento || 0) / M.vendas : null);
    const porMin = M.porMinuto || (minutos ? (M.faturamento || 0) / minutos : null);
    const escoa = temNum(M.escoamento)
      ? M.escoamento
      : M.produtosTotal
        ? (M.produtosVendidos || 0) / M.produtosTotal
        : null;

    const linhas = [
      ["Assistindo agora", M.audienciaAgora, num],
      ["Ticket médio", ticket, reais],
      ["Gasto por comprador", M.gastoPorComprador, reais],
      ["Frete arrecadado", M.frete, reais],
      ["Faturamento por minuto", porMin, reais],
      ["Intervalo entre vendas", M.segundosEntreVendas, tempo],
      ["Duração da live", minutos, (v) => num(v) + " min"],
      ["Fizeram oferta", M.ofertaram, num],
      ["Compradores novos", M.compradoresNovos, num],
      ["Pico simultâneo", M.pico, num],
      ["Média simultânea", M.mediaSimultanea, num],
      ["Ficaram mais de 1 min", M.ficaramUmMinuto, num],
      ["Tempo médio assistido", M.segundosAssistidos, tempo],
      ["Público que voltou", M.voltaram, num],
      ["Sessões por pessoa", M.sessoesPorPessoa, (v) => Number(v).toFixed(1).replace(".", ",")],
      ["Produtos no catálogo", M.produtosTotal, num],
      ["Produtos à venda agora", M.produtosDisponiveis, num],
      ["Produtos mostrados", M.produtosMostrados, num],
      ["Produtos vendidos", M.produtosVendidos, num],
      ["Taxa de escoamento", escoa, pct],
      ["Mensagens no chat", M.mensagens, num],
      ["Pessoas no chat", M.pessoasNoChat, num],
      ["Seguidores novos", M.seguidoresNovos, num],
      ["Likes na live", M.likes, num],
      ["Compartilhamentos", M.compartilhamentos, num],
      ["Salvaram a live", M.salvos, num],
    ];

    // Sem o valor, a linha nem aparece. Zero também não: numa live que acabou
    // de começar, meia tela de zeros não diz nada.
    return linhas.filter(([, v]) => temNum(v) && Number(v) !== 0).map(([k, v, f]) => [k, f(v)]);
  }

  // ---------- planilha da live ----------
  // CSV com ponto e virgula e virgula decimal, que e o que o Excel em
  // portugues abre sem perguntar nada.
  function paraCSV(linhas) {
    const campo = (v) => {
      const t = String(v == null ? "" : v);
      // Ponto e virgula, aspas ou quebra de linha no meio do texto quebrariam
      // a planilha: nesses casos o campo vai entre aspas, com as aspas de
      // dentro dobradas, que e a regra do CSV.
      const precisa = t.indexOf(";") >= 0 || t.indexOf(String.fromCharCode(34)) >= 0 || t.indexOf(String.fromCharCode(10)) >= 0 || t.indexOf(String.fromCharCode(13)) >= 0;
      const aspas = String.fromCharCode(34);
      return precisa ? aspas + t.split(aspas).join(aspas + aspas) + aspas : t;
    };
    const fim = String.fromCharCode(13) + String.fromCharCode(10);
    return linhas.map((l) => l.map(campo).join(";")).join(fim);
  }

  const dataHora = (ts) => new Date(ts).toLocaleString("pt-BR");
  const virgula = (n) => String(Number(n) || 0).replace(".", ",");

  // Uma planilha por live, com tres partes: os envios um a um, o total por
  // pessoa e o ranking de participacao.
  function planilhaDaLive(live, nomes) {
    const nome = (ic) => (nomes && nomes[ic]) || ic;
    const out = [];
    out.push(["Live", live?.titulo || live?.id || ""]);
    out.push(["Gerado em", dataHora(Date.now())]);
    out.push([]);

    const em = live?.emocoes ?? [];
    if (em.length) {
      out.push(["ENVIOS, UM A UM"]);
      out.push(["Hora", "Pessoa", "@", "Icone", "Gemas"]);
      for (const e of em) out.push([dataHora(e.ts), e.nome, e.handle, nome(e.icone), e.gemas]);
      out.push([]);

      const porPessoa = resumirEmocoes(em).porPessoa;
      out.push(["TOTAL POR PESSOA (so o que passou com o painel aberto)"]);
      out.push(["Pessoa", "@", "Envios", "Gemas", "Icones"]);
      for (const p of porPessoa) {
        const detalhe = Object.entries(p.icones)
          .map(([ic, q]) => q + "x " + nome(ic))
          .join(", ");
        out.push([p.nome, p.handle, p.qtd, p.gemas, detalhe]);
      }
      out.push([]);
    }

    const linhasP = live?.linhas ?? [];
    if (linhasP.length) {
      out.push(["RANKING DE PARTICIPACAO (a live inteira, calculado pela Jamble)"]);
      out.push(["#", "Pessoa", "@", "Comprou", "Gemas", "Mensagens", "Pontos"]);
      linhasP.forEach((l, i) => out.push([i + 1, l.nome, l.handle, virgula(l.gastou), l.gemas, l.mensagens, l.pontos]));
      out.push([]);
    }

    const sort = live?.sorteios ?? [];
    if (sort.length) {
      out.push(["SORTEIOS"]);
      out.push(["Hora", "Ganhador", "Entre", "Criterio"]);
      for (const x of sort) out.push([dataHora(x.ts), x.ganhador, x.entre, x.fonte || ""]);
    }

    return paraCSV(out);
  }

  // Identificador da live a partir do endereço. Importa acertar porque cada
  // live tem a sua contagem: se duas lives caírem no mesmo id, uma apaga a
  // outra. A página da live é /live/<vendedor>/<id> -- o id é o SEGUNDO
  // pedaço, não o nome do vendedor.
  function idDaLive(caminho) {
    const p = String(caminho || "");
    const m =
      p.match(/^\/live\/[^/]+\/([\w-]+)/) ||
      p.match(/^\/seller\/dashboard\/lives\/([\w-]+)/) ||
      p.match(/^\/l\/([\w-]+)/);
    return m ? m[1] : null;
  }

  // A live é dela quando a página é o painel do vendedor. Serve para o painel
  // escolher qual live mostrar quando houver mais de uma aba aberta.
  function ehPainelDoVendedor(caminho) {
    return /^\/seller\/dashboard\/lives\//.test(String(caminho || ""));
  }

  // Páginas onde a extensão pode mexer nos botões da Jamble (atualizar, trocar
  // de aba). Em qualquer outra tela ela não encosta em nada.
  function ehPaginaDeLive(caminho) {
    return /^\/(live|seller\/dashboard\/lives)\//.test(String(caminho || ""));
  }

  // Endereços de imagem que vêm nos dados da Jamble: a figurinha de cada
  // emotion (https://jamble-test.b-cdn.net/like_icons/<icone>.png) e a foto de
  // perfil (https://jamble.b-cdn.net/profiles/user_id=<id>/profile_images/...).
  // Como entram numa <img> do painel, só passa https da própria Jamble ou do
  // CDN dela, sem aspas, espaço ou nada que possa sair do atributo.
  function urlDeImagem(url) {
    const u = String(url ?? "");
    return /^https:\/\/[\w.-]+\.(b-cdn\.net|jamble\.com)\/[\w./%=-]+$/.test(u) ? u : null;
  }

  // Tira acento e caixa: "BATALHA Nº 1" e "batalha no 1" viram a mesma coisa.
  const normalizar = (texto) =>
    String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // Produto que é vaga de batalha (a da loja, não a da Jamble): tem "batalha"
  // no nome. Cada vendedor escreve de um jeito -- visto em lives reais:
  // "Batalha 30 anos EUA", "DUPLO 30y - BATALHA DO MAL", "1 - INGRESSO -
  // BOOSTER BATALHA", "Batalha 1 ETB".
  function ehVagaDeBatalha(titulo) {
    return /\b(batalha|battle)\b/.test(normalizar(titulo));
  }

  // Quantas vagas cada unidade comprada vale: "50 - INGRESSOS BATALHA" são 50,
  // "1 - INGRESSO - BOOSTER BATALHA" é 1. Sem número de ingressos no nome, 1.
  function ingressosPorUnidade(titulo) {
    const m = normalizar(titulo).match(/^\D{0,4}(\d{1,3})\s*[-–x×]?\s*ingressos?\b/);
    return m ? Math.max(1, Number(m[1])) : 1;
  }

  // O número da batalha, quando o nome diz: "Batalha 1 ETB", "BATALHA 2 -
  // ETB", "Batalha ETB #3", "Batalha nº 4 ETB", "Batalha #5". Sem isso
  // ("Batalha 30 anos EUA" -- 30 é dos anos, não da batalha), null: as vagas
  // enchem as batalhas em ordem.
  function numeroDaBatalhaETB(titulo) {
    const t = normalizar(titulo);
    if (!/\bbatalha\b/.test(t)) return null;
    const hash = t.match(/#\s*(\d{1,3})\b/);
    if (hash) return Number(hash[1]) || null;
    if (!/\betb\b/.test(t)) return null;
    const m = t.match(/\bbatalha\s*(?:n[o°º]?\.?\s*)?(\d{1,3})\b/) || t.match(/\betb\s*(?:n[o°º]?\.?\s*)?(\d{1,3})\b/);
    const numero = m ? Number(m[1]) : 0;
    return numero > 0 ? numero : null;
  }

  // O "plim" de quando alguém compra, feito na hora (sem arquivo de som).
  // Venda: duas notas subindo. Vaga de batalha: três.
  function tocarSom(contexto, tipo) {
    if (!contexto) return;
    const notas = tipo === "batalha" ? [784, 988, 1319] : [988, 1319];
    notas.forEach((freq, i) => {
      const osc = contexto.createOscillator();
      const vol = contexto.createGain();
      const t0 = contexto.currentTime + i * 0.13;
      osc.type = "triangle";
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, t0);
      vol.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
      osc.connect(vol);
      vol.connect(contexto.destination);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    });
  }

  const api = {
    GEMAS_POR_CARPA,
    urlDeImagem,
    numeroDaBatalhaETB,
    ehVagaDeBatalha,
    ingressosPorUnidade,
    tocarSom,
    porPessoa,
    diffGemas,
    resumirGemas,
    gemasRecentes,
    resumirEmocoes,
    quemMandou,
    listaDeMetricas,
    planilhaDaLive,
    paraCSV,
    idDaLive,
    ehPainelDoVendedor,
    ehPaginaDeLive,
  };
  if (raiz) Object.assign(raiz, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : undefined);
