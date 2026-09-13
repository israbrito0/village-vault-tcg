// Confere a busca de carta por código. Rode: node scripts/teste-cartas.ts
import { buscarCarta, cotacoes } from "../lib/cartas.ts";

const casos = ["232/091", "sv04.5-232", "Umbreon VMAX", "25/102"];

const c = await cotacoes();
console.log(`cotação: 1 USD = R$ ${c.usd.toFixed(2)} | 1 EUR = R$ ${c.eur.toFixed(2)}\n`);

for (const caso of casos) {
  const achadas = await buscarCarta(caso, 1);
  console.log(`"${caso}" → ${achadas.length} resultado(s)`);
  for (const carta of achadas.slice(0, 3)) {
    const p = carta.precos;
    console.log(
      `   ${carta.nome} · ${carta.colecao} (${carta.numero}/${carta.totalOficial ?? "?"}) · ${carta.raridade ?? ""}`,
    );
    console.log(
      `   ref: ${p.referenciaBrl ? "R$ " + p.referenciaBrl.toFixed(2) : "sem preço"} (${p.fonte ?? "-"}) · cm €${p.cardmarketEur ?? "-"} · tp $${p.tcgplayerUsd ?? "-"}`,
    );
    console.log(`   img: ${carta.imagem}`);
  }
  console.log("");
}
