// Testes das regras do leilão. Rode com: node scripts/teste-leilao.ts
import {
  abrirLote,
  caixas,
  encerrarLote,
  JANELA_MS,
  maiorLance,
  prorrogar,
  proximoMinimo,
  validarLance,
  type Lance,
  type Lote,
  type Participante,
} from "../lib/leilao.ts";

let falhas = 0;
function conferir(nome: string, condicao: boolean, detalhe = "") {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${condicao ? "" : ` — ${detalhe}`}`);
  if (!condicao) falhas += 1;
}

const AGORA = 1_700_000_000_000;

const loteBase: Lote = {
  id: "l1",
  ordem: 1,
  titulo: "Charizard ex",
  lanceInicialCentavos: 10000,
  incrementoCentavos: 1000,
  estado: "aguardando",
};

const maria: Participante = { id: "p1", nome: "Maria", whatsapp: "82999990000" };
const joao: Participante = { id: "p2", nome: "João", whatsapp: "82999990001" };

const aberto = abrirLote(loteBase, AGORA);
conferir("abrir lote marca aberto e o fim", aberto.estado === "aberto" && aberto.fechaEm === AGORA + 60000);

// --- mínimo ---
conferir("sem lance, mínimo é o lance inicial", proximoMinimo(aberto, null) === 10000);

const lance1: Lance = { id: "b1", loteId: "l1", participanteId: maria.id, nome: "Maria", centavos: 10000, em: AGORA + 1000 };
conferir("com lance, mínimo é maior + incremento", proximoMinimo(aberto, lance1) === 11000);

// --- validação ---
const okPrimeiro = validarLance({ lote: aberto, maior: null, participante: maria, centavos: 10000, agora: AGORA + 500 });
conferir("primeiro lance no valor inicial é aceito", okPrimeiro.ok);

const baixo = validarLance({ lote: aberto, maior: lance1, participante: joao, centavos: 10500, agora: AGORA + 2000 });
conferir("lance abaixo do incremento é recusado", !baixo.ok && baixo.erro === "valor-baixo");

const proprio = validarLance({ lote: aberto, maior: lance1, participante: maria, centavos: 12000, agora: AGORA + 2000 });
conferir("quem já está ganhando não cobre o próprio lance", !proprio.ok && proprio.erro === "ja-esta-ganhando");

const tarde = validarLance({ lote: aberto, maior: lance1, participante: joao, centavos: 11000, agora: AGORA + 60001 });
conferir("lance depois do fim é recusado", !tarde.ok && tarde.erro === "lote-fechado");

const fechado = validarLance({ lote: { ...aberto, estado: "encerrado" }, maior: lance1, participante: joao, centavos: 11000, agora: AGORA + 2000 });
conferir("lote encerrado não aceita lance", !fechado.ok && fechado.erro === "lote-fechado");

const banido = validarLance({ lote: aberto, maior: lance1, participante: { ...joao, bloqueado: true }, centavos: 11000, agora: AGORA + 2000 });
conferir("bloqueado não dá lance", !banido.ok && banido.erro === "participante-bloqueado");

const dedoGordo = validarLance({ lote: aberto, maior: lance1, participante: joao, centavos: 9_000_000, agora: AGORA + 2000 });
conferir("valor muito alto pede confirmação", !dedoGordo.ok && dedoGordo.erro === "confirmar-valor-alto");

const confirmado = validarLance({
  lote: aberto,
  maior: lance1,
  participante: joao,
  centavos: 9_000_000,
  agora: AGORA + 2000,
  confirmado: true,
});
conferir("valor muito alto passa quando confirmado", confirmado.ok);

const bom = validarLance({ lote: aberto, maior: lance1, participante: joao, centavos: 11000, agora: AGORA + 2000 });
conferir("lance no mínimo exato é aceito", bom.ok);

// --- prorrogação ---
const semPressa = prorrogar(aberto, AGORA + 10000);
conferir("lance longe do fim não prorroga", semPressa === aberto.fechaEm);

const noFim = prorrogar(aberto, AGORA + 55000);
conferir(
  "lance nos últimos segundos prorroga a janela",
  noFim === AGORA + 55000 + JANELA_MS,
  `esperado ${AGORA + 55000 + JANELA_MS}, veio ${noFim}`,
);

// --- maior lance e desempate ---
const lances: Lance[] = [
  lance1,
  { id: "b2", loteId: "l1", participanteId: joao.id, nome: "João", centavos: 12000, em: AGORA + 3000 },
  { id: "b3", loteId: "l1", participanteId: maria.id, nome: "Maria", centavos: 12000, em: AGORA + 4000 },
  { id: "b4", loteId: "l2", participanteId: maria.id, nome: "Maria", centavos: 99000, em: AGORA + 5000 },
];
const topo = maiorLance(lances, "l1");
conferir("empate no valor fica com quem chegou antes", topo?.id === "b2", `veio ${topo?.id}`);
conferir("lance de outro lote não entra na conta", topo?.centavos === 12000);

// --- encerramento e caixas ---
const encerrado = encerrarLote(aberto, topo!);
conferir("encerrar define o vencedor", encerrado.vencedorId === joao.id && encerrado.vencedorCentavos === 12000);

const semNinguem = encerrarLote({ ...loteBase, id: "l9", estado: "aberto" }, null);
conferir("lote sem lance encerra sem vencedor", semNinguem.estado === "encerrado" && !semNinguem.vencedorId);

const listaCaixa = caixas([
  encerrado,
  { ...loteBase, id: "l2", estado: "encerrado", vencedorId: joao.id, vencedorNome: "João", vencedorCentavos: 30000 },
  { ...loteBase, id: "l3", estado: "encerrado", vencedorId: maria.id, vencedorNome: "Maria", vencedorCentavos: 5000 },
  { ...loteBase, id: "l4", estado: "aberto" },
]);
const caixaJoao = listaCaixa.find((c) => c.participanteId === joao.id);
conferir("caixa soma os arremates da pessoa", caixaJoao?.centavos === 42000 && caixaJoao?.lotes.length === 2);
conferir("lote ainda aberto não entra na caixa", listaCaixa.length === 2);

console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
