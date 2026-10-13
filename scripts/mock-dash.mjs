// Monta um Dash de mentira para olhar as telas logadas no servidor local:
// grava respostas de exemplo da API em <site>/public/__mock/ e um service
// worker em <site>/public/__mock-sw.js que responde /api/dash/* com elas.
// Os horários ficam como {"$t": deslocamento} e viram Date.now()+deslocamento
// na hora (o "robô online" não envelhece).
// Uso (na pasta do site): node scripts/mock-dash.mjs      (apagar: node scripts/mock-dash.mjs --apagar)
//
// Depois, com o servidor local (npx next dev), no console do navegador em
// localhost: registrar /__mock-sw.js e pôr uma sessão falsa do Supabase no
// localStorage (sb-<projeto>-auth-token, access_token qualquer, expires_at no
// futuro) e recarregar. Nada disso sai do computador: public/__mock e o
// service worker estão no .gitignore.
import fs from "node:fs";
import path from "node:path";

const flag = process.argv[2];
const site = process.cwd();
const pub = path.join(site, "public");
const dir = path.join(pub, "__mock");
if (flag === "--apagar") {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(path.join(pub, "__mock-sw.js"), { force: true });
  console.log("apagado");
  process.exit(0);
}
fs.mkdirSync(dir, { recursive: true });
const T = (ms) => ({ $t: ms });
const MIN = 60e3;
const salvar = (nome, dados) => fs.writeFileSync(path.join(dir, nome), JSON.stringify(dados));

const IMG = "https://jamble.b-cdn.net/products/user_id=8wzVnl8IpOhixyX23yNplYK3XGn2/product_id=";
const prods = [
  ["Triplo 30th 🇺🇸", IMG + "AlxzkF2rnBmPHW0Sawys/525a4954-72d7-4dec-bbc9-897f0ec2a209.png", 265, "AUCTION"],
  ["CASE TRIPLO", IMG + "tiK9MQbmufBB903wuBjU/02342d5a-f9cd-40ed-a8d5-48665e49b50b.png", 3136, "AUCTION"],
  ["Binder Colection 30th🇺🇸", IMG + "E9p645pwO0hg8KtO4Iu1/9b6f1ebf-f9a9-4f7f-beee-e26ef291eeda.png", 646, "AUCTION"],
  ["Batalha ETB 2", IMG + "X6Ai35Ng1OU7Dts6UKhf/49fe174a-2002-4089-a131-424b178d662b.png", 140, "BUY_IT_NOW"],
  ["Frete bulk", IMG + "ddRrijfKyogToW8hQ7Wr/5eeb745b-2fbb-4b27-8a2b-c21bf1302c33.png", 5, "BUY_IT_NOW"],
];
const nomes = "dbfdmello ravanello edumarques nathancosta lucaspetmar jmlm almirgralha izaalmeida89 exclusive hugo_lee_013 kingdarkx bombomzinho mariodogtv natalytata jonatassmoura kaique2807 marinho lluizmishima ewertonberro lucasarj reservatcgbr caiotcg missaomasterset drico3dlab lucasliratcg alphatcg mago_tcg shundi hummelcs cavantcg".split(" ");
const icones = { pixel_heart: 10, snorlax: 20, magikarp_shiny: 500, pokeball: 20, battle: 10, charmander: 60, magikarp: 70, pop_sticker: 10, flash: 20, masterball: 250 };
const urlIcone = (i) => `https://jamble-test.b-cdn.net/like_icons/${i}.png`;
const DUR = 180 * MIN; // a live começou há 3 h

const vendas = Array.from({ length: 60 }, (_, i) => {
  const [titulo, imagem, preco, tipo] = prods[i % 7 < 4 ? 0 : i % 7 === 4 ? 3 : i % 5];
  const qtd = tipo === "BUY_IT_NOW" ? 1 + (i % 3) : 1;
  return { id: `v${i}`, titulo, imagem, comprador: nomes[(i * 7) % nomes.length], foto: null, preco, quantidade: qtd, total: preco * qtd, tipo, pago: i % 13 !== 4, cancelado: i === 17, ts: T(-DUR + i * 3 * MIN) };
});
const emocoes = [];
for (let i = 0; i < 420; i++) {
  const ic = Object.keys(icones)[(i * 3 + (i % 7)) % 10];
  emocoes.push({ id: `e${i}`, handle: nomes[(i * 11) % 24], nome: null, foto: null, icone: ic, gemas: icones[ic], time: null, ts: T(-DUR + i * 25e3) });
}
const chat = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, handle: nomes[(i * 5) % nomes.length], nome: null, foto: null, texto: ["boa noite!", "🐟🐟", "quanto o triplo?", "vamo que vamo", "manda o case"][i % 5], ts: T(-50 * MIN + i * MIN) }));
const live = {
  showId: "TESTE1",
  vendedor: "israelbrito",
  vendedorFoto: null,
  titulo: "LIVE DE TESTE 🇺🇸 — ETB 30TH",
  capa: null,
  inicio: T(-DUR),
  fim: null,
  aoVivo: true,
  audiencia: 37,
  pico: 52,
  likes: 1200,
  metricas: {
    faturamento: 0,
    assistindo: nomes.slice(0, 26).concat(["so_olhando_1", "so_olhando_2", "visitante_tcg", "colecionador_rj"]).map((h) => ({ handle: h, foto: null })),
    assistindoTotal: 37,
    assistindoEm: T(-40e3),
    robo: true,
  },
  participacao: [],
  leilao: { id: "L1", titulo: "Triplo 30th", tipo: "AUCTION", inicial: 200, melhor: 280, vencedor: "ravanello", lances: 12, disputaram: 5, termina: T(25e3), situacao: "rolando" },
  batalha: null,
  vistoEm: T(-5e3),
};
const regraEmocao = { tipo: "sorteio", quem: "emocao", icones: null, liberacao: "metas", metas: { emocoes: 100 }, chance: "quantidade", repetir: true, excluirSuspeitos: true, excluir: [] };
const sorteios = [
  {
    id: "s1", nome: "Sorteio para todos que enviaram emotions", premio: "1 Booster 30th Inglês", fonte: "emocoes", peso: "quantidade", repetir: true, excluirSuspeitos: true, excluir: [], modo: "meta", aCada: 100, ativo: true, ordem: 0, criadoEm: T(-DUR), regra: regraEmocao,
    ganhadores: [0, 1, 2].map((k) => ({ id: `g${k}`, handle: nomes[k * 4], foto: null, bilhetes: 10 + k, totalBilhetes: 300, participantes: 20, marco: k + 1, status: "valido", presente: k === 1 ? false : null, ts: T(-DUR + (k + 1) * 40 * MIN) })),
  },
  { id: "s2", nome: "Compradores da noite", premio: "1 Triplo Tech Sticker", fonte: "compradores", peso: "igual", repetir: false, excluirSuspeitos: true, excluir: [], modo: "livre", aCada: null, ativo: true, ordem: 1, criadoEm: T(-DUR), regra: { ...regraEmocao, quem: "compra", liberacao: "livre", metas: {}, chance: "igual", repetir: false }, ganhadores: [] },
];
const ranking = { ts: T(-10 * MIN), mes: "2026-10", pontos: 1464175, posicao: 5, acima: { handle: "japexz", posicao: 4, pontos: 1500000 }, abaixo: { handle: "amoeba", posicao: 6, pontos: 1400000 }, lista: [], regras: { porReal: 3, porGema: 2 } };
const iconesMap = Object.fromEntries(Object.entries(icones).map(([i, g]) => [i, { url: urlIcone(i), nome: null, gemas: g }]));

salvar("live.json", { live, emocoes, chat, vendas, vendasSig: "60:x", ranking, sorteios, metas: [], termos: "magikarp_shiny", icones: iconesMap, souVendedor: true, podeEditar: true, conta: "israelbrito", agora: T(0) });
const outra = { ...live, showId: "OUTRA1", vendedor: "japexz", titulo: "MEGA BATALHA 30 ANOS", audiencia: 18, metricas: { robo: true }, leilao: null, vistoEm: T(-30e3) };
salvar("eu.json", {
  membro: { email: "teste@exemplo.com", conta: "israelbrito", papel: "dono", recursos: [] },
  config: { telaChave: "0".repeat(36), termosCarpa: "magikarp_shiny", preferencias: {} },
  live,
  outras: [outra],
  ranking,
  extensaoVistaEm: T(-12 * MIN),
  robo: { rodouEm: T(-20e3), ativos: 2 },
});
salvar("monitor.json", {
  monitores: [
    { id: "00000000-0000-0000-0000-000000000001", showId: "OUTRA1", vendedor: "japexz", titulo: "MEGA BATALHA 30 ANOS", ativo: true, automatico: false, criadoEm: T(-40 * MIN), ate: T(13 * 3600e3), ultimoCiclo: T(-35e3), ultimoErro: null },
    { id: "00000000-0000-0000-0000-000000000002", showId: "PARADA1", vendedor: "pernambuco", titulo: "AVULSAS E MAIS 🔥", ativo: false, automatico: false, criadoEm: T(-5 * 3600e3), ate: T(-3600e3), ultimoCiclo: T(-3600e3), ultimoErro: null },
    { id: "00000000-0000-0000-0000-000000000003", showId: "TESTE1", vendedor: "israelbrito", titulo: "LIVE DE TESTE", ativo: true, automatico: true, criadoEm: T(-DUR), ate: T(11 * 3600e3), ultimoCiclo: T(-15e3), ultimoErro: null },
  ],
  robo: { rodouEm: T(-20e3), terminouEm: T(-5e3), erro: null },
});
const lives = Array.from({ length: 11 }, (_, i) => ({ showId: i ? `L${i}` : "TESTE1", titulo: i ? ["COMBO DE BOOSTER NO PRECINHO", "SURPRISE PACK - ETB 30TH 🇺🇸", "ASCENDED HEROES"][i % 3] : live.titulo, vendedor: i === 3 ? "japexz" : "israelbrito", vendedorFoto: null, inicio: T(-i * 2 * 86400e3 - DUR), aoVivo: i === 0, total: 20000 + i * 1234, pago: 19000 + i * 1000, itens: 60 + i, vendas: 50 + i, compradores: 20 + i, emocoes: i < 6 ? 3000 - i * 300 : 0, gemas: 100000, ganhadores: 5 }));
salvar("lives.json", { lives });
const vendasRel = vendas.map((v) => ({ ...v, showId: "TESTE1" }));
const emocoesRel = Object.values(
  emocoes.reduce((m, e) => {
    const k = e.handle + "|" + e.icone;
    m[k] = m[k] ?? { handle: e.handle, icone: e.icone, qtd: 0, gemas: 0 };
    m[k].qtd++;
    m[k].gemas += e.gemas;
    return m;
  }, {}),
);
const ganhRel = sorteios[0].ganhadores.map((g) => ({ ts: g.ts, vendedor: "israelbrito", regra: sorteios[0].nome, premio: sorteios[0].premio, handle: g.handle, presente: g.presente, status: g.status }));
const iconesRel = Object.fromEntries(Object.keys(icones).map((i) => [i, { url: urlIcone(i), nome: null }]));
const vivo = { showId: "TESTE1", vendedor: "israelbrito", titulo: live.titulo, inicio: T(-DUR), fim: null, codigo: "nhdcnknm", emocoes: emocoes.length };
salvar("relatorio-live.json", { tipo: "live", conta: "israelbrito", lives: [vivo], vendas: vendasRel, emocoes: emocoesRel, ganhadores: ganhRel, icones: iconesRel });
salvar("relatorio-periodo.json", { tipo: "periodo", conta: "israelbrito", lives: [vivo, { ...vivo, showId: "L1", titulo: "COMBO DE BOOSTER NO PRECINHO", inicio: T(-5 * 86400e3), codigo: null }], vendas: vendasRel, emocoes: emocoesRel, ganhadores: ganhRel, icones: iconesRel, periodo: { de: 0, ate: 0 } });
salvar("clientes.json", { clientes: nomes.slice(0, 20).map((c, i) => ({ comprador: c, foto: null, total: 5000 - i * 200, pago: 4800 - i * 200, pendente: i % 4 ? 0 : 200, itens: 10 - (i % 9), compras: 8 - (i % 7), lives: 1 + (i % 5), primeira: T(-30 * 86400e3), ultima: T(-i * 86400e3) })) });
const mesesRanking = [
  { mes: "2026-10", total: 699, atualizadoEm: T(-5 * MIN), temPontos: true },
  { mes: "2026-09", total: 0, atualizadoEm: null, temPontos: false },
];
const leitura = { vendedoresLidos: 120, vendedores: 699, livesPendentes: 840, ultimaRodada: T(-20e3) };
const vendedor = (h, i, pontos) => ({
  id: `id${i}`,
  posicao: i + 1,
  handle: i === 4 ? "israelbrito" : h,
  foto: null,
  pontos,
  recompensado: i < 3,
  vendido: i === 7 ? null : 180000 - i * 9000 + (i % 3) * 7000,
  itens: 300 - i * 10,
  lives: 4 + (i % 9),
  pendentes: i % 5 === 1 ? 2 : 0,
  parcialDesde: i % 4 === 0 && i !== 4 ? T(-12 * 86400e3) : null,
  lido: i !== 7,
});
salvar("ranking-jamble.json", { meses: mesesRanking, mes: "2026-10", temPontos: true, conta: "israelbrito", leitura, lista: nomes.slice(0, 15).map((h, i) => vendedor(h, i, 3000000 - i * 150000)) });
// "Sortear": o ganhador e a lista da roleta (o id muda a cada vez, pelo relógio).
salvar("sortear.json", {
  sorteios,
  ganhador: { id: T(0), handle: "edumarques", foto: null, bilhetes: 18 },
  roleta: nomes.slice(0, 24).map((h, i) => ({ handle: h, foto: null, bilhetes: 1 + (i % 6) })),
});
salvar("ranking-jamble-09.json", { meses: mesesRanking, mes: "2026-09", temPontos: false, conta: "israelbrito", leitura, lista: nomes.slice(0, 15).map((h, i) => vendedor(h, i, null)) });

// Faturamento Jamble: vendedores e compradores do mês.
const baseFat = { meses: ["2026-10", "2026-09"], mes: "2026-10", conta: "israelbrito", atualizadoEm: T(-40e3) };
salvar("faturamento-vendedores.json", {
  ...baseFat,
  aba: "vendedores",
  temPontos: true,
  total: 4709574.4,
  vendedores: nomes.slice(0, 30).map((h, i) => {
    const vendido = 205031 - i * 6500;
    const lives = 4 + (i % 8);
    return { id: `v${i}`, handle: i === 3 ? "israelbrito" : h, foto: null, vendido, vendas: 300 + i * 7, itens: 320 + i * 7, lives, porLive: vendido / lives, posicaoPontos: ((i * 7) % 30) + 1, pontos: 1000000 - i * 9000, parcialDesde: null, noAr: i === 11, pendentes: 0 };
  }),
});
salvar("faturamento-compradores.json", {
  ...baseFat,
  aba: "compradores",
  livesFaltando: 1200,
  compradores: nomes.slice(0, 30).map((h, i) => ({ chave: `c${i}`, handle: h, foto: null, total: 52354.58 - i * 1500, compras: 230 - i * 5, itens: 240 - i * 5, vendedores: 15 - (i % 10), lives: 30 - i, onde: nomes[(i + 5) % nomes.length], ondeValor: 15614.7 - i * 300, comigo: i % 4 === 1 ? 4159 - i * 50 : 0, ultima: T(-i * 3600e3) })),
});

fs.writeFileSync(
  path.join(pub, "__mock-sw.js"),
  `// Service worker de teste (só no servidor local): responde a API do Dash com os exemplos de /__mock.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
const agora = (o) => Array.isArray(o) ? o.map(agora) : o && typeof o === "object" ? ("$t" in o && Object.keys(o).length === 1 ? Date.now() + o.$t : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, agora(v)]))) : o;
const arquivo = (u, metodo) => {
  const p = u.pathname;
  if (metodo === "POST" && p.startsWith("/api/dash/sorteios/")) return "sortear.json";
  if (metodo !== "GET") return null;
  if (p === "/api/dash/eu") return "eu.json";
  if (p === "/api/dash/monitor") return "monitor.json";
  if (p === "/api/dash/lives") return "lives.json";
  if (p.startsWith("/api/dash/live/")) return "live.json";
  if (p === "/api/dash/relatorio") return u.searchParams.get("show") ? "relatorio-live.json" : "relatorio-periodo.json";
  if (p === "/api/dash/clientes") return "clientes.json";
  if (p === "/api/dash/ranking-jamble") return u.searchParams.get("mes") === "2026-09" ? "ranking-jamble-09.json" : "ranking-jamble.json";
  if (p === "/api/dash/faturamento") return u.searchParams.get("aba") === "compradores" ? "faturamento-compradores.json" : "faturamento-vendedores.json";
  return null;
};
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith("/api/dash/")) return;
  const a = arquivo(u, e.request.method);
  e.respondWith(
    a
      ? fetch("/__mock/" + a, { cache: "no-store" }).then((r) => r.json()).then((j) => new Response(JSON.stringify(agora(j)), { headers: { "content-type": "application/json" } }))
      : new Response(JSON.stringify({ ok: true, showId: "TESTE1", acabou: false, comecou: true }), { headers: { "content-type": "application/json" } }),
  );
});
`,
);
console.log("ok", fs.readdirSync(dir).join(", "));
