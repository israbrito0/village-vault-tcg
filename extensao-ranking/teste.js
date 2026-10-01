// Roda todos os testes da extensão de uma vez:
//   node extensao-ranking/teste.js
// Sai com código 1 se qualquer um falhar, para dar para usar em automação.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const testes = [
  ["manifest e ligações entre os arquivos", "teste-manifest.js"],
  ["leitura da Jamble (vendas, participação, tabela)", "teste-leitura.js"],
  ["a ponte entre a página e a extensão", "teste-content.js"],
  ["contas de gemas", "teste-gemas.js"],
  ["o que o background guarda", "teste-background.js"],
  ["nome de fora não vira código", "teste-escape.js"],
  ["da resposta crua da Jamble até os números do painel", "teste-ponta-a-ponta.js"],
];

let ruim = 0;
for (const [nome, arquivo] of testes) {
  console.log(`\n=== ${nome} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, arquivo)], { stdio: "inherit" });
  if (r.status !== 0) ruim++;
}

console.log(ruim ? `\n>>> ${ruim} suíte(s) com falha` : "\n>>> tudo passou");
process.exit(ruim ? 1 : 0);
