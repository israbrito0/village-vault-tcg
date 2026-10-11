// Testes das contas do Dash Village. Rodar: node scripts/teste-dash.mts
import {
  CARPA,
  concorrendo,
  engajamento,
  lerTermos,
  marcos,
  mensagemDeStatus,
  metaPorPessoa,
  pareceRobo,
  participantes,
  participantesDeContagem,
  pontosDaLive,
  pontosEstimados,
  progressoMeta,
  totalDaFonte,
  pontosPorPessoa,
  porIcone,
  porProduto,
  rankingCarpas,
  rankingCompradores,
  resumoVendas,
  sortear,
  type Emocao,
  type Mensagem,
  type Venda,
} from "../lib/dash/calculos.ts";

let falhas = 0;
function conferir(ok: unknown, nome: string, extra?: unknown) {
  if (ok) console.log("OK  ", nome);
  else {
    falhas++;
    console.log("FALHOU", nome, extra === undefined ? "" : JSON.stringify(extra));
  }
}

// ---------- contas suspeitas (molde real da live de 09/10/2026) ----------
const robos = ["tomasapoadamsxp", "rosalindtwaters", "louvenizgornqyv", "feliciavwaltenw", "juliexjleuschkp", "teriaksanfordkc", "lianakusatterfy", "wilsonhqwillpah", "saulxzwalterptt", "albertdpmurrayd", "estellexdwalter"];
const gente = ["mariaeduardas", "barbarasanto", "dcristovao112", "gabrielsanchesg", "marinho", "hanzotcg7", "gods", "dbfdmello", "hugo_lee_013", "tiagodgonzales", "holdingcardsjapan", "israelbrunobs", "ruanluucas", "renata_delga", "cesarjuniorbraz", "juliocesars", "luispauloramoss", "mariodogtv", "rainhatcg", "almirgralha", "arianaazevedo", "avatarn444tcg", "leonardofrasson", "fabiomeneguello", "guilhermecheles", "oliveira_felipe", "wannashine_tcg", "bombomzinho", "daniloborinato", "douglasjuliati", "marceloparra", "jonatassmoura", "carollinesc", "pokecartavitinho", "gabrielstrelow", "felipericardo", "cartaperfeita", "matheuscarvalho", "pedroaugustoss", "joaovitorsilva", "lucasoliveirasx", "thiagosantosrj"];
const pegos = robos.filter((h) => pareceRobo(h));
conferir(pegos.length >= 9, `pega as contas em lote (${pegos.length}/${robos.length})`, robos.filter((h) => !pareceRobo(h)));
const marcados = gente.filter((h) => pareceRobo(h));
conferir(marcados.length <= 1, `quase não marca gente de verdade (${marcados.length})`, marcados);
conferir(!pareceRobo("tomasapoadamsxp", { mensagens: 3 }), "quem escreveu no chat não é marcado");
conferir(!pareceRobo("tomasapoadamsxp", { compras: 1 }), "quem comprou não é marcado");

// ---------- emotions e carpas ----------
const t0 = 1_791_500_000_000;
const emo = (id: string, handle: string, icone: string, gemas: number, s = 0): Emocao => ({ id, handle, icone, gemas, ts: t0 + s * 1000 });
const emocoes: Emocao[] = [
  emo("1", "ana", CARPA, 500, 1),
  emo("2", "ana", CARPA, 500, 2),
  emo("3", "bia", "pixel_heart", 10, 3),
  emo("4", "bia", CARPA, 500, 4),
  emo("5", "tomasapoadamsxp", CARPA, 500, 5),
  emo("6", "israelbrito", CARPA, 500, 6),
];
const msgs: Mensagem[] = [
  { id: "m1", handle: "carla", texto: "manda 🐟 dourada!", ts: t0 + 10_000 },
  { id: "m2", handle: "bia", texto: "oi", ts: t0 + 20_000 },
];
const pi = porIcone(emocoes);
conferir(pi[0].icone === CARPA && pi[0].qtd === 5 && pi[0].gemas === 2500, "porIcone soma a carpa", pi);
const pp = pontosPorPessoa(emocoes);
conferir(pp[0].gemas === 1000 && pp.find((p) => p.handle === "bia")?.gemas === 510, "pontos por pessoa = gemas", pp);
conferir(JSON.stringify(lerTermos(" magikarp_shiny, 🐟 ,, ")) === JSON.stringify(["magikarp_shiny", "🐟"]), "lerTermos separa e limpa");
conferir(lerTermos("")[0] === CARPA, "sem termo, vale a carpa");
const rc = rankingCarpas(emocoes, msgs, ["magikarp_shiny", "🐟"]);
conferir(rc[0].handle === "ana" && rc[0].carpas === 2 && rc.find((p) => p.handle === "carla")?.carpas === 1, "carpa dourada pelo ícone e pelo termo no chat", rc);

// ---------- vendas ----------
const venda = (id: string, comprador: string, total: number, extra: Partial<Venda> = {}): Venda => ({
  id, titulo: "COMBO BOOSTER", comprador, preco: total, quantidade: 1, total, tipo: "AUCTION", pago: true, cancelado: false, ts: t0 + Number(id) * 60_000, ...extra,
});
const vendas: Venda[] = [
  venda("1", "ana", 250),
  venda("2", "ana", 3 * 149, { quantidade: 3, preco: 149, titulo: "SURPRISE PACK", tipo: "BUY_IT_NOW" }),
  venda("3", "carla", 300, { pago: false }),
  venda("4", "bia", 999, { cancelado: true }),
];
const rv = resumoVendas(vendas);
conferir(rv.vendas === 3 && rv.itens === 5 && rv.total === 997 && rv.pago === 697 && rv.pendente === 300 && rv.compradores === 2 && rv.canceladas === 1, "resumo: total, pago, pendente, itens, sem cancelada", rv);
const rk = rankingCompradores(vendas);
conferir(rk[0].handle === "ana" && rk[0].itens === 4 && rk[0].total === 697, "ranking de compradores conta a compra de 3 unidades", rk);
const prod = porProduto(vendas);
conferir(prod.length === 2 && prod.find((p) => p.titulo === "SURPRISE PACK")?.qtd === 3 && !prod.some((p) => p.total === 300), "por produto: só pagas, quantidade certa", prod);

// ---------- engajamento ----------
const eng = engajamento(emocoes, msgs, vendas);
const bia = eng.find((p) => p.handle === "bia");
conferir(bia?.mensagens === 1 && bia?.emocoes === 2 && bia.compras === 0 && bia.ativoMs === 17_000, "engajamento: mensagens, emotions e tempo ativo", bia);
conferir(!eng.some((p) => p.handle === "bia" && p.compras > 0), "venda cancelada não conta como compra");

// ---------- sorteio ----------
const dados = { emocoes, mensagens: msgs, vendas, termos: ["magikarp_shiny", "🐟"], vendedor: "israelbrito" };
const regra = { fonte: "emocao:" + CARPA, peso: "quantidade" as const, repetir: false, excluirSuspeitos: true, excluir: [] };
const lista = participantes(regra, dados, ["bia"]);
const fora = Object.fromEntries(lista.filter((p) => p.fora).map((p) => [p.handle, p.fora]));
conferir(fora.israelbrito === "é o vendedor" && fora.tomasapoadamsxp === "conta suspeita" && fora.bia === "já ganhou", "sorteio tira vendedor, suspeito e quem já ganhou", fora);
const ok = concorrendo(lista);
conferir(ok.length === 1 && ok[0].handle === "ana" && ok[0].bilhetes === 2, "só a ana concorre, com 2 bilhetes", ok);
conferir(sortear(lista, 0.99)?.handle === "ana", "sortear devolve quem concorre");
const compradores = participantes({ ...regra, fonte: "compradores", repetir: true }, dados);
conferir(compradores.find((p) => p.handle === "ana")?.bilhetes === 4 && !compradores.some((p) => p.handle === "bia"), "compradores: 1 bilhete por item, cancelada não conta", compradores);
const igual = participantes({ ...regra, fonte: "compradores", peso: "igual", repetir: true }, dados);
conferir(igual.every((p) => p.bilhetes === 1), "peso igual: 1 bilhete cada");
const doisB = [
  { handle: "x", nome: "x", foto: null, bilhetes: 1, suspeito: false },
  { handle: "y", nome: "y", foto: null, bilhetes: 3, suspeito: false },
];
conferir(sortear(doisB, 0)?.handle === "x" && sortear(doisB, 0.3)?.handle === "y" && sortear(doisB, 0.999)?.handle === "y", "bilhetes viram faixas de chance");
conferir(sortear([], 0.5) === null, "sem ninguém, sem ganhador");

const m1 = marcos(50, 120, 1);
conferir(m1.liberados === 2 && m1.disponiveis === 1 && m1.faltaParaProximo === 30, "a cada 50: 120 liberam 2, um já usado, faltam 30", m1);
conferir(marcos(null, 10, 3).disponiveis === Infinity, "sorteio livre não tem limite");

conferir(pontosEstimados({ pontos: 1_000_000, ts: 0 }, 100, 500) === 1_001_300, "estimativa do ranking: +3 por real, +2 por gema");
const msg = mensagemDeStatus({ carpas: 246, vendas: 73, posicao: 5, faltaAcima: 87_517, proximoSorteio: { nome: "1 mini BB", falta: 12, unidade: "carpas" } });
conferir(msg.includes("#5") && msg.includes("87.517") && msg.includes("246") && msg.includes("12 carpas"), "mensagem de status para o chat", msg);

// ---------- o banco e a tela chegam no mesmo sorteio ----------
// dash_bilhetes devolve handle, n, mensagens, compras; a regra aplicada em
// cima tem que dar o mesmo que participantes() com a live inteira.
const contagem = [
  { handle: "ana", nome: "ana", foto: null, n: 2, mensagens: 0, compras: 2 },
  { handle: "bia", nome: "bia", foto: null, n: 1, mensagens: 1, compras: 0 },
  { handle: "tomasapoadamsxp", nome: "t", foto: null, n: 1, mensagens: 0, compras: 0 },
  { handle: "israelbrito", nome: "eu", foto: null, n: 1, mensagens: 0, compras: 0 },
];
const doBanco = participantesDeContagem(regra, contagem, "israelbrito", ["bia"]);
const daLive = participantes(regra, dados, ["bia"]);
conferir(
  JSON.stringify(doBanco.map((p) => [p.handle, p.bilhetes, p.fora ?? ""])) === JSON.stringify(daLive.map((p) => [p.handle, p.bilhetes, p.fora ?? ""])),
  "contagem do banco = conta com a live inteira",
  { doBanco, daLive },
);
conferir(totalDaFonte(contagem) === 5, "total da fonte soma tudo, antes do peso");

// ---------- metas ----------
const tot = { gemas: 5000, carpas: 40, emocoes: 60, faturamento: 1000, itens: 7, compradores: 3, pontosLive: pontosDaLive(1000, 5000), posicao: 6 };
conferir(tot.pontosLive === 13_000, "pontos da live: 3 por real + 2 por gema", tot.pontosLive);
conferir(pontosDaLive(100, 10, { porReal: 15, porGema: 1 }) === 1510, "regras que vêm da Jamble valem");
const pm = progressoMeta({ tipo: "carpas", alvo: 50 }, tot);
conferir(pm.atual === 40 && pm.falta === 10 && pm.progresso === 0.8 && !pm.batida, "meta de carpas: 40 de 50", pm);
conferir(progressoMeta({ tipo: "gemas", alvo: 5000 }, tot).batida, "meta batida no número exato");
conferir(!progressoMeta({ tipo: "posicao", alvo: 5 }, tot).batida && progressoMeta({ tipo: "posicao", alvo: 6 }, tot).batida, "meta de posição: #6 bate a meta #6, não a #5");
const mp = metaPorPessoa({ tipo: "gemas", alvo: 1000 }, dados);
conferir(mp.bateram.map((p) => p.handle).join() === "ana" && mp.perto[0].handle === "bia", "meta por pessoa: quem chegou e quem está perto", mp);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
