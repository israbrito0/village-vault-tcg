// Teste das contas de leilão, batalha, chat, ranking mensal e clientes:
//   node extensao-ranking/teste-analises.js
//
// Os frames abaixo são de uma live de verdade (@pokerusbr, 03/10/2026), só
// sem foto, descrição e texto de mensagem.
const {
  leilaoDoFrame,
  mesclarLeilao,
  resumirLeiloes,
  quemDisputou,
  batalhaDoFrame,
  resumirBatalha,
  mensagensDoFrame,
  resumirChat,
  rankingDaResposta,
  minhaPosicao,
  regrasDoRanking,
  pontosDaLive,
  resumoDaLive,
  historicoComLives,
  clientes,
  sorteioJambleDoFrame,
  ofertaDoFrame,
  resumirOfertas,
} = require("./analises.js");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- frames reais ----------

const VBPRACIMA = "KFjLHNJ7wAePZ4bPcchq43IiSUh1";
const SAMANTA = "QGKbJ2ibvfSBQKM40pffxDUhKf12";

// Leilão de 15 unidades começando em R$ 5, no meio da disputa.
const leilaoRolando = {
  data: {
    sale: {
      id: "VyNc5TTB4S9JDJKlllcU",
      created_at: 1791048870.092078,
      product_id: "pGwSCbznaE2GIUUcAQse",
      status: "STARTED",
      is_sold: false,
      is_over: false,
      settings: { type: "AUCTION", duration_in_secs: 15, starting_price: 5 },
      ending_at: 1791048934.796,
      is_canceled: false,
      sold_count: 0,
      available_count: 15,
      price: 5,
    },
    sale_best_entry: {
      price: 550,
      buyer_id: VBPRACIMA,
      sale_id: "VyNc5TTB4S9JDJKlllcU",
      buyer_profile: { id: VBPRACIMA, username: "vbpracima", display_name: "vbpracima" },
    },
    sale_entry_count: 49,
    sale_next_bid_price: 600,
    sale_product: { id: "pGwSCbznaE2GIUUcAQse", title: "30 anos a R$ 5,00 💵" },
  },
};

// O mesmo leilão encerrado, como a Jamble reenvia depois.
const leilaoEncerrado = {
  data: {
    sale: {
      id: "VyNc5TTB4S9JDJKlllcU",
      created_at: 1791048870.092078,
      product_id: "pGwSCbznaE2GIUUcAQse",
      sold_product_id: "TlFBmBRj2s4oPG6DM6Mh",
      status: "FINISHED",
      is_sold: true,
      sold_order: 14,
      is_over: true,
      settings: { type: "AUCTION", duration_in_secs: 15, starting_price: 5, currency: "BRL", target: "ALL" },
      ending_at: 1791048965.784,
      ended_at: 1791048966.176553,
      is_paid: true,
      is_canceled: false,
      buyer_id: VBPRACIMA,
      sold_count: 1,
      sold_price: 750,
      total_sold_price: 750,
      available_count: 15,
      price: 5,
    },
  },
};

// Lista de quem deu lance: chega num frame sem o leilão, vale para o atual.
const disputaram = {
  data: {
    sale_entry_user_ids: [VBPRACIMA, "JjzgbauOA3cKq28jJ5gGEPcXhO33", "vzcOuzPmYTQckcoA1lI0tYVTACG3", SAMANTA],
    sale_entry_count: 51,
  },
};

// Compra direta: preço fixo, 9 unidades, 3 já saíram. Sem lance nem comprador.
const compraDireta = (vendidas, restam, status = "STARTED") => ({
  data: {
    sale: {
      id: "FOkQblciJnlebfPGJsdi",
      created_at: 1791049297.084186,
      status,
      is_sold: status === "FINISHED",
      is_over: status === "FINISHED",
      settings: { type: "BUY_IT_NOW", duration_in_secs: 60, starting_price: 149 },
      is_canceled: false,
      sold_count: vendidas,
      available_count: restam,
      price: 149,
    },
    sale_best_entry: null,
    sale_entry_count: null,
    sale_entry_user_ids: null,
    sale_product: { id: "IVbRgYSskFvw3AyW4eLx", title: "Batalha 30 anos EUA" },
  },
});

const batalhaReal = {
  data: {
    battle: {
      id: "C1DwmXW5o5u6PkeWFj0M",
      show_id: "SwdWTbncIqpktVHipW81",
      is_over: false,
      status: "started",
      ending_at: 1791065426.701752,
      red_team_participant_count: 7,
      red_team_participant_total_entry_count: 19000,
      red_team_participant_top_user_ids: [VBPRACIMA, "JjzgbauOA3cKq28jJ5gGEPcXhO33", "vzcOuzPmYTQckcoA1lI0tYVTACG3"],
      red_team_participant_user_ids: [VBPRACIMA, "JjzgbauOA3cKq28jJ5gGEPcXhO33"],
      blue_team_participant_count: 4,
      blue_team_participant_total_entry_count: 14235,
      blue_team_participant_top_user_ids: ["uPGHBrthPeXB905m67rPUwsPp7l1", "8haEglthKEVhNMT3MpQkXWfsPct1", SAMANTA],
      blue_team_participant_user_ids: ["uPGHBrthPeXB905m67rPUwsPp7l1"],
      tier: "tier_4",
      currency: "BRL",
    },
  },
};

const GRUPO = "pPHuioR03kvou7qKTyYE";
const mensagem = (id, quem, nome, ts, grupo = GRUPO) => ({
  id,
  created_at: ts,
  group_message_id: grupo,
  message_type: "STANDARD",
  sender_id: quem,
  sender_profile: { id: quem, username: nome, display_name: nome + ".x" },
});

// ---------- leilão ----------

const p1 = leilaoDoFrame(leilaoRolando);
conferir(p1.id === "VyNc5TTB4S9JDJKlllcU", "leilão: o id sai do frame");
conferir(p1.titulo === "30 anos a R$ 5,00 💵", "leilão: o nome do item");
conferir(p1.tipo === "AUCTION" && p1.inicial === 5 && p1.restam === 15, "leilão: tipo, inicial e unidades");
conferir(p1.melhor === 550 && p1.vencedor === "vbpracima" && p1.lances === 49, "leilão: lance da frente, quem e quantos lances");
conferir(p1.inicio === 1791048870092, "leilão: hora em milissegundos");

conferir(leilaoDoFrame(disputaram) === null, "lista de lances sem leilão conhecido não vira leilão inventado");
const p2 = leilaoDoFrame(disputaram, "VyNc5TTB4S9JDJKlllcU");
conferir(p2?.id === "VyNc5TTB4S9JDJKlllcU" && p2.disputantes.length === 4, "lista de lances vale para o leilão atual");

// Um lance de outro leilão não pode grudar neste.
const outro = leilaoDoFrame({ data: { sale: leilaoRolando.data.sale, sale_best_entry: { ...leilaoRolando.data.sale_best_entry, sale_id: "OUTRO" } } });
conferir(outro.melhor === undefined, "lance de outro leilão é ignorado");

let l = mesclarLeilao(null, p1);
l = mesclarLeilao(l, p2);
l = mesclarLeilao(l, leilaoDoFrame(leilaoEncerrado));
conferir(l.status === "FINISHED" && l.vendido === true, "encerrado e vendido");
conferir(l.vendidoPor === 750 && l.vencedorId === VBPRACIMA, "vendido por R$ 750 para vbpracima");
conferir(l.titulo === "30 anos a R$ 5,00 💵", "o nome do item fica, mesmo o frame final não trazendo");
conferir(l.lances === 51, "lances: fica o maior", String(l.lances));

// Frame velho chegando depois do fim não reabre o leilão nem troca o vencedor.
const velho = leilaoDoFrame({ data: { ...leilaoRolando.data, sale_best_entry: { price: 300, buyer_id: SAMANTA, sale_id: "VyNc5TTB4S9JDJKlllcU" }, sale_entry_count: 20 } });
const depois = mesclarLeilao(l, velho);
conferir(depois.status === "FINISHED" && depois.vendido === true, "frame atrasado não reabre leilão encerrado");
conferir(depois.vencedorId === VBPRACIMA && depois.melhor === 550, "frame atrasado não troca o vencedor nem baixa o lance");
conferir(depois.lances === 51, "frame atrasado não baixa a contagem de lances");

// Compra direta.
let cd = mesclarLeilao(null, leilaoDoFrame(compraDireta(0, 9)));
cd = mesclarLeilao(cd, leilaoDoFrame(compraDireta(3, 6)));
const leiloes = { [l.id]: l, [cd.id]: cd };
let r = resumirLeiloes(leiloes, {});
const linhaCd = r.lista.find((x) => x.id === cd.id);
conferir(linhaCd.tipo === "compra direta" && linhaCd.situacao === "rolando", "compra direta aberta aparece rolando");
conferir(linhaCd.vendidas === 3 && linhaCd.restam === 6 && linhaCd.total === 447, "compra direta: 3 x R$ 149 = R$ 447", JSON.stringify(linhaCd));
conferir(linhaCd.vencedor === null && linhaCd.multiplicador === null, "compra direta não inventa comprador nem multiplicador");
const linhaL = r.lista.find((x) => x.id === l.id);
conferir(linhaL.situacao === "vendido" && linhaL.final === 750 && linhaL.total === 750, "leilão vendido por R$ 750");
conferir(Math.abs(linhaL.multiplicador - 150) < 1e-9, "leilão: 750 ÷ 5 = 150 vezes o inicial");
conferir(linhaL.vencedor === "vbpracima", "vencedor pelo @ que veio no lance");
conferir(r.faturado === 1197, "faturado soma leilão + unidades já vendidas da compra direta", String(r.faturado));
conferir(r.unidades === 4, "unidades vendidas: 1 do leilão + 3 da compra direta", String(r.unidades));
conferir(r.rolando?.id === cd.id, "o que está rolando agora é a compra direta");
conferir(r.lista[0].id === cd.id, "o mais recente vem primeiro");

// Começou uma venda mais nova e o fim destas duas nunca chegou (a aba fechou):
// nenhuma das velhas pode aparecer como "rolando agora".
{
  const novo = mesclarLeilao(null, { id: "novo", status: "STARTED", tipo: "AUCTION", inicial: 10, inicio: cd.inicio + 60000, titulo: "Próximo" });
  const leilaoSemFim = mesclarLeilao(null, { ...p1, id: "semfim", inicio: cd.inicio - 1000 });
  const rr = resumirLeiloes({ [cd.id]: cd, semfim: leilaoSemFim, novo }, {});
  conferir(rr.rolando?.id === "novo", "só a venda mais nova está rolando", rr.rolando?.id);
  conferir(rr.lista.find((x) => x.id === cd.id).situacao === "vendido", "compra direta antiga com unidades saídas conta como vendida");
  conferir(rr.lista.find((x) => x.id === "semfim").situacao === "fim não visto", "leilão antigo sem fim registrado não vira venda nem rolando");
  conferir(rr.faturado === 447, "e o faturado só conta o que se sabe que vendeu", String(rr.faturado));
}

cd = mesclarLeilao(cd, leilaoDoFrame(compraDireta(9, 0, "FINISHED")));
r = resumirLeiloes({ [cd.id]: cd }, {});
conferir(r.lista[0].situacao === "vendido" && r.lista[0].total === 1341, "compra direta esgotada: 9 x R$ 149");

// Leilão que acabou sem lance.
const semLance = mesclarLeilao(null, { id: "x", status: "FINISHED", vendido: false, tipo: "AUCTION", inicial: 10 });
conferir(resumirLeiloes({ x: semLance }, {}).lista[0].situacao === "sem venda", "leilão sem lance: sem venda");
const cancelado = mesclarLeilao(null, { id: "c", status: "FINISHED", cancelado: true, tipo: "AUCTION", melhor: 90 });
const rc = resumirLeiloes({ c: cancelado }, {});
conferir(rc.lista[0].situacao === "cancelado" && rc.faturado === 0, "cancelado não entra no faturado");
conferir(igual(resumirLeiloes(undefined, undefined).lista, []), "sem leilão nenhum: lista vazia, sem erro");

// ---------- quem disputou e perdeu ----------

const perfis = { [VBPRACIMA]: "vbpracima", [SAMANTA]: "samantaavila" };
const d = quemDisputou(leiloes, perfis);
conferir(d.length === 4, "4 pessoas disputaram o leilão encerrado", String(d.length));
const vb = d.find((x) => x.id === VBPRACIMA);
conferir(vb.ganhou === 1 && vb.perdeu === 0, "vbpracima levou");
const sa = d.find((x) => x.id === SAMANTA);
conferir(sa.handle === "samantaavila" && sa.perdeu === 1 && igual(sa.perdidos, ["30 anos a R$ 5,00 💵"]), "samantaavila disputou e perdeu o item");
conferir(d.filter((x) => !x.handle).length === 2, "quem ainda não tem @ conhecido fica sem nome, não com nome chutado");
conferir(d[0].perdeu >= d[d.length - 1].perdeu, "quem mais perdeu vem primeiro");
conferir(quemDisputou({ [cd.id]: cd }, perfis).length === 0, "compra direta não tem disputa");
const rolandoAinda = mesclarLeilao(null, { ...p1, disputantes: [SAMANTA] });
conferir(quemDisputou({ a: rolandoAinda }, perfis).length === 0, "leilão rolando ainda não tem perdedor");

// ---------- batalha ----------

const b = batalhaDoFrame(batalhaReal);
conferir(b.vermelho.pontos === 19000 && b.vermelho.pessoas === 7, "batalha: vermelho 7 pessoas, 19.000 pontos");
conferir(b.azul.pontos === 14235 && b.azul.pessoas === 4, "batalha: azul 4 pessoas, 14.235 pontos");
conferir(b.termina === 1791065426702 && b.tier === "tier_4", "batalha: termina e nível");
const rb = resumirBatalha(b, perfis);
conferir(rb.lider === "vermelho" && rb.diferenca === 4765, "vermelho na frente por 4.765");
conferir(igual(rb.vermelho.topNomes, ["vbpracima", null, null]), "top do vermelho com @ quando conhecido");
conferir(igual(rb.azul.topNomes, [null, null, "samantaavila"]), "top do azul com @ quando conhecido");
conferir(batalhaDoFrame({ data: { battle: null } }) === null, "sem batalha: nada");
conferir(resumirBatalha(null) === null, "resumir sem batalha não quebra");
const empate = resumirBatalha({ vermelho: { pessoas: 1, pontos: 10, top: [] }, azul: { pessoas: 1, pontos: 10, top: [] } }, {});
conferir(empate.lider === "empate" && empate.diferenca === 0, "empate");

// ---------- chat ----------

const frameChat = {
  grupoDaLive: GRUPO,
  data: {
    messages: [
      mensagem("m1", SAMANTA, "samantaavila", 1791049977.77515),
      mensagem("m2", VBPRACIMA, "vbpracima", 1791049980),
      mensagem("m3", SAMANTA, "samantaavila", 1791049990),
      // Conversa privada aberta durante a live: outro grupo, não conta.
      mensagem("p1", SAMANTA, "samantaavila", 1791049995, "CONVERSA_PRIVADA"),
    ],
  },
};
const msgs = mensagensDoFrame(frameChat);
conferir(msgs.length === 3, "só as mensagens do grupo da live", String(msgs.length));
conferir(msgs[0].handle === "samantaavila" && msgs[0].nome === "samantaavila.x" && msgs[0].tipo === "STANDARD", "quem mandou, nome e tipo");
conferir(msgs[0].ts === 1791049977775, "hora da mensagem em milissegundos");
conferir(!("content" in msgs[0]) && !("texto" in msgs[0]), "o texto da mensagem não é guardado");
conferir(mensagensDoFrame({ data: frameChat.data }).length === 0, "sem saber o grupo da live, não conta nada");

const agora = 1791050000000;
const chat = {
  total: 5,
  porPessoa: { samantaavila: { nome: "samanta", n: 3 }, vbpracima: { nome: "vb", n: 2 } },
  porTipo: { STANDARD: 4, OFFER: 1 },
  ts: [agora - 60000, agora - 120000, agora - 200000, agora - 10 * 60000, agora - 20 * 60000],
};
const rch = resumirChat(chat, agora);
conferir(rch.total === 5 && Math.abs(rch.porMinuto - 0.6) < 1e-9, "3 mensagens nos últimos 5 minutos = 0,6 por minuto");
conferir(rch.top[0].handle === "samantaavila" && rch.top[0].mensagens === 3, "quem mais fala vem primeiro");
conferir(rch.porTipo.OFFER === 1, "tipo diferente de mensagem aparece separado");
conferir(resumirChat(undefined).total === 0, "sem chat: zero, sem erro");

// ---------- ranking mensal ----------

const respostaRanking = {
  success: true,
  title: "Ranking Mensal de Vendedores",
  participants: [
    { id: "a", sellerId: "s1", rank: 2, points: 410000, username: "segundo", avatarUrl: "x" },
    { id: "b", sellerId: "s2", rank: 1, points: 900000, username: "primeiro", avatarUrl: "x" },
    { id: "c", sellerId: "s3", rank: 6, points: 294409, username: "israelbrito", avatarUrl: "x" },
    { id: "d", sellerId: "s4", rank: 5, points: 300000, username: "quinto", avatarUrl: "x" },
    ...Array.from({ length: 16 }, (_, i) => ({ rank: 7 + i, points: 290000 - i * 1000, username: "v" + (7 + i) })),
  ],
};
const rk = rankingDaResposta(respostaRanking);
conferir(rk[0].posicao === 1 && rk[0].handle === "primeiro", "ranking em ordem de posição");
conferir(!("avatarUrl" in rk[0]) && !("sellerId" in rk[0]), "do ranking só fica posição, pontos e @");
const pos = minhaPosicao(rk, "israelbrito");
conferir(pos.eu.posicao === 6 && pos.acima.handle === "quinto", "você em #6, logo atrás de @quinto");
conferir(pos.faltaParaSubir === 5592, "faltam 5.592 pontos para passar o #5", String(pos.faltaParaSubir));
conferir(pos.corteTop20?.handle === "v20" && pos.folgaNoTop20 === 294409 - 277000, "folga sobre o 20º lugar");
conferir(minhaPosicao(rk, "ninguem").eu === null, "quem não está na lista: sem posição");
conferir(minhaPosicao([], "x") === null && rankingDaResposta({}) === null, "sem ranking: nada, sem erro");

// A resposta de verdade (03/10/2026, aberta na live do @pokerusbr): o top 20,
// o dono da live à parte, e as regras de pontos.
const top20 = [
  ["formulaminis", 2716423], ["steincards", 687618], ["pokenight", 642713], ["drpokecards", 401057],
  ["cheeloutshop", 371468], ["pokeemoney", 362967], ["israelbrito", 294409], ["wannashine_tcg", 291607],
  ["dittostore", 288913], ["pppmybaby", 278785], ["gtonlineminis", 259272], ["zerominis", 233118],
  ["olivapacks", 227366], ["octosplaybr", 191692], ["dgcardsetcg", 162610], ["rafaelgcavalini", 162198],
  ["theopudim", 154810], ["alvestcg", 141096], ["vozaogames", 138811], ["zecleto", 127344],
].map(([username, points], i) => ({ id: "x" + i, sellerId: "x" + i, rank: i + 1, points, username, avatarUrl: "https://x", isRewarded: false }));
const respostaReal = {
  success: true,
  title: "Ranking Mensal de Vendedores",
  rules: [
    { rule: "+3 pontos para cada R$1 gasto", icon: "shop", entryPoints: 3 },
    { rule: "+2 pontos para cada gema enviada", icon: "gem", entryPoints: 2 },
    { rule: "Top 20: R$ 200 por indicação no mês seguinte", icon: "shop", entryPoints: null },
  ],
  participants: top20,
  seller: { id: "RGUO", sellerId: "RGUO", rank: 125, points: 18320, username: "pokerusbr", avatarUrl: "https://x" },
  hasNextPage: true,
};
const real = rankingDaResposta(respostaReal);
conferir(real.length === 21 && real[20].handle === "pokerusbr" && real[20].posicao === 125, "o dono da live entra na lista, mesmo em #125");
const ela = minhaPosicao(real, "israelbrito");
conferir(ela.eu.posicao === 7 && ela.acima.handle === "pokeemoney" && ela.faltaParaSubir === 68559, "ela em #7: faltam 68.559 para passar @pokeemoney", String(ela.faltaParaSubir));
conferir(ela.folgaNoTop20 === 294409 - 127344 && ela.faltaParaTop20 === null, "folga sobre o 20º (@zecleto)");
const dono = minhaPosicao(real, "pokerusbr");
conferir(dono.acima === null && dono.faltaParaSubir === null, "em #125 o #124 não veio: não inventa quanto falta para ele");
conferir(dono.faltaParaTop20 === 127344 - 18320 + 1, "mas diz quanto falta para o top 20", String(dono.faltaParaTop20));
const dup = rankingDaResposta({ participants: top20, seller: { rank: 7, points: 294409, username: "israelbrito" } });
conferir(dup.length === 20, "na própria live (já no top 20), ela não aparece duas vezes");

const regras = regrasDoRanking(respostaReal);
conferir(regras.porReal === 3 && regras.porGema === 2, "regras lidas da resposta: 3 por real, 2 por gema", JSON.stringify(regras));
conferir(regrasDoRanking({}) === null && regrasDoRanking({ rules: [{ icon: "shop", entryPoints: null }] }) === null, "sem regra numérica: nada");
// A regra de prêmio vindo antes da de pontos não pode virar "0 por real".
const invertida = regrasDoRanking({ rules: [respostaReal.rules[2], respostaReal.rules[0], respostaReal.rules[1]] });
conferir(invertida.porReal === 3, "regra de prêmio antes da de pontos não zera o ponto por real", JSON.stringify(invertida));
// A live de 02/10: R$ 26.827 e 57.770 gemas.
conferir(pontosDaLive(regras, 26827, 57770) === 26827 * 3 + 57770 * 2, "live de R$ 26.827 e 57.770 gemas rende 196.021 pontos", String(pontosDaLive(regras, 26827, 57770)));
conferir(pontosDaLive(null, 100, 100) === null, "sem regras, não chuta pontos");

// ---------- histórico de clientes ----------

// Live dela: a participação traz os números da Jamble.
const liveDela = {
  id: "L1",
  titulo: "Live 1",
  quando: 1000,
  doPainel: true,
  linhas: [
    { handle: "ana", gemas: 3000, gastou: 250, mensagens: 12 },
    { handle: "bia", gemas: 0, gastou: 80, mensagens: 2 },
    { handle: "israelbrito", gemas: 500, gastou: 0, mensagens: 30 },
  ],
  emocoes: [
    { id: "e1", handle: "ana", gemas: 500 },
    { id: "e2", handle: "ana", gemas: 500 },
  ],
};
const r1 = resumoDaLive(liveDela, {});
conferir(r1.pessoas.ana.gemas === 3000 && r1.pessoas.ana.gastou === 250, "live dela: gemas e compras da participação");
conferir(r1.pessoas.ana.envios === 2, "live dela: envios contados pelas emotions, sem somar gema em dobro");
conferir(r1.dela === true && r1.titulo === "Live 1", "live dela marcada");

// Live de outro vendedor: sem participação, sai das emotions, do chat e dos leilões.
const liveOutro = {
  id: "L2",
  titulo: "Live do pokerus",
  vendedor: "pokerusbr",
  quando: 2000,
  linhas: [],
  emocoes: [
    { id: "e3", handle: "ana", gemas: 500 },
    { id: "e4", handle: "carla", gemas: 100 },
  ],
  chat: { porPessoa: { carla: { n: 4 }, duda: { n: 7 } } },
  leiloes: { [l.id]: l, [cd.id]: cd },
};
const r2 = resumoDaLive(liveOutro, perfis);
conferir(r2.pessoas.ana.gemas === 500 && r2.pessoas.carla.gemas === 100, "live de outro: gemas pelas emotions");
conferir(r2.pessoas.vbpracima.ganhou === 1 && r2.pessoas.vbpracima.gastou === 750, "live de outro: quem ganhou leilão e quanto");
conferir(r2.pessoas.samantaavila.disputou === 1 && r2.pessoas.samantaavila.ganhou === 0, "live de outro: quem disputou");
conferir(r2.pessoas.duda.mensagens === 7, "live de outro: mensagens do chat");
conferir(r2.vendedor === "pokerusbr" && r2.dela === false, "de quem é a live");
conferir(igual(resumoDaLive(liveOutro, perfis), r2), "refazer o resumo dá o mesmo número (não soma em cima)");

const liveDela2 = { id: "L3", titulo: "Live 3", quando: 3000, vendedor: "israelbrito", linhas: [{ handle: "bia", gemas: 100, gastou: 20 }] };
const liveDela3 = { id: "L4", titulo: "Live 4", quando: 4000, doPainel: true, linhas: [{ handle: "bia", gemas: 0, gastou: 10 }, { handle: "eva", gastou: 5 }] };
// Uma live dela mais antiga, para a ana ter vindo duas vezes ("de casa").
const liveDela0 = { id: "L0", titulo: "Live 0", quando: 500, doPainel: true, linhas: [{ handle: "ana", gemas: 0, gastou: 30 }] };
const historico = {
  L0: resumoDaLive(liveDela0, {}),
  L1: r1,
  L2: r2,
  L3: resumoDaLive(liveDela2, {}),
  L4: resumoDaLive(liveDela3, {}),
};
const cl = clientes(historico, "israelbrito");
const ana = cl.find((c) => c.handle === "ana");
conferir(ana.lives === 3 && ana.livesDela === 2, "ana: 3 lives, 2 delas");
conferir(ana.gemas === 3500 && ana.gastou === 280, "ana: somando as lives");
conferir(ana.perfil === "compra e manda gema", "ana: compra e manda gema");
conferir(ana.sumiu === true, "ana não apareceu nas duas últimas lives dela: sumiu");
conferir(cl.find((c) => c.handle === "bia").sumiu === false, "bia veio nas últimas: não sumiu");
conferir(cl.find((c) => c.handle === "bia").livesDela === 3, "live com vendedor = ela conta como live dela");
conferir(cl.find((c) => c.handle === "carla").perfil === "só manda gema", "carla: só manda gema");
conferir(cl.find((c) => c.handle === "duda").perfil === "só conversa", "duda: só conversa");
conferir(cl.find((c) => c.handle === "samantaavila").perfil === "disputa e não leva", "samantaavila: disputa e não leva");
conferir(!cl.some((c) => c.handle === "israelbrito"), "ela mesma não aparece como cliente");
conferir(cl[0].handle === "vbpracima" || cl[0].gastou >= cl[1].gastou, "quem mais gastou vem primeiro");
conferir(igual(clientes({}, "x"), []) && igual(clientes(undefined), []), "sem histórico: lista vazia");
// A tela junta o histórico guardado com a live ainda aberta, na hora.
const fresco = historicoComLives({ L1: r1 }, { L2: liveOutro, VAZIA: { id: "VAZIA" } }, perfis);
conferir(Object.keys(fresco).sort().join() === "L1,L2", "histórico + live aberta; live sem ninguém não entra", Object.keys(fresco).join());
conferir(fresco.L2.pessoas.vbpracima.gastou === 750, "a live aberta entra com o número de agora");
// Com poucas lives dela, ninguém é marcado como sumido.
conferir(!clientes({ L1: r1, L2: r2 }, "israelbrito").some((c) => c.sumiu), "com menos de 3 lives dela, ninguém sumiu");

// ---------- sorteio da Jamble e ofertas (defensivo: ainda não vistos com dado) ----------

conferir(sorteioJambleDoFrame({ data: { giveaway: null, giveaway_product: null } }) === null, "sorteio vazio (como vem hoje): nada");
const sj = sorteioJambleDoFrame({
  data: { giveaway: { id: "g1", status: "FINISHED", participant_count: 42, winner_profile: { username: "@ana" }, created_at: 1791049000 }, giveaway_product: { title: "Booster" } },
});
conferir(sj.titulo === "Booster" && sj.participantes === 42 && sj.vencedor === "ana" && sj.acabou, "sorteio com dado: prêmio, participantes e ganhador");

conferir(ofertaDoFrame({ data: { offer: null } }) === null, "oferta vazia (como vem hoje): nada");
const of = ofertaDoFrame({ data: { offer: { id: "o1", price: 120, status: "ACCEPTED", buyer_id: SAMANTA, created_at: 1791049000 }, product: { title: "ETB" } } });
conferir(of.valor === 120 && of.situacao === "accepted" && of.produto === "ETB", "oferta com dado: valor, situação, produto");
const ro = resumirOfertas({ o1: of, o2: { id: "o2", valor: 50, situacao: "rejected", quando: 1 } }, perfis);
conferir(ro.total === 2 && ro.aceitas === 1 && ro.valorAceito === 120, "ofertas: total e aceitas");
conferir(ro.lista[0].handle === "samantaavila", "oferta: @ pelo dicionário quando não veio no frame");

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
