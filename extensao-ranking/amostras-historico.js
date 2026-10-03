// Respostas reais da Jamble usadas nos testes do histórico desde o começo da
// live (live do @pokerusbr, 03/10/2026), só sem foto de produto e campos que
// a extensão não lê.
//
//   /api/live/products?section=sold       a aba "Vendidos" da live
//   /api/live/battle-participants         a aba "Batalha" da live

const foto = (id, arq) => `https://jamble.b-cdn.net/profiles/user_id=${id}/profile_images/${arq}.png`;

const vendido = (id, titulo, tipo, inicial, saleId, comprador, compradorId, preco, unidades, total, quando) => ({
  id,
  title: titulo,
  imageUrl: null,
  showOrder: 1,
  availableCount: 0,
  soldCount: unidades,
  saleType: tipo,
  startingPrice: inicial,
  currency: "BRL",
  sold: {
    saleId,
    soldProductId: id,
    buyerId: compradorId,
    buyerUsername: comprador,
    buyerAvatarUrl: foto(compradorId, "a"),
    soldPrice: preco,
    totalSoldPrice: total,
    isPaid: true,
    isCanceled: false,
    createdAt: quando,
  },
});

// Primeira página (as mais recentes) e a última (as mais antigas).
const VENDIDOS_PAGINA_1 = {
  success: true,
  items: [
    vendido("AkeuKe2G2L5PD1pxam9W", "Gem pack 2", "BUY_IT_NOW", 38, "iYhHIcnw8wvmgiYKXgWr", "jmlm", "w6vRZBYBo9XNMvmKGrssz3bpXnL2", 38, 1, 38, 1791054005.217),
    vendido("yTh5c4Yrd555PrUk5sOc", "Gem pack 2", "BUY_IT_NOW", 38, "uBLkp73qrYHnuqHeIYbu", "leozinthewise", "alZrKXHNsgasiwmt4LtKsWt1YKi2", 38, 5, 190, 1791054004.696),
    vendido("k9gCw80FWbzW0eJV8qzZ", "30 anos a R$ 5,00 💵", "AUCTION", 5, "nb0QZ1ImfBELbaF6Sl4S", "colecionar_164", "d1DXEAcByQQYhRBm3LSgztHTQ003", 2401, 1, 2401, 1791051692.227),
  ],
  hasNextPage: true,
  nextCursor: "x",
};
const VENDIDOS_PAGINA_2 = {
  success: true,
  items: [
    vendido("tiNlV6l3H1bXt1qxOFeh", "Batalha 30 anos EUA", "BUY_IT_NOW", 149, "0FImnrzVFVqkgPW1c3G0", "sixsauwer", "uPGHBrthPeXB905m67rPUwsPp7l1", 149, 3, 447, 1791049382.834),
    vendido("TlFBmBRj2s4oPG6DM6Mh", "30 anos a R$ 5,00 💵", "AUCTION", 5, "VyNc5TTB4S9JDJKlllcU", "vbpracima", "KFjLHNJ7wAePZ4bPcchq43IiSUh1", 750, 1, 750, 1791048870.092),
    vendido("IVw5Onof1RRVG4jnwn9W", "30 anos a R$ 5,00 💵", "AUCTION", 5, "WleH5QMZMdFkQCamkusW", "igor_2906", "8haEglthKEVhNMT3MpQkXWfsPct1", 131, 1, 131, 1791048653.708),
  ],
  hasNextPage: false,
};

const BATALHA_PARTICIPANTES = {
  success: true,
  title: "Batalha, ",
  cashPrizeTitle: "R$ 100 prêmio",
  rules: [
    { rule: "Compre itens", description: "15 pontos para cada R$ que gastar", icon: "shop", entryPoints: 15 },
    { rule: "Envie gemas", description: "1 ponto para cada gema enviada", icon: "gem", entryPoints: 1 },
  ],
  participants: [
    { id: "d1DXEAcByQQYhRBm3LSgztHTQ003", userId: "d1DXEAcByQQYhRBm3LSgztHTQ003", username: "colecionar_164", avatarUrl: foto("d1DX", "b"), team: "red", rank: 1, points: 44520, rewardLabel: "R$ 25" },
    { id: "KFjLHNJ7wAePZ4bPcchq43IiSUh1", userId: "KFjLHNJ7wAePZ4bPcchq43IiSUh1", username: "vbpracima", avatarUrl: foto("KFjL", "b"), team: "red", rank: 2, points: 20775, rewardLabel: "R$ 18" },
    { id: "uPGHBrthPeXB905m67rPUwsPp7l1", userId: "uPGHBrthPeXB905m67rPUwsPp7l1", username: "sixsauwer", avatarUrl: foto("uPGH", "b"), team: "blue", rank: 3, points: 15745, rewardLabel: null },
    { id: "QGKbJ2ibvfSBQKM40pffxDUhKf12", userId: "QGKbJ2ibvfSBQKM40pffxDUhKf12", username: "samantaavila", avatarUrl: foto("QGKb", "b"), team: "blue", rank: 12, points: 1960, rewardLabel: null },
  ],
  own: null,
  hasNextPage: true,
};

// Live do @exclusive (03/10/2026): 10 vendas de compra direta, uma delas de 3
// unidades (R$ 447) -- o caso em que o painel mostrava só R$ 149 na linha.
const MAL = '🎟️ DUPLO 30y - BATALHA DO MAL';
const BEM = '🎟️ DUPLO 30y - BATALHA DO BEM';
const VENDIDOS_EXCLUSIVE = {
  success: true,
  items: [
    vendido('JUjhJpfYQHZaVAx8DPYm', MAL, 'BUY_IT_NOW', 149, 'sZQGZLVUJrkUbddUgbYY', 'bombomzinho', '0Btd', 149, 1, 149, 1791056875.031),
    vendido('sPTovWCrISQCE7PrEewy', MAL, 'BUY_IT_NOW', 149, '7Gfs2PmkQNU6skvclTge', 'clubpokecard', 'qUCS', 149, 1, 149, 1791056869.963),
    vendido('t6uoHwJQMqnGWG7sqzNB', MAL, 'BUY_IT_NOW', 149, 'b9dIr7vpkiGyzUIl90kp', 'israelbrito', '8wzV', 149, 1, 149, 1791056869.255),
    vendido('B4nOL0716U8kVSmszPqv', MAL, 'BUY_IT_NOW', 149, 'DqriU5iQmg7lnctOCyLo', 'clubpokecard', 'qUCS', 149, 1, 149, 1791055828.251),
    vendido('sWsTd9TbU39a9hwbg9eP', MAL, 'BUY_IT_NOW', 149, 'OqNjnrHGMzziCFYpoYGR', 'bombomzinho', '0Btd', 149, 1, 149, 1791055787.39),
    vendido('ne5Dr6CyvYDEFMzgtFsg', MAL, 'BUY_IT_NOW', 149, 'Lc3SC5Eqi94Zw5rzZpHR', 'luskatcg', 'SNZ1', 149, 1, 149, 1791054000.695),
    vendido('ceMTzshgjBrvtQGA1FRC', MAL, 'BUY_IT_NOW', 149, 'UYzaL714N1Sib6v3k7uY', 'clubpokecard', 'qUCS', 149, 1, 149, 1791053190.036),
    vendido('CFHZsFcSLGzTkdaWZLJm', BEM, 'BUY_IT_NOW', 149, 'Hp4QRRMAGUXo1PAp6yyi', 'israelbrito', '8wzV', 149, 3, 447, 1791051720.778),
    vendido('lJGvD05C9vuWZ3YjKWll', BEM, 'BUY_IT_NOW', 149, 'iKKBUobhcp6uYe3fuy6I', 'drico3dlab', 'O4a5', 149, 1, 149, 1791049691.416),
    vendido('wYTVxvYzCBdm0WEkOj1S', BEM, 'BUY_IT_NOW', 149, 'uBEhC4tW0CaHPfifk5jC', 'bombomzinho', '0Btd', 149, 1, 149, 1791049251.895),
  ],
  hasNextPage: false,
};

module.exports = { VENDIDOS_PAGINA_1, VENDIDOS_PAGINA_2, BATALHA_PARTICIPANTES, VENDIDOS_EXCLUSIVE };
