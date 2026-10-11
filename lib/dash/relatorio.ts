import { porProduto, rankingCompradores, resumoVendas, type Venda } from "@/lib/dash/calculos";

// Os relatórios em PDF, iguais aos do Dash TCG: o "Relatório da live" e o
// "Relatório do período". Aqui só as contas (testáveis sem navegador); o
// desenho do PDF fica em lib/dash/pdf.ts.
//
// O que entra em cada um, na ordem do Dash TCG:
//   - faixa do topo (título, live, datas, link, hora em que foi gerado);
//   - 8 números com a borda colorida e 3 destaques com imagem;
//   - (período) Lives do período;
//   - Vendidos por produto (só vendas pagas), Ranking de compradores (pago +
//     pendente), Emotions por ícone, Pontos por usuário, Ganhadores dos
//     sorteios;
//   - (live) Todas as vendas.

export type LiveDoRelatorio = {
  showId: string;
  vendedor: string | null;
  titulo: string | null;
  inicio: number | null;
  fim: number | null;
  codigo: string | null;
  emocoes: number;
};

// Emotions já somadas por pessoa e ícone (a live inteira cabe numa lista
// pequena assim, mesmo um período com dezenas de milhares de envios).
export type EmocaoSomada = { handle: string; icone: string; qtd: number; gemas: number };

export type GanhadorDoRelatorio = {
  ts: number;
  vendedor: string | null;
  regra: string;
  premio: string | null;
  handle: string;
  presente: boolean | null;
  status: string;
};

export type VendaDoRelatorio = Venda & { showId: string };

export type EntradaRelatorio = {
  tipo: "live" | "periodo";
  conta: string;
  lives: LiveDoRelatorio[];
  vendas: VendaDoRelatorio[];
  emocoes: EmocaoSomada[];
  ganhadores: GanhadorDoRelatorio[];
  icones: Record<string, { url: string | null; nome: string | null }>;
  // Período pedido (milissegundos); de = 0 é "desde o começo".
  periodo?: { de: number; ate: number };
};

export type Cor = "verde" | "laranja" | "vermelho" | "marca" | "azul";
export type Kpi = { rotulo: string; valor: string; sub: string; cor: Cor };
export type Destaque = { rotulo: string; cor: Cor; titulo: string; sub: string; imagem: string | null } | null;

export type Relatorio = {
  tipo: "live" | "periodo" | "clientes";
  // Faixa do topo.
  nome: string; // "Relatório da live" | "Relatório do período"
  subtitulo: string; // o título da live | "todo o histórico salvo" | "01/10/2026 a 11/10/2026"
  info: string; // "@israelbrito • 09/10/2026, 20:42 – 10/10/2026, 04:29 • jamble.com/s/x • Gerado em ..."
  // O que vai no topo das outras páginas e no rodapé.
  cabecalho: string; // "Relatório da live · @israelbrito"
  rodape: string; // "Dash Village · Relatório da live · @israelbrito · gerado em ..."
  arquivo: string;
  kpis: Kpi[];
  destaques: [Destaque, Destaque, Destaque];
  lives: { data: string; vendedor: string; titulo: string; vendido: number; itens: number; compradores: number; emocoes: number }[];
  produtos: { imagem: string | null; titulo: string; qtd: number; total: number; medio: number; compradores: number; pct: string }[];
  compradores: { posicao: number; handle: string; itens: number; pago: number; pendente: number; total: number; pct: string }[];
  icones: { icone: string; imagem: string | null; qtd: number; pontos: number; pct: string }[];
  pontos: { posicao: number; handle: string; emocoes: number; pontos: number; pct: string }[];
  ganhadores: { quando: string; vendedor: string; regra: string; premio: string; handle: string; naLive: string; situacao: string }[];
  vendas: { hora: string; titulo: string; comprador: string; tipo: string; qtd: number; valor: number; status: string }[];
  // Só no relatório de clientes.
  clientes?: { posicao: number; handle: string; pago: number; pendente: number; itens: number; compras: number; lives: number; primeira: string; ultima: string }[];
  notas: { produtos: string; compradores: string; icones: string; pontos: string };
};

// ---------- formatos (sempre no horário de Brasília) ----------

const FUSO = "America/Sao_Paulo";
const partes = (ts: number) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ts))
      .map((x) => [x.type, x.value]),
  );
  return p as Record<"day" | "month" | "year" | "hour" | "minute", string>;
};
export const dataHoraBR = (ts: number) => {
  const p = partes(ts);
  return `${p.day}/${p.month}/${p.year}, ${p.hour}:${p.minute}`;
};
export const dataBR = (ts: number) => {
  const p = partes(ts);
  return `${p.day}/${p.month}/${p.year}`;
};
export const diaHoraBR = (ts: number) => {
  const p = partes(ts);
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};
export const horaBR = (ts: number) => {
  const p = partes(ts);
  return `${p.hour}:${p.minute}`;
};
export const reaisBR = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
export const inteiroBR = (n: number) => Math.round(n).toLocaleString("pt-BR");
// "36,8%", "3%", "0%": no máximo uma casa, sem ",0".
export const pctBR = (parte: number, todo: number) =>
  `${(todo > 0 ? (parte / todo) * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;

const semArroba = (h: unknown) => String(h ?? "").replace(/^@/, "").trim();
const arroba = (h: unknown) => (semArroba(h) ? `@${semArroba(h)}` : "—");

// Leilão e morte súbita são leilões; o resto é compra direta.
export const tipoDeVenda = (t: string | null | undefined) => (/AUCTION|SUDDEN|leil/i.test(String(t ?? "")) ? "Leilão" : "Compra direta");
const statusDaVenda = (v: Venda) => (v.cancelado ? "Cancelada" : v.pago === false ? "Pendente" : "Paga");
const situacao = (s: string) => (s === "valido" ? "Ganhou" : s === "resorteado" ? "Trocado" : s ? s[0].toUpperCase() + s.slice(1) : "—");

// ---------- montagem ----------

export function montarRelatorio(e: EntradaRelatorio, geradoEm = Date.now()): Relatorio {
  const live = e.tipo === "live" ? e.lives[0] : null;
  const vendas = [...e.vendas].sort((a, b) => a.ts - b.ts);
  const r = resumoVendas(vendas);
  const canceladas = vendas.filter((v) => v.cancelado);
  const pendentes = vendas.filter((v) => !v.cancelado && v.pago === false);
  const pagas = vendas.filter((v) => !v.cancelado && v.pago !== false);

  // Emotions: por ícone e por pessoa.
  const porIcone = new Map<string, { qtd: number; gemas: number }>();
  const porPessoa = new Map<string, { emocoes: number; gemas: number }>();
  for (const x of e.emocoes) {
    const i = porIcone.get(x.icone) ?? { qtd: 0, gemas: 0 };
    i.qtd += x.qtd;
    i.gemas += x.gemas;
    porIcone.set(x.icone, i);
    const h = semArroba(x.handle);
    if (!h) continue;
    const p = porPessoa.get(h) ?? { emocoes: 0, gemas: 0 };
    p.emocoes += x.qtd;
    p.gemas += x.gemas;
    porPessoa.set(h, p);
  }
  const totalEmocoes = [...porIcone.values()].reduce((s, i) => s + i.qtd, 0);
  const totalPontos = [...porIcone.values()].reduce((s, i) => s + i.gemas, 0);
  const icones = [...porIcone.entries()]
    .map(([icone, i]) => ({ icone, imagem: e.icones[icone]?.url ?? null, qtd: i.qtd, pontos: i.gemas, pct: pctBR(i.gemas, totalPontos) }))
    .sort((a, b) => b.qtd - a.qtd || b.pontos - a.pontos);
  const pontos = [...porPessoa.entries()]
    .map(([handle, p]) => ({ handle, emocoes: p.emocoes, pontos: p.gemas }))
    .sort((a, b) => b.pontos - a.pontos || b.emocoes - a.emocoes)
    .map((p, i) => ({ posicao: i + 1, ...p, pct: pctBR(p.pontos, totalPontos) }));

  const produtos = porProduto(vendas, true).map((p) => ({
    imagem: p.imagem,
    titulo: p.titulo,
    qtd: p.qtd,
    total: p.total,
    medio: p.medio,
    compradores: p.compradores,
    pct: pctBR(p.total, r.pago),
  }));
  const compradores = rankingCompradores(vendas).map((c, i) => ({
    posicao: i + 1,
    handle: c.handle,
    itens: c.itens,
    pago: c.pago,
    pendente: Math.max(0, c.total - c.pago),
    total: c.total,
    pct: pctBR(c.total, r.total),
  }));
  const ganhadores = [...e.ganhadores]
    .sort((a, b) => a.ts - b.ts)
    .map((g) => ({
      quando: e.tipo === "live" ? horaBR(g.ts) : diaHoraBR(g.ts),
      vendedor: arroba(g.vendedor),
      regra: g.regra || "—",
      premio: g.premio || "—",
      handle: arroba(g.handle),
      naLive: g.presente === true ? "Sim" : g.presente === false ? "Não" : "—",
      situacao: situacao(g.status),
    }));
  const validos = e.ganhadores.filter((g) => g.status === "valido").length;

  const ticket = r.compradores ? r.total / r.compradores : 0;
  const vendedores = new Set(e.lives.map((l) => semArroba(l.vendedor)).filter(Boolean));
  const kpis: Kpi[] =
    e.tipo === "live"
      ? [
          { rotulo: "Total vendido", valor: reaisBR(r.total), sub: "sem canceladas", cor: "verde" },
          { rotulo: "Pago", valor: reaisBR(r.pago), sub: `${inteiroBR(pagas.length)} vendas · ${pctBR(r.pago, r.total)}`, cor: "verde" },
          { rotulo: "Pendente", valor: reaisBR(r.pendente), sub: `${inteiroBR(pendentes.length)} vendas`, cor: "laranja" },
          { rotulo: "Cancelado", valor: reaisBR(canceladas.reduce((s, v) => s + (v.total || 0), 0)), sub: `${inteiroBR(canceladas.length)} vendas`, cor: "vermelho" },
          { rotulo: "Itens vendidos", valor: inteiroBR(r.itens), sub: `${inteiroBR(r.vendas)} vendas`, cor: "marca" },
          { rotulo: "Compradores", valor: inteiroBR(r.compradores), sub: `ticket médio ${reaisBR(ticket)}`, cor: "marca" },
          { rotulo: "Emotions", valor: inteiroBR(totalEmocoes), sub: `${inteiroBR(totalPontos)} pontos · ${inteiroBR(porPessoa.size)} pessoas`, cor: "azul" },
          { rotulo: "Sorteios", valor: inteiroBR(validos), sub: "ganhadores", cor: "azul" },
        ]
      : [
          { rotulo: "Total vendido", valor: reaisBR(r.total), sub: "sem canceladas", cor: "verde" },
          { rotulo: "Pago", valor: reaisBR(r.pago), sub: pctBR(r.pago, r.total), cor: "verde" },
          { rotulo: "Lives", valor: inteiroBR(e.lives.length), sub: `${inteiroBR(vendedores.size)} vendedores`, cor: "marca" },
          { rotulo: "Itens vendidos", valor: inteiroBR(r.itens), sub: `${inteiroBR(r.vendas)} vendas`, cor: "marca" },
          { rotulo: "Compradores únicos", valor: inteiroBR(r.compradores), sub: `ticket médio ${reaisBR(ticket)}`, cor: "marca" },
          { rotulo: "Pendente", valor: reaisBR(r.pendente), sub: `${inteiroBR(pendentes.length)} vendas`, cor: "laranja" },
          { rotulo: "Emotions", valor: inteiroBR(totalEmocoes), sub: `${inteiroBR(totalPontos)} pontos`, cor: "azul" },
          { rotulo: "Sorteios", valor: inteiroBR(validos), sub: "ganhadores", cor: "azul" },
        ];

  const topo = produtos[0];
  const maior = compradores[0];
  const quemMais = pontos[0];
  const destaques: Relatorio["destaques"] = [
    topo ? { rotulo: "Mais vendido", cor: "verde", titulo: topo.titulo, sub: `${inteiroBR(topo.qtd)} un. · ${reaisBR(topo.total)}`, imagem: topo.imagem } : null,
    maior ? { rotulo: "Maior comprador", cor: "marca", titulo: `@${maior.handle}`, sub: `${reaisBR(maior.total)} · ${inteiroBR(maior.itens)} itens`, imagem: null } : null,
    quemMais
      ? { rotulo: "Mais pontos", cor: "azul", titulo: `@${quemMais.handle}`, sub: `${inteiroBR(quemMais.pontos)} pts · ${inteiroBR(quemMais.emocoes)} emotions`, imagem: icones[0]?.imagem ?? null }
      : null,
  ];

  const gerado = dataHoraBR(geradoEm);
  let nome: string, subtitulo: string, info: string, cabecalho: string, arquivo: string;
  if (live) {
    const fim = live.fim ?? (vendas.length ? vendas[vendas.length - 1].ts : null);
    const quando = live.inicio ? `${dataHoraBR(live.inicio)}${fim && fim > live.inicio ? ` – ${dataHoraBR(fim)}` : ""}` : null;
    const link = live.codigo ? `jamble.com/s/${live.codigo}` : live.vendedor ? `jamble.com/live/${semArroba(live.vendedor)}/${live.showId}` : null;
    nome = "Relatório da live";
    subtitulo = live.titulo || "Live";
    info = [arroba(live.vendedor), quando, link, `Gerado em ${gerado}`].filter(Boolean).join(" • ");
    cabecalho = `Relatório da live · ${arroba(live.vendedor)}`;
    arquivo = `relatorio-live-${live.codigo || live.showId}.pdf`;
  } else {
    const de = e.periodo?.de ?? 0;
    const ate = e.periodo?.ate ?? geradoEm;
    // "Até" vem como o fim do dia (exclusivo): mostra o dia anterior ao limite.
    const ultimoDia = Math.min(ate, geradoEm) - 1;
    nome = "Relatório do período";
    subtitulo = de > 0 ? `${dataBR(de)} a ${dataBR(ultimoDia)}` : "todo o histórico salvo";
    info = [`${inteiroBR(e.lives.length)} lives`, `${inteiroBR(vendedores.size)} vendedores`, `Gerado em ${gerado}`].join(" • ");
    cabecalho = `Relatório do período · ${subtitulo}`;
    arquivo = de > 0 ? `relatorio-periodo-${dataBR(de).replace(/\//g, "-")}-a-${dataBR(ultimoDia).replace(/\//g, "-")}.pdf` : "relatorio-periodo-tudo.pdf";
  }

  // Vendas e itens por live (para a tabela "Lives do período").
  const porLive = new Map<string, { vendido: number; itens: number; compradores: Set<string> }>();
  for (const v of vendas) {
    if (v.cancelado) continue;
    const l = porLive.get(v.showId) ?? { vendido: 0, itens: 0, compradores: new Set<string>() };
    l.vendido += v.total || 0;
    l.itens += v.quantidade || 1;
    if (v.comprador) l.compradores.add(semArroba(v.comprador));
    porLive.set(v.showId, l);
  }

  return {
    tipo: e.tipo,
    nome,
    subtitulo,
    info,
    cabecalho,
    rodape: `Dash Village · ${cabecalho} · gerado em ${gerado}`,
    arquivo,
    kpis,
    destaques,
    lives:
      e.tipo === "periodo"
        ? [...e.lives]
            .sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0))
            .map((l) => {
              const x = porLive.get(l.showId);
              return {
                data: l.inicio ? diaHoraBR(l.inicio) : "—",
                vendedor: arroba(l.vendedor),
                titulo: l.titulo || "Live",
                vendido: x?.vendido ?? 0,
                itens: x?.itens ?? 0,
                compradores: x?.compradores.size ?? 0,
                emocoes: l.emocoes,
              };
            })
        : [],
    produtos,
    compradores,
    icones,
    pontos,
    ganhadores,
    vendas:
      e.tipo === "live"
        ? vendas.map((v) => ({
            hora: horaBR(v.ts),
            titulo: v.titulo || "(sem nome)",
            comprador: arroba(v.comprador),
            tipo: tipoDeVenda(v.tipo),
            qtd: v.quantidade || 1,
            valor: v.total || 0,
            status: statusDaVenda(v),
          }))
        : [],
    notas: {
      produtos: e.tipo === "live" ? "só vendas pagas" : "todas as lives · só vendas pagas",
      compradores: e.tipo === "live" ? "pago + pendente" : "todas as lives",
      icones: `${inteiroBR(totalEmocoes)} emotions · ${inteiroBR(totalPontos)} pontos`,
      pontos: "todas as emotions",
    },
  };
}

// ---------- clientes ----------
//
// "Clientes de @conta", como o PDF de clientes do Dash TCG: total pago,
// clientes, itens e média por cliente; os 3 maiores; o ranking pelo total pago.

export type ClienteDoRelatorio = { comprador: string; pago: number; pendente: number; itens: number; compras: number; lives: number; primeira: number; ultima: number };

export function montarRelatorioClientes(
  e: { conta: string; clientes: ClienteDoRelatorio[]; lives: number; periodo?: { de: number; ate: number } },
  geradoEm = Date.now(),
): Relatorio {
  const lista = [...e.clientes].sort((a, b) => b.pago - a.pago || b.itens - a.itens);
  const pago = lista.reduce((s, c) => s + c.pago, 0);
  const pendente = lista.reduce((s, c) => s + c.pendente, 0);
  const itens = lista.reduce((s, c) => s + c.itens, 0);
  const fieis = lista.filter((c) => c.lives >= 2).length;
  const de = e.periodo?.de ?? 0;
  const ate = e.periodo?.ate || geradoEm;
  const subtitulo = de > 0 ? `${dataBR(de)} a ${dataBR(Math.min(ate, geradoEm) - 1)}` : "todo o histórico salvo";
  const gerado = dataHoraBR(geradoEm);
  const nome = `Clientes de @${semArroba(e.conta)}`;
  const cabecalho = `${nome} · ${subtitulo}`;
  const destaque = (i: number, cor: Cor): Destaque => {
    const c = lista[i];
    return c ? { rotulo: `${i + 1}º cliente`, cor, titulo: `@${semArroba(c.comprador)}`, sub: `${reaisBR(c.pago)} · ${inteiroBR(c.itens)} itens · ${inteiroBR(c.lives)} lives`, imagem: null } : null;
  };
  return {
    tipo: "clientes",
    nome,
    subtitulo,
    info: [`${inteiroBR(e.lives)} lives`, `${inteiroBR(lista.length)} clientes`, `Gerado em ${gerado}`].join(" • "),
    cabecalho,
    rodape: `Dash Village · ${cabecalho} · gerado em ${gerado}`,
    arquivo: de > 0 ? `clientes-${dataBR(de).replace(/\//g, "-")}.pdf` : "clientes-tudo.pdf",
    kpis: [
      { rotulo: "Total pago", valor: reaisBR(pago), sub: `+ ${reaisBR(pendente)} pendente`, cor: "verde" },
      { rotulo: "Clientes", valor: inteiroBR(lista.length), sub: `${inteiroBR(fieis)} compraram em 2+ lives`, cor: "marca" },
      { rotulo: "Itens", valor: inteiroBR(itens), sub: `${inteiroBR(e.lives)} lives`, cor: "marca" },
      { rotulo: "Média por cliente", valor: reaisBR(lista.length ? pago / lista.length : 0), sub: "total pago ÷ clientes", cor: "azul" },
    ],
    destaques: [destaque(0, "marca"), destaque(1, "azul"), destaque(2, "verde")],
    lives: [],
    produtos: [],
    compradores: [],
    icones: [],
    pontos: [],
    ganhadores: [],
    vendas: [],
    clientes: lista.map((c, i) => ({
      posicao: i + 1,
      handle: semArroba(c.comprador),
      pago: c.pago,
      pendente: c.pendente,
      itens: c.itens,
      compras: c.compras,
      lives: c.lives,
      primeira: c.primeira ? dataBR(c.primeira) : "—",
      ultima: c.ultima ? dataBR(c.ultima) : "—",
    })),
    notas: { produtos: "", compradores: "ordenado pelo total pago", icones: "", pontos: "" },
  };
}

// O PDF usa as fontes padrão (Helvetica), que só têm o alfabeto latino:
// emoji e bandeiras saem do texto (como no Dash TCG).
export function textoDoPdf(s: unknown) {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/[^ -~ -ÿ–—‘’“”•…€]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
