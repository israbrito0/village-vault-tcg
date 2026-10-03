// Teste das contas de gemas: rode com `node extensao-ranking/teste-gemas.js`.
// O "ao vivo" do painel sai da comparação entre uma leitura da Jamble e a
// seguinte, então é aqui que um erro apareceria como gema inventada ou perdida.
const {
  diffGemas,
  resumirGemas,
  gemasRecentes,
  resumirEmocoes,
  quemMandou,
  listaDeMetricas,
  idDaLive,
  ehPainelDoVendedor,
  GEMAS_POR_CARPA,
} = require("./gemas.js");

let falhas = 0;
function conferir(ok, nome, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " -> " + detalhe : ""}`);
}

const linha = (handle, gemas, extra = {}) => ({
  handle,
  nome: handle,
  gemas,
  pontos: extra.pontos ?? 0,
  gastou: extra.gastou ?? 0,
  mensagens: extra.mensagens ?? 0,
});

// ---------- a primeira leitura é só ponto de partida ----------

const t0 = 1_700_000_000_000;
const primeira = diffGemas(null, [linha("jako", 24680), linha("bruno", 17280)], t0);
conferir(primeira.eventos.length === 0, "primeira leitura não inventa envio", `${primeira.eventos.length} eventos`);
conferir(primeira.primeiraFoto === true, "primeira leitura se marca como ponto de partida");
conferir(primeira.agora.jako === 24680, "guarda o total de cada pessoa");

// ---------- a segunda leitura vira o feed ----------

const segunda = diffGemas(primeira.agora, [linha("jako", 25180), linha("bruno", 17280)], t0 + 30000);
conferir(segunda.eventos.length === 1, "só quem subiu vira evento", JSON.stringify(segunda.eventos));
conferir(segunda.eventos[0].handle === "jako" && segunda.eventos[0].gemas === 500, "a diferença é o que foi enviado");
conferir(segunda.eventos[0].total === 25180, "o evento também carrega o total novo");

// ---------- gente que chega no meio da live ----------

const terceira = diffGemas(segunda.agora, [linha("jako", 25180), linha("bruno", 17280), linha("nova", 60)], t0 + 60000);
conferir(
  terceira.eventos.length === 1 && terceira.eventos[0].handle === "nova" && terceira.eventos[0].gemas === 60,
  "quem aparece pela primeira vez conta do zero",
  JSON.stringify(terceira.eventos),
);

// ---------- nada mudou ----------

const quarta = diffGemas(terceira.agora, [linha("jako", 25180), linha("bruno", 17280), linha("nova", 60)], t0 + 90000);
conferir(quarta.eventos.length === 0, "leitura igual não gera evento");

// ---------- número que cai (estorno, recontagem da Jamble) ----------

const quinta = diffGemas(quarta.agora, [linha("jako", 20000), linha("bruno", 17280), linha("nova", 60)], t0 + 120000);
conferir(quinta.eventos.length === 0, "queda não vira evento");
conferir(quinta.agora.jako === 20000, "mas o total passa a ser o novo (quem manda no número é a Jamble)");

// ---------- várias pessoas de uma vez, maior primeiro ----------

const sexta = diffGemas(quinta.agora, [linha("jako", 20500), linha("bruno", 27280), linha("nova", 60)], t0 + 150000);
conferir(sexta.eventos.length === 2, "duas subidas, dois eventos");
conferir(sexta.eventos[0].gemas === 10000 && sexta.eventos[1].gemas === 500, "maior envio primeiro", JSON.stringify(sexta.eventos.map((e) => e.gemas)));

// ---------- linha sem handle não quebra nada ----------

const suja = diffGemas(sexta.agora, [linha("jako", 20500), { nome: "sem handle", gemas: 999 }, null], t0 + 180000);
conferir(suja.eventos.length === 0, "linha sem handle é ignorada sem erro");

// ---------- soma de gemas numa janela de tempo ----------

const CINCO_MIN = 5 * 60 * 1000;
const eventos = [
  { ts: t0 - 1, handle: "velho", gemas: 9999 }, // 1 ms velho demais: fica de fora
  { ts: t0, handle: "a", gemas: 100 }, // bem no limite: entra
  { ts: t0 + 60000, handle: "b", gemas: 200 },
  { ts: t0 + 290000, handle: "c", gemas: 50 },
];
const janela = gemasRecentes(eventos, CINCO_MIN, t0 + CINCO_MIN);
conferir(janela === 350, "últimos 5 min somam só o que cabe na janela", String(janela));
conferir(gemasRecentes([], CINCO_MIN, t0) === 0, "sem eventos, zero");
conferir(gemasRecentes(undefined, CINCO_MIN, t0) === 0, "sem lista nenhuma, zero (não quebra)");

// ---------- os números grandes do topo ----------

const r = resumirGemas([
  linha("a", 24680, { pontos: 2473, gastou: 5 }),
  linha("b", 0, { pontos: 2015, gastou: 2015 }),
  linha("c", 500, { pontos: 9580, gastou: 9530 }),
]);
conferir(r.gemas === 25180, "total de gemas", String(r.gemas));
conferir(r.carpas === Math.round(25180 / GEMAS_POR_CARPA), "carpas equivalentes", String(r.carpas));
conferir(r.pontos === 14068, "total de pontos", String(r.pontos));
conferir(r.comprado === 11550, "total comprado", String(r.comprado));
conferir(r.pessoas === 3 && r.enviaram === 2, "pessoas na live e quantas enviaram gemas", `${r.enviaram}/${r.pessoas}`);

// ---------- números reais da live de 30/09, conferidos contra a tela ----------

const live3009 = [
  ["fabiomeneguello", 9580, 9530, 500], ["jakolino", 2473, 5, 24680], ["cartaperfeita", 2425, 2370, 550],
  ["rainhatcg", 2118, 2100, 180], ["nathancosta", 2015, 2015, 0], ["blaftdyy24", 1853, 125, 17280],
  ["lucasliratcg", 1717, 163, 15540], ["nathanalcarde", 1492, 1012, 4800], ["felipericardo", 1482, 1476, 60],
  ["pauloaraujobr7", 1329, 125, 12040], ["hugo_lee_013", 1239, 1239, 0], ["vbpracima", 1174, 1174, 0],
  ["comesanha", 1150, 900, 2500], ["nandinhohsj", 1007, 757, 2500], ["rafaelmedeiros090909", 1006, 701, 3050],
  ["drfelipecastelo", 951, 901, 500], ["marinho", 943, 5, 9380], ["rodrigoomenaadv", 900, 900, 0],
  ["vinastcg", 730, 130, 6000], ["plpedrolucas03", 663, 0, 6630],
].map(([h, pontos, gastou, gemas]) => linha(h, gemas, { pontos, gastou }));

const real = resumirGemas(live3009);
conferir(real.gemas === 106190, "gemas do top 20 da live de 30/09", String(real.gemas));
conferir(real.enviaram === 16, "16 das 20 pessoas enviaram gemas", String(real.enviaram));

// A regra da Jamble é comprou + gemas x 0,1 = pontos. Se isso parar de bater,
// é porque eles mudaram o peso -- e o painel precisa saber.
const fora = live3009.filter((l) => Math.abs(l.gastou + l.gemas * 0.1 - l.pontos) > 1);
conferir(fora.length === 0, "comprou + gemas x 0,1 = pontos em todas as linhas", fora.map((l) => l.handle).join(", "));

// ---------- identificar a live pelo endereço ----------
// Cada live tem a sua contagem. Se duas caírem no mesmo id, uma apaga a outra.

const caminhos = [
  ["/live/dedevieira1/5gqNkh1zTPMP7SlS6hsu", "5gqNkh1zTPMP7SlS6hsu", false],
  ["/live/israelbrito/abc123XYZ", "abc123XYZ", false],
  ["/seller/dashboard/lives/2P5LgSdtPTmHDSMdXGKV", "2P5LgSdtPTmHDSMdXGKV", true],
  ["/seller/dashboard/lives/obs", "obs", true],
  ["/seller/dashboard/lives", null, false],
  ["/explore", null, false],
  ["/", null, false],
];
for (const [caminho, id, dela] of caminhos) {
  conferir(idDaLive(caminho) === id, `id da live em ${caminho}`, String(idDaLive(caminho)));
  conferir(ehPainelDoVendedor(caminho) === dela, `é o painel dela? ${caminho}`, String(ehPainelDoVendedor(caminho)));
}

// Duas lives do mesmo vendedor não podem dar o mesmo id -- era o erro de pegar
// o nome do vendedor em vez do identificador da live.
conferir(
  idDaLive("/live/israelbrito/aaa") !== idDaLive("/live/israelbrito/bbb"),
  "duas lives do mesmo vendedor têm ids diferentes",
);

// ---------- emotions: contagem por ícone e por pessoa ----------
// São os 10 envios reais capturados na live do @oscatarina em 03/10/2026,
// mais três de outras pessoas para o sorteio ter com quem trabalhar.

const emo = (id, handle, icone, gemas) => ({ id, handle, nome: handle, icone, gemas, ts: t0 });
const envios = [
  ...Array.from({ length: 8 }, (_, i) => emo("h" + i, "israelbrito", "pixel_heart", 10)),
  emo("c1", "israelbrito", "charmander", 60),
  emo("c2", "israelbrito", "charmander", 60),
  emo("k1", "jako", "magikarp_shiny", 500),
  emo("k2", "jako", "magikarp_shiny", 500),
  emo("k3", "bruno", "magikarp_shiny", 500),
];

const re = resumirEmocoes(envios);
conferir(re.total === 13, "conta todos os envios", String(re.total));
conferir(re.gemas === 8 * 10 + 2 * 60 + 3 * 500, "soma as gemas pelo preço de cada ícone", String(re.gemas));
conferir(re.porIcone[0].icone === "magikarp_shiny" && re.porIcone[0].qtd === 3, "ícone que mais rendeu vem primeiro", JSON.stringify(re.porIcone[0]));
conferir(re.porIcone.length === 3, "três ícones distintos", String(re.porIcone.length));
conferir(re.porPessoa.length === 3, "três pessoas", String(re.porPessoa.length));

const israel = re.porPessoa.find((p) => p.handle === "israelbrito");
conferir(israel.qtd === 10 && israel.gemas === 200, "total da pessoa", `${israel.qtd} envios, ${israel.gemas} gemas`);
conferir(israel.icones.pixel_heart === 8 && israel.icones.charmander === 2, "e a conta dela por ícone", JSON.stringify(israel.icones));

// quemMandou é o que o sorteio por ícone usa
const carpeiros = quemMandou(envios, "magikarp_shiny");
conferir(carpeiros.length === 2, "só quem mandou carpa entra", carpeiros.map((c) => c.handle).join(","));
conferir(carpeiros[0].handle === "jako" && carpeiros[0].qtd === 2, "quem mandou mais vem primeiro", JSON.stringify(carpeiros[0]));
conferir(!carpeiros.some((c) => c.handle === "israelbrito"), "quem só mandou coração não entra no sorteio de carpa");
conferir(quemMandou(envios, null).length === 3, "sem ícone, entra todo mundo que mandou emotion");
conferir(quemMandou(envios, "pokeball").length === 0, "ícone que ninguém mandou dá lista vazia");
conferir(quemMandou([], "magikarp_shiny").length === 0, "sem emotion nenhuma, lista vazia");

const vazio = resumirEmocoes([]);
conferir(vazio.total === 0 && vazio.gemas === 0 && vazio.porIcone.length === 0, "sem emotions não quebra");
conferir(resumirEmocoes(undefined).total === 0, "sem lista nenhuma não quebra");

// ---------- a lista de métricas aguenta dado pela metade ----------
// Um campo faltando derrubou a tela inteira uma vez: reais(undefined) estourava
// dentro do pintar() e nada era desenhado. Aqui isso não passa de novo.

const fmt = {
  num: (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("pt-BR") : "—"),
  reais: (n) => (Number.isFinite(Number(n)) ? "R$ " + Number(n).toFixed(2) : "—"),
  tempo: (s) => (s >= 60 ? `${Math.floor(s / 60)}min` : `${Math.round(s)}s`),
  pct: (v) => (v * 100).toFixed(0) + "%",
};

// 1) só o que vem de QUALQUER live (o objeto show do WebSocket)
const soAoVivo = {
  faturamento: 3731, vendas: 35, audienciaAgora: 29, likes: 15,
  produtosVendidos: 0, produtosDisponiveis: 5, produtosTotal: 5,
  compartilhamentos: 1, salvos: 0, comecouEm: Date.now() - 60 * 60 * 1000,
};
const L1 = listaDeMetricas(soAoVivo, fmt);
const nomes1 = L1.map(([k]) => k);
conferir(L1.length > 0, "live de outro vendedor já rende métricas", `${L1.length} linhas`);
conferir(nomes1.includes("Assistindo agora"), "mostra quem está assistindo agora");
conferir(nomes1.includes("Ticket médio"), "calcula o ticket médio a partir de faturamento e vendas");
conferir(nomes1.includes("Duração da live"), "calcula a duração a partir da hora que começou");
conferir(nomes1.includes("Faturamento por minuto"), "e o ritmo");
conferir(!nomes1.includes("Pico simultâneo"), "não inventa o que só o vendedor vê");
conferir(!L1.some(([, v]) => v === "—" || v == null), "nenhuma linha sai com valor vazio", JSON.stringify(L1.filter(([, v]) => v === "—")));
const ticket1 = L1.find(([k]) => k === "Ticket médio")[1];
conferir(ticket1 === "R$ " + (3731 / 35).toFixed(2), "ticket médio certo", ticket1);

// 2) o pacote completo do painel do vendedor
const completo = {
  faturamento: 26827, vendas: 74, ticketMedio: 362.53, gastoPorComprador: 1117.79,
  compradores: 24, ofertaram: 30, porMinuto: 62.83, segundosEntreVendas: 289.14,
  frete: 1025.36, espectadores: 1486, pico: 45, mediaSimultanea: 24.56,
  segundosAssistidos: 381.85, ficaramUmMinuto: 383, voltaram: 1195,
  sessoesPorPessoa: 3.23, produtosMostrados: 916, produtosVendidos: 131,
  escoamento: 0.14, mensagens: 2802, pessoasNoChat: 113, seguidoresNovos: 9,
  minutos: 427, compradoresNovos: 12,
};
const L2 = listaDeMetricas(completo, fmt);
const nomes2 = L2.map(([k]) => k);
conferir(L2.length > nomes1.length, "com os dados do vendedor vem bem mais", `${L2.length} linhas`);
conferir(nomes2.includes("Pico simultâneo") && nomes2.includes("Público que voltou"), "inclui o que só o vendedor vê");
conferir(L2.find(([k]) => k === "Ticket médio")[1] === "R$ 362.53", "usa o ticket que a Jamble calcula, não o nosso");
conferir(L2.find(([k]) => k === "Taxa de escoamento")[1] === "14%", "escoamento em porcentagem");
conferir(!L2.some(([, v]) => v === "—"), "nada vazio no pacote completo");

// 3) casos que não podem quebrar
conferir(listaDeMetricas(null, fmt).length === 0, "sem métricas, lista vazia");
conferir(listaDeMetricas({}, fmt).length === 0, "objeto vazio, lista vazia");
conferir(listaDeMetricas({ faturamento: 0, vendas: 0 }, fmt).length === 0, "live que acabou de começar não mostra meia tela de zeros");
const sujo = listaDeMetricas({ faturamento: "abc", vendas: null, likes: 7, pico: undefined, frete: NaN }, fmt);
conferir(sujo.length === 1 && sujo[0][0] === "Likes na live", "campo torto é ignorado, o bom passa", JSON.stringify(sujo));

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
