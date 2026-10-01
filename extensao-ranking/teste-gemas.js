// Teste das contas de gemas: rode com `node extensao-ranking/teste-gemas.js`.
// O "ao vivo" do painel sai da comparação entre uma leitura da Jamble e a
// seguinte, então é aqui que um erro apareceria como gema inventada ou perdida.
const { diffGemas, resumirGemas, gemasRecentes, GEMAS_POR_CARPA } = require("./gemas.js");

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

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
