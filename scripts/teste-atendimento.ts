// Testes do robô de atendimento. Rode o site (npm run dev) e depois:
//   node scripts/teste-atendimento.ts
//
// Bate na rota de verdade em vez de importar o módulo, porque o tsconfig exclui
// scripts/ e os imports de lib/ não levam extensão. Testar por HTTP também
// cobre a rota inteira, não só o motor.
//
// Cada caso é uma pergunta como um cliente escreveria -- com erro de digitação,
// sem acento, em minúscula -- e o assunto que ela deve acertar. Se alguém mexer
// nos gatilhos de conhecimento.ts, é aqui que o estrago aparece.

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const casos: [string, string][] = [
  ["oi", "saudacao"],
  ["Boa noite!", "saudacao"],
  ["oi, como eu faço pra comprar uma carta?", "comprar"],
  ["quero comprar", "comprar"],
  ["aceita pix?", "pagamento"],
  ["da pra parcelar no cartao?", "pagamento"],
  ["tem desconto no pix?", "pagamento"],
  ["essas cartas sao originais mesmo?", "originais"],
  ["o que quer dizer NM?", "condicao"],
  ["qual a diferença de SP pra MP", "condicao"],
  ["o que significa JP", "origem"],
  ["posso devolver se nao gostar?", "trocas"],
  ["quanto fica o frete pro meu cep", "envio"],
  ["quantos dias demora pra chegar", "envio"],
  ["cadê meu pedido?", "rastreio"],
  ["tem codigo de rastreio?", "rastreio"],
  ["quando vai ter live?", "live"],
  ["como entro no grupo?", "grupo"],
  ["como dou um lance no leilao", "leilao"],
  ["tem torneio esse mes?", "torneios"],
  ["onde fica a loja fisica?", "loja"],
  ["que horas abre?", "loja"],
  ["quanto custa o charizard", "catalogo"],
  ["tem essa carta em estoque?", "catalogo"],
  ["queria falar com uma pessoa", "humano"],
  ["voces emitem nota fiscal?", "email"],
  ["obrigado!", "agradecimento"],
  ["voce vende geladeira?", "escape"],
  ["asdfgh", "escape"],
  ["", "vazio"],
];

async function perguntar(pergunta: string) {
  const r = await fetch(`${BASE}/api/atendimento`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pergunta }),
  });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
}

let ok = 0;
const falhas: string[] = [];

for (const [pergunta, esperado] of casos) {
  const d = await perguntar(pergunta);
  if (d.id === esperado) ok++;
  else falhas.push(`  "${pergunta}" -> ${d.id} (esperado ${esperado})`);
  // Nenhuma resposta pode sair vazia, nem a de escape.
  if (!d.texto || d.texto.length < 10) falhas.push(`  "${pergunta}" -> resposta curta demais`);
}

console.log(`${ok}/${casos.length} assuntos corretos`);
if (falhas.length) {
  console.log("\nFALHAS:");
  falhas.forEach((f) => console.log(f));
  process.exitCode = 1;
} else {
  console.log("todos passaram");
}
