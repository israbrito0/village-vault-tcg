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

  const api = {
    GEMAS_POR_CARPA,
    porPessoa,
    diffGemas,
    resumirGemas,
    gemasRecentes,
    idDaLive,
    ehPainelDoVendedor,
  };
  if (raiz) Object.assign(raiz, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : undefined);
