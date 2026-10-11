// Testes das contas dos relatórios em PDF. Rodar: node scripts/teste-relatorio.mts
// (relatorio.ts importa com o "@/" do Next: aqui o import é trocado pelo
// caminho do arquivo antes de carregar.)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const calculos = pathToFileURL(path.join(aqui, "../lib/dash/calculos.ts")).href;
const fonte = fs.readFileSync(path.join(aqui, "../lib/dash/relatorio.ts"), "utf8").replace('"@/lib/dash/calculos"', JSON.stringify(calculos));
const tmp = path.join(os.tmpdir(), `relatorio-${Date.now()}.mts`);
fs.writeFileSync(tmp, fonte);
const R = (await import(pathToFileURL(tmp).href)) as typeof import("../lib/dash/relatorio.ts");
fs.rmSync(tmp);

let falhas = 0;
function conferir(ok: unknown, nome: string, extra?: unknown) {
  if (ok) console.log("OK  ", nome);
  else {
    falhas++;
    console.log("FALHA", nome, extra === undefined ? "" : JSON.stringify(extra));
  }
}

conferir(R.pctBR(10326, 28086) === "36,8%", "porcentagem com uma casa", R.pctBR(10326, 28086));
conferir(R.pctBR(969, 32387) === "3%", "porcentagem sem ,0", R.pctBR(969, 32387));
conferir(R.pctBR(5, 0) === "0%", "porcentagem de zero");
conferir(R.reaisBR(32387) === "R$ 32.387,00", "reais", R.reaisBR(32387));
conferir(R.tipoDeVenda("AUCTION") === "Leilão" && R.tipoDeVenda("SUDDEN_DEATH") === "Leilão" && R.tipoDeVenda("BUY_IT_NOW") === "Compra direta", "tipo da venda");
conferir(R.textoDoPdf("HOJE INFINIDADE DE PRODUTOS 🇺🇸!!!!") === "HOJE INFINIDADE DE PRODUTOS !!!!", "tira emoji do texto", R.textoDoPdf("HOJE INFINIDADE DE PRODUTOS 🇺🇸!!!!"));
conferir(R.textoDoPdf("Coleção Celebração — 30 anos…") === "Coleção Celebração — 30 anos…", "mantém acentos e travessão");
// 23:42 UTC de 09/10 é 20:42 em Brasília.
conferir(R.dataHoraBR(Date.UTC(2026, 9, 9, 23, 42)) === "09/10/2026, 20:42", "data no horário de Brasília", R.dataHoraBR(Date.UTC(2026, 9, 9, 23, 42)));

const t0 = Date.UTC(2026, 9, 9, 23, 44);
const venda = (id: string, titulo: string, comprador: string, total: number, extra: Partial<import("../lib/dash/relatorio.ts").VendaDoRelatorio> = {}) => ({
  id,
  showId: "S1",
  titulo,
  imagem: `https://img/${titulo}.png`,
  comprador,
  preco: total,
  quantidade: 1,
  total,
  tipo: "AUCTION",
  pago: true,
  cancelado: false,
  ts: t0 + Number(id) * 60000,
  ...extra,
});
const entrada = {
  tipo: "live" as const,
  conta: "israelbrito",
  lives: [{ showId: "S1", vendedor: "israelbrito", titulo: "HOJE 🇺🇸 LIVE", inicio: t0 - 120000, fim: null, codigo: "nhdcnknm", emocoes: 0 }],
  vendas: [
    venda("1", "Triplo 30th", "dbfdmello", 280),
    venda("2", "Triplo 30th", "kingdarkx", 300),
    venda("3", "CASE TRIPLO", "nathancosta", 3360),
    venda("4", "Triplo 30th", "caiotcg", 300, { pago: false }),
    venda("5", "Frete bulk", "bruno88", 5, { tipo: "BUY_IT_NOW" }),
    venda("6", "Triplo 30th", "x", 999, { cancelado: true }),
  ],
  emocoes: [
    { handle: "mariaeduardas", icone: "magikarp_shiny", qtd: 34, gemas: 17000 },
    { handle: "mariaeduardas", icone: "pixel_heart", qtd: 2, gemas: 20 },
    { handle: "barbarasanto", icone: "pixel_heart", qtd: 40, gemas: 400 },
  ],
  ganhadores: [
    { ts: t0 + 3600e3, vendedor: "israelbrito", regra: "Sorteio para todos que enviaram emotions", premio: "1 Booster", handle: "drico3dlab", presente: null, status: "valido" },
    { ts: t0 + 1800e3, vendedor: "israelbrito", regra: "Regra", premio: null, handle: "mago_tcg", presente: false, status: "resorteado" },
  ],
  icones: { pixel_heart: { url: "https://cdn/pixel_heart.png", nome: null } },
};
const r = R.montarRelatorio(entrada, Date.UTC(2026, 9, 11, 6, 57));
const kpi = (n: string) => r.kpis.find((k) => k.rotulo === n)!;
conferir(kpi("Total vendido").valor === "R$ 4.245,00", "total vendido sem a cancelada", kpi("Total vendido"));
conferir(kpi("Pago").valor === "R$ 3.945,00" && kpi("Pago").sub === "4 vendas · 92,9%", "pago", kpi("Pago"));
conferir(kpi("Pendente").sub === "1 vendas" && kpi("Cancelado").valor === "R$ 999,00", "pendente e cancelado", [kpi("Pendente"), kpi("Cancelado")]);
conferir(kpi("Compradores").valor === "5" && kpi("Compradores").sub === "ticket médio R$ 849,00", "compradores e ticket médio", kpi("Compradores"));
conferir(kpi("Emotions").sub === "17.420 pontos · 2 pessoas" && kpi("Sorteios").valor === "1", "emotions e sorteios", [kpi("Emotions"), kpi("Sorteios")]);
conferir(r.produtos.map((p) => p.titulo).join("|") === "CASE TRIPLO|Triplo 30th|Frete bulk", "produtos só com vendas pagas, por valor", r.produtos);
conferir(r.produtos[1].qtd === 2 && r.produtos[1].total === 580, "produto soma só as pagas", r.produtos[1]);
conferir(r.compradores.find((c) => c.handle === "caiotcg")?.pendente === 300, "comprador com pendente", r.compradores);
conferir(r.icones[0].icone === "pixel_heart" && r.icones[0].imagem === "https://cdn/pixel_heart.png", "emotions por quantidade com a figura", r.icones);
conferir(r.pontos[0].handle === "mariaeduardas" && r.pontos[0].pontos === 17020, "pontos por usuário", r.pontos);
conferir(r.destaques[2]?.imagem === "https://cdn/pixel_heart.png" && r.destaques[0]?.titulo === "CASE TRIPLO", "destaques", r.destaques);
conferir(r.ganhadores[0].handle === "@mago_tcg" && r.ganhadores[0].situacao === "Trocado" && r.ganhadores[0].naLive === "Não", "ganhadores em ordem, com situação", r.ganhadores);
conferir(r.vendas.length === 6 && r.vendas[3].status === "Pendente" && r.vendas[5].status === "Cancelada" && r.vendas[4].tipo === "Compra direta", "todas as vendas", r.vendas);
conferir(r.info === "@israelbrito • 09/10/2026, 20:42 – 09/10/2026, 20:50 • jamble.com/s/nhdcnknm • Gerado em 11/10/2026, 03:57", "linha do topo", r.info);
conferir(r.arquivo === "relatorio-live-nhdcnknm.pdf" && r.cabecalho === "Relatório da live · @israelbrito", "arquivo e cabeçalho", [r.arquivo, r.cabecalho]);

const p = R.montarRelatorio({ ...entrada, tipo: "periodo", periodo: { de: 0, ate: 0 } }, Date.UTC(2026, 9, 11, 6, 57));
conferir(p.subtitulo === "todo o histórico salvo" && p.info.startsWith("1 lives • 1 vendedores"), "período sem datas", [p.subtitulo, p.info]);
conferir(p.lives.length === 1 && p.lives[0].vendido === 4245 && p.lives[0].compradores === 5, "lives do período", p.lives);
conferir(p.vendas.length === 0 && p.kpis[2].rotulo === "Lives", "período sem 'Todas as vendas' e com Lives", p.kpis);
const q = R.montarRelatorio({ ...entrada, tipo: "periodo", periodo: { de: Date.UTC(2026, 9, 1, 3), ate: Date.UTC(2026, 9, 12, 3) } }, Date.UTC(2026, 9, 11, 6, 57));
conferir(q.subtitulo === "01/10/2026 a 11/10/2026", "período com datas", q.subtitulo);

const cli = R.montarRelatorioClientes(
  {
    conta: "israelbrito",
    lives: 11,
    clientes: [
      { comprador: "cartaperfeita", pago: 21166, pendente: 0, itens: 9, compras: 9, lives: 3, primeira: Date.UTC(2026, 8, 17, 15), ultima: Date.UTC(2026, 9, 6, 15) },
      { comprador: "ravanello", pago: 28742, pendente: 0, itens: 52, compras: 36, lives: 6, primeira: Date.UTC(2026, 8, 19, 15), ultima: Date.UTC(2026, 9, 10, 15) },
      { comprador: "natalytata", pago: 0, pendente: 501, itens: 1, compras: 1, lives: 1, primeira: Date.UTC(2026, 9, 10, 1), ultima: Date.UTC(2026, 9, 10, 1) },
    ],
  },
  Date.UTC(2026, 9, 11, 10, 39),
);
conferir(cli.nome === "Clientes de @israelbrito" && cli.info === "11 lives • 3 clientes • Gerado em 11/10/2026, 07:39", "clientes: topo", [cli.nome, cli.info]);
conferir(cli.clientes?.[0].handle === "ravanello" && cli.clientes?.[2].handle === "natalytata", "clientes pelo total pago", cli.clientes);
conferir(cli.kpis[0].sub === "+ R$ 501,00 pendente" && cli.kpis[1].sub === "2 compraram em 2+ lives" && cli.kpis[3].valor === "R$ 16.636,00", "clientes: números", cli.kpis);
conferir(cli.destaques[0]?.titulo === "@ravanello" && cli.destaques[0]?.sub === "R$ 28.742,00 · 52 itens · 6 lives" && cli.destaques[0]?.rotulo === "1º cliente", "clientes: os 3 maiores", cli.destaques);
// 01:00 UTC de 10/10 ainda é 09/10 em Brasília.
conferir(cli.clientes?.[2].primeira === "09/10/2026", "data da 1ª compra no horário de Brasília", cli.clientes?.[2]);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
