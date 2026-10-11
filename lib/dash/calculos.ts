// Contas do Dash Village. Tudo aqui é puro (entra dado, sai número), para a
// API, as telas e os testes usarem exatamente as mesmas regras.

export type Emocao = {
  id: string;
  handle: string;
  nome?: string | null;
  foto?: string | null;
  icone: string;
  gemas: number;
  time?: string | null;
  ts: number;
};

export type Mensagem = {
  id: string;
  handle: string;
  nome?: string | null;
  foto?: string | null;
  texto: string;
  ts: number;
};

export type Venda = {
  id: string;
  titulo: string;
  imagem?: string | null;
  comprador?: string | null;
  foto?: string | null;
  preco: number;
  quantidade: number;
  total: number;
  tipo?: string | null;
  pago?: boolean | null;
  cancelado?: boolean | null;
  ts: number;
};

export const CARPA = "magikarp_shiny";

const semArroba = (h: unknown) => String(h ?? "").replace(/^@/, "").trim();

// ---------- emotions ----------

export function porIcone(emocoes: Emocao[]) {
  const m = new Map<string, { icone: string; qtd: number; gemas: number }>();
  for (const e of emocoes) {
    const i = m.get(e.icone) ?? { icone: e.icone, qtd: 0, gemas: 0 };
    i.qtd++;
    i.gemas += e.gemas || 0;
    m.set(e.icone, i);
  }
  return [...m.values()].sort((a, b) => b.qtd - a.qtd || b.gemas - a.gemas);
}

export type Pessoa = { handle: string; nome: string; foto: string | null };

function pessoaDe(m: Map<string, Pessoa>, handle: string, nome?: string | null, foto?: string | null) {
  const h = semArroba(handle);
  const p = m.get(h) ?? { handle: h, nome: nome || h, foto: foto || null };
  if (nome) p.nome = nome;
  if (foto) p.foto = foto;
  m.set(h, p);
  return p;
}

// "Pontos por usuário": as gemas que cada pessoa mandou nesta live.
export function pontosPorPessoa(emocoes: Emocao[]) {
  const m = new Map<string, Pessoa & { emocoes: number; gemas: number; icones: Record<string, number> }>();
  for (const e of emocoes) {
    const h = semArroba(e.handle);
    if (!h) continue;
    const p = m.get(h) ?? { handle: h, nome: e.nome || h, foto: e.foto || null, emocoes: 0, gemas: 0, icones: {} };
    if (e.foto) p.foto = e.foto;
    p.emocoes++;
    p.gemas += e.gemas || 0;
    p.icones[e.icone] = (p.icones[e.icone] ?? 0) + 1;
    m.set(h, p);
  }
  return [...m.values()].sort((a, b) => b.gemas - a.gemas || b.emocoes - a.emocoes);
}

// Termos da "carpa dourada": um id de emotion (magikarp_shiny) ou um texto que,
// escrito no chat, também conta (ex.: um emoji combinado com o público).
export function lerTermos(texto: string | null | undefined): string[] {
  const t = String(texto ?? "")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return t.length ? [...new Set(t)] : [CARPA];
}

export function rankingCarpas(emocoes: Emocao[], mensagens: Mensagem[], termos: string[]) {
  const icones = new Set(termos.filter((t) => /^[a-z0-9_]+$/.test(t)));
  const textos = termos.filter((t) => !/^[a-z0-9_]+$/.test(t)).map((t) => t.toLowerCase());
  const m = new Map<string, Pessoa & { carpas: number }>();
  const somar = (handle: string, nome?: string | null, foto?: string | null) => {
    const h = semArroba(handle);
    if (!h) return;
    const p = m.get(h) ?? { handle: h, nome: nome || h, foto: foto || null, carpas: 0 };
    if (foto) p.foto = foto;
    p.carpas++;
    m.set(h, p);
  };
  for (const e of emocoes) if (icones.has(e.icone)) somar(e.handle, e.nome, e.foto);
  if (textos.length) {
    for (const msg of mensagens) {
      const t = String(msg.texto ?? "").toLowerCase();
      if (textos.some((x) => t.includes(x))) somar(msg.handle, msg.nome, msg.foto);
    }
  }
  return [...m.values()].sort((a, b) => b.carpas - a.carpas);
}

// ---------- vendas ----------

export const vendasValidas = (vendas: Venda[]) => vendas.filter((v) => !v.cancelado);

export function resumoVendas(vendas: Venda[]) {
  const validas = vendasValidas(vendas);
  const total = validas.reduce((s, v) => s + (v.total || 0), 0);
  const pagas = validas.filter((v) => v.pago !== false);
  const pago = pagas.reduce((s, v) => s + (v.total || 0), 0);
  const compradores = new Set(validas.map((v) => semArroba(v.comprador)).filter(Boolean));
  return {
    vendas: validas.length,
    itens: validas.reduce((s, v) => s + (v.quantidade || 1), 0),
    total,
    pago,
    pendente: Math.max(0, total - pago),
    compradores: compradores.size,
    canceladas: vendas.length - validas.length,
  };
}

export function rankingCompradores(vendas: Venda[]) {
  const m = new Map<string, Pessoa & { itens: number; total: number; pago: number; compras: number }>();
  for (const v of vendasValidas(vendas)) {
    const h = semArroba(v.comprador);
    if (!h) continue;
    const p = m.get(h) ?? { handle: h, nome: h, foto: v.foto || null, itens: 0, total: 0, pago: 0, compras: 0 };
    if (v.foto) p.foto = v.foto;
    p.itens += v.quantidade || 1;
    p.total += v.total || 0;
    if (v.pago !== false) p.pago += v.total || 0;
    p.compras++;
    m.set(h, p);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function porProduto(vendas: Venda[], soPagas = true) {
  const m = new Map<string, { titulo: string; imagem: string | null; qtd: number; total: number; vendas: number; compradores: Set<string> }>();
  for (const v of vendasValidas(vendas)) {
    if (soPagas && v.pago === false) continue;
    const k = String(v.titulo ?? "").trim() || "(sem nome)";
    const p = m.get(k) ?? { titulo: k, imagem: v.imagem || null, qtd: 0, total: 0, vendas: 0, compradores: new Set<string>() };
    p.qtd += v.quantidade || 1;
    p.total += v.total || 0;
    p.vendas++;
    if (v.comprador) p.compradores.add(semArroba(v.comprador));
    m.set(k, p);
  }
  return [...m.values()]
    .map((p) => ({ ...p, compradores: p.compradores.size, medio: p.qtd ? p.total / p.qtd : 0 }))
    .sort((a, b) => b.total - a.total);
}

// ---------- engajamento ----------
//
// A Jamble não diz quem está assistindo, só quantos. Então quem conta é quem
// interagiu: mensagem, emotion ou compra. O "tempo ativo" vai da primeira à
// última interação.
export function engajamento(emocoes: Emocao[], mensagens: Mensagem[], vendas: Venda[]) {
  type L = Pessoa & { mensagens: number; emocoes: number; compras: number; primeira: number; ultima: number };
  const m = new Map<string, L>();
  const tocar = (handle: unknown, ts: number, nome?: string | null, foto?: string | null) => {
    const h = semArroba(handle);
    if (!h) return null;
    const p: L = m.get(h) ?? { handle: h, nome: nome || h, foto: foto || null, mensagens: 0, emocoes: 0, compras: 0, primeira: ts, ultima: ts };
    if (foto) p.foto = foto;
    if (nome) p.nome = nome;
    p.primeira = Math.min(p.primeira, ts);
    p.ultima = Math.max(p.ultima, ts);
    m.set(h, p);
    return p;
  };
  for (const x of mensagens) {
    const p = tocar(x.handle, x.ts, x.nome, x.foto);
    if (p) p.mensagens++;
  }
  for (const x of emocoes) {
    const p = tocar(x.handle, x.ts, x.nome, x.foto);
    if (p) p.emocoes++;
  }
  for (const x of vendasValidas(vendas)) {
    const p = tocar(x.comprador, x.ts, null, x.foto);
    if (p) p.compras++;
  }
  return [...m.values()]
    .map((p) => ({ ...p, ativoMs: Math.max(0, p.ultima - p.primeira) }))
    .sort((a, b) => b.mensagens - a.mensagens || b.ativoMs - a.ativoMs);
}

// ---------- contas suspeitas ----------
//
// Contas criadas em lote para juntar gema grátis seguem um molde: exatamente 15
// letras minúsculas (nome + duas letras soltas + sobrenome + sobra), sem número,
// e terminam num encontro de consoantes que nome de gente não tem. Na live de
// 09/10/2026 vieram, por exemplo, @tomasapoadamsxp, @louvenizgornqyv e
// @juliexjleuschkp, todas mandando carpas e nenhuma escrevendo no chat.
// É só um aviso: o painel mostra quem foi marcado, e dá para incluir de volta.
export function pareceRobo(handle: string, info?: { mensagens?: number; compras?: number }) {
  const h = semArroba(handle).toLowerCase();
  if (!/^[a-z]{15}$/.test(h)) return false;
  if ((info?.mensagens ?? 0) > 0 || (info?.compras ?? 0) > 0) return false;
  // Encontros de letras que nome de gente quase não tem: 4 consoantes
  // seguidas, ou pares como xp, qy, kp, kc, xz, xd, xj, hq, dp, vw.
  return /[bcdfghjklmnpqrstvwxz]{4,}/.test(h) || /(?:xp|qy|qv|kp|kc|xz|xd|xj|hq|dp|vw|ptt|pah|nw$|fy$)/.test(h);
}

// ---------- sorteios ----------

export type RegraSorteio = {
  fonte: string; // compradores | emocoes | emocao:<icone> | carpas | chat | gemas
  peso: "quantidade" | "igual";
  repetir: boolean;
  excluirSuspeitos: boolean;
  excluir: string[];
};

export type Participante = Pessoa & { bilhetes: number; suspeito: boolean; fora?: string };

export function participantes(
  regra: RegraSorteio,
  dados: { emocoes: Emocao[]; mensagens: Mensagem[]; vendas: Venda[]; termos: string[]; vendedor?: string | null },
  jaGanharam: string[] = [],
): Participante[] {
  const base = new Map<string, Pessoa & { n: number }>();
  const somar = (handle: unknown, n: number, nome?: string | null, foto?: string | null) => {
    const h = semArroba(handle);
    if (!h || n <= 0) return;
    const p = base.get(h) ?? { handle: h, nome: nome || h, foto: foto || null, n: 0 };
    if (foto) p.foto = foto;
    p.n += n;
    base.set(h, p);
  };
  const f = regra.fonte;
  if (f === "compradores") {
    for (const v of vendasValidas(dados.vendas)) somar(v.comprador, v.quantidade || 1, null, v.foto);
  } else if (f === "emocoes") {
    for (const e of dados.emocoes) somar(e.handle, 1, e.nome, e.foto);
  } else if (f === "gemas") {
    for (const e of dados.emocoes) somar(e.handle, e.gemas || 0, e.nome, e.foto);
  } else if (f.startsWith("emocao:")) {
    const icone = f.slice(7);
    for (const e of dados.emocoes) if (e.icone === icone) somar(e.handle, 1, e.nome, e.foto);
  } else if (f === "carpas") {
    for (const c of rankingCarpas(dados.emocoes, dados.mensagens, dados.termos)) somar(c.handle, c.carpas, c.nome, c.foto);
  } else if (f === "chat") {
    for (const m of dados.mensagens) somar(m.handle, 1, m.nome, m.foto);
  }

  const eng = new Map(engajamento(dados.emocoes, dados.mensagens, dados.vendas).map((p) => [p.handle, p]));
  const contagem = [...base.values()].map((p) => ({
    ...p,
    mensagens: eng.get(p.handle)?.mensagens ?? 0,
    compras: eng.get(p.handle)?.compras ?? 0,
  }));
  return participantesDeContagem(regra, contagem, dados.vendedor, jaGanharam);
}

// A mesma regra, partindo da contagem pronta (a função dash_bilhetes do banco
// devolve exatamente isto). É o que a API usa para sortear e a tela do OBS
// para mostrar as chances, sem carregar a live inteira.
export type Contagem = Pessoa & { n: number; mensagens: number; compras: number };

export function participantesDeContagem(
  regra: RegraSorteio,
  contagem: Contagem[],
  vendedor?: string | null,
  jaGanharam: string[] = [],
): Participante[] {
  const excluir = new Set(regra.excluir.map((h) => semArroba(h).toLowerCase()));
  const ganhou = new Set(jaGanharam.map((h) => semArroba(h).toLowerCase()));
  const dono = semArroba(vendedor).toLowerCase();

  return contagem
    .filter((p) => semArroba(p.handle) && p.n > 0)
    .map((p) => {
      const handle = semArroba(p.handle);
      const suspeito = pareceRobo(handle, { mensagens: p.mensagens, compras: p.compras });
      const h = handle.toLowerCase();
      let fora: string | undefined;
      if (dono && h === dono) fora = "é o vendedor";
      else if (excluir.has(h)) fora = "tirado da lista";
      else if (regra.excluirSuspeitos && suspeito) fora = "conta suspeita";
      else if (!regra.repetir && ganhou.has(h)) fora = "já ganhou";
      const bilhetes = regra.peso === "igual" ? 1 : regra.fonte === "gemas" ? Math.max(1, Math.round(p.n / 100)) : p.n;
      return { handle, nome: p.nome || handle, foto: p.foto || null, bilhetes, suspeito, fora };
    })
    .sort((a, b) => Number(!!a.fora) - Number(!!b.fora) || b.bilhetes - a.bilhetes || a.handle.localeCompare(b.handle));
}

// Quanto da fonte já entrou (para o sorteio "a cada N"): a soma crua, antes do
// peso -- 120 carpas são 120 carpas mesmo se cada pessoa valer um bilhete.
export function totalDaFonte(contagem: { n: number }[]) {
  return contagem.reduce((s, p) => s + (p.n || 0), 0);
}

export const FONTES: { id: string; nome: string; unidade: string }[] = [
  { id: "compradores", nome: "Compradores (1 bilhete por item)", unidade: "itens" },
  { id: "carpas", nome: "Carpa dourada", unidade: "carpas" },
  { id: "emocoes", nome: "Todos que enviaram emotions", unidade: "emotions" },
  { id: "gemas", nome: "Gemas enviadas (1 bilhete a cada 100)", unidade: "gemas" },
  { id: "chat", nome: "Quem escreveu no chat", unidade: "mensagens" },
];

export function nomeDaFonte(fonte: string, nomesEmocoes: Record<string, string> = {}) {
  if (fonte.startsWith("emocao:")) {
    const i = fonte.slice(7);
    return { nome: `Emotion ${nomesEmocoes[i] || i}`, unidade: "envios" };
  }
  return FONTES.find((f) => f.id === fonte) ?? { nome: fonte, unidade: "pontos" };
}

export function concorrendo(lista: Participante[]) {
  return lista.filter((p) => !p.fora);
}

// Sorteio por bilhete. "aleatorio" recebe um número em [0, 1); a API usa
// crypto, os testes passam um fixo.
export function sortear(lista: Participante[], aleatorio: number): Participante | null {
  const ok = concorrendo(lista);
  const total = ok.reduce((s, p) => s + p.bilhetes, 0);
  if (!total) return null;
  let alvo = Math.floor(Math.min(0.999999999, Math.max(0, aleatorio)) * total);
  for (const p of ok) {
    if (alvo < p.bilhetes) return p;
    alvo -= p.bilhetes;
  }
  return ok[ok.length - 1];
}

// Sorteio "por meta": a cada N (bilhetes somados da fonte) libera um. Diz
// quantos já foram liberados, quantos faltam e quanto falta para o próximo.
export function marcos(aCada: number | null | undefined, totalFonte: number, jaSorteados: number) {
  if (!aCada || aCada <= 0) return { liberados: Infinity, disponiveis: Infinity, faltaParaProximo: 0, progresso: 1 };
  const liberados = Math.floor(totalFonte / aCada);
  const resto = totalFonte % aCada;
  return {
    liberados,
    disponiveis: Math.max(0, liberados - jaSorteados),
    faltaParaProximo: aCada - resto,
    progresso: resto / aCada,
  };
}

// ---------- ranking mensal ao vivo ----------
//
// A Jamble pontua o vendedor no mês com +3 por real vendido e +2 por gema
// recebida. Os pontos oficiais chegam quando a extensão vê o ranking; entre
// uma leitura e outra, a estimativa soma o que entrou depois dela.
export function pontosEstimados(
  oficial: { pontos: number; ts: number } | null,
  vendasDepois: number,
  gemasDepois: number,
) {
  if (!oficial) return null;
  return Math.round(oficial.pontos + vendasDepois * 3 + gemasDepois * 2);
}

// ---------- regra de sorteio (o modelo do Dash TCG) ----------
//
// Quem concorre (quem mandou emotion, quem comprou ou os dois), quais emotions
// contam, quando o sorteio é liberado (livre, ou por metas que se somam: a
// cada N emotions, pontos, itens, reais ou pontos do ranking) e a chance de
// cada um (por pontos, por quantidade ou igual). A "meta individual" é a
// mesma regra com um alvo: cada pessoa que chegar nele ganha.

export type MetasDaRegra = {
  emocoes?: number | null;
  pontos?: number | null;
  itens?: number | null;
  reais?: number | null;
  ranking?: number | null;
  metaDaLive?: boolean;
};

export type Regra = {
  tipo: "sorteio" | "individual";
  quem: "emocao" | "compra" | "ambos";
  icones: string[] | null; // null = todas as emotions, até as que vierem depois
  liberacao: "metas" | "livre";
  metas: MetasDaRegra;
  chance: "pontos" | "quantidade" | "igual";
  repetir: boolean;
  excluirSuspeitos: boolean;
  excluir: string[];
  alvo?: number | null; // meta individual
  unidade?: "emocoes" | "pontos"; // meta individual
};

export function regraPadrao(tipo: Regra["tipo"] = "sorteio"): Regra {
  return tipo === "individual"
    ? { tipo, quem: "emocao", icones: null, liberacao: "livre", metas: {}, chance: "quantidade", repetir: false, excluirSuspeitos: true, excluir: [], alvo: 10, unidade: "emocoes" }
    : { tipo, quem: "emocao", icones: null, liberacao: "metas", metas: { emocoes: 50 }, chance: "quantidade", repetir: true, excluirSuspeitos: true, excluir: [] };
}

// Sorteios gravados antes do modelo novo (fonte, peso, a cada N) viram regra.
export function regraDoSorteio(s: {
  regra?: Partial<Regra> | null;
  fonte?: string;
  peso?: string;
  repetir?: boolean;
  excluirSuspeitos?: boolean;
  excluir?: string[];
  modo?: string;
  aCada?: number | null;
}, termos: string[] = [CARPA]): Regra {
  if (s.regra && s.regra.tipo) {
    const base = regraPadrao(s.regra.tipo);
    return { ...base, ...s.regra, metas: { ...(s.regra.metas ?? {}) }, excluir: s.regra.excluir ?? [] } as Regra;
  }
  const fonte = s.fonte ?? "emocoes";
  const r = regraPadrao("sorteio");
  r.repetir = s.repetir !== false;
  r.excluirSuspeitos = s.excluirSuspeitos !== false;
  r.excluir = s.excluir ?? [];
  r.chance = s.peso === "igual" ? "igual" : "quantidade";
  r.quem = fonte === "compradores" ? "compra" : "emocao";
  r.icones = fonte.startsWith("emocao:") ? [fonte.slice(7)] : fonte === "carpas" ? termos.filter((t) => /^[a-z0-9_]+$/.test(t)) : null;
  if (fonte === "gemas") r.chance = "pontos";
  r.liberacao = s.modo === "meta" && s.aCada ? "metas" : "livre";
  r.metas = r.liberacao === "metas" ? (r.quem === "compra" ? { itens: s.aCada } : fonte === "gemas" ? { pontos: s.aCada } : { emocoes: s.aCada }) : {};
  return r;
}

const contaEmocao = (regra: Regra, e: Emocao) => !regra.icones || regra.icones.includes(e.icone);

function nomeDasEmocoes(regra: Regra) {
  return !regra.icones ? "qualquer emotion" : regra.icones.length ? regra.icones.join(", ") : "nenhuma emotion";
}

// A frase que resume a regra, como no Dash TCG:
// "1 sorteio a cada 50 emotions (qualquer emotion) · concorrem emotions (qualquer emotion) · emotions por quantidade · pode repetir"
export function descreverRegra(regra: Regra) {
  const em = nomeDasEmocoes(regra);
  if (regra.tipo === "individual") {
    return `Quem somar ${int(regra.alvo ?? 0)} ${regra.unidade === "pontos" ? "pontos" : "emotions"} (${em}) ganha`;
  }
  const partes: string[] = [];
  if (regra.liberacao === "livre") partes.push("Sorteio livre");
  else {
    const m = regra.metas;
    if (m.metaDaLive) partes.push("1 sorteio quando bater a meta da live");
    else {
      const metas: string[] = [];
      if (m.emocoes) metas.push(`${int(m.emocoes)} emotions (${em})`);
      if (m.pontos) metas.push(`${int(m.pontos)} pontos`);
      if (m.itens) metas.push(`${int(m.itens)} itens vendidos`);
      if (m.reais) metas.push(`${brl(m.reais)} vendidos`);
      if (m.ranking) metas.push(`${int(m.ranking)} pontos no ranking`);
      partes.push(metas.length ? `1 sorteio a cada ${metas.join(" ou ")}` : "sem meta marcada");
    }
  }
  const quem = regra.quem === "compra" ? "compradores" : regra.quem === "ambos" ? `emotions (${em}) e compradores` : `emotions (${em})`;
  partes.push(`concorrem ${quem}`);
  if (regra.quem !== "compra") {
    partes.push(regra.chance === "pontos" ? "emotions por pontos" : regra.chance === "igual" ? "chance igual" : "emotions por quantidade");
  }
  if (regra.quem !== "emocao" && regra.chance !== "igual") partes.push("1 bilhete por item");
  partes.push(regra.repetir ? "pode repetir" : "não repete ganhador");
  if (regra.excluirSuspeitos) partes.push("sem contas em lote");
  return partes.join(" · ");
}

// Bilhetes de cada pessoa pela regra (antes de tirar vendedor, suspeitos...).
export function contagemDaRegra(regra: Regra, dados: { emocoes: Emocao[]; mensagens: Mensagem[]; vendas: Venda[] }): Contagem[] {
  const m = new Map<string, Contagem>();
  const pessoa = (handle: unknown, nome?: string | null, foto?: string | null) => {
    const h = semArroba(handle);
    if (!h) return null;
    const p = m.get(h) ?? { handle: h, nome: nome || h, foto: foto || null, n: 0, mensagens: 0, compras: 0 };
    if (foto && !p.foto) p.foto = foto;
    m.set(h, p);
    return p;
  };
  if (regra.quem !== "compra") {
    for (const e of dados.emocoes) {
      if (!contaEmocao(regra, e)) continue;
      const p = pessoa(e.handle, e.nome, e.foto);
      if (p) p.n += regra.chance === "pontos" ? e.gemas || 0 : 1;
    }
  }
  if (regra.quem !== "emocao") {
    for (const v of vendasValidas(dados.vendas)) {
      const p = pessoa(v.comprador, null, v.foto);
      if (p) p.n += v.quantidade || 1;
    }
  }
  // Para marcar conta em lote: quem escreveu ou comprou não é robô.
  for (const x of dados.mensagens) {
    const p = m.get(semArroba(x.handle));
    if (p) p.mensagens++;
  }
  for (const v of vendasValidas(dados.vendas)) {
    const p = m.get(semArroba(v.comprador));
    if (p) p.compras++;
  }
  if (regra.chance === "igual") for (const p of m.values()) if (p.n > 0) p.n = 1;
  return [...m.values()].filter((p) => p.n > 0);
}

export function participantesDaRegra(
  regra: Regra,
  dados: { emocoes: Emocao[]; mensagens: Mensagem[]; vendas: Venda[] },
  vendedor?: string | null,
  jaGanharam: string[] = [],
): Participante[] {
  return participantesDeContagem(
    { fonte: "regra", peso: "quantidade", repetir: regra.repetir, excluirSuspeitos: regra.excluirSuspeitos, excluir: regra.excluir },
    contagemDaRegra(regra, dados),
    vendedor,
    jaGanharam,
  );
}

// O que já entrou na live para as metas que liberam sorteio.
export type TotaisDaRegra = { emocoes: number; pontos: number; itens: number; reais: number; ranking: number; metaDaLive: boolean };

export function totaisDaRegra(
  regra: Regra,
  dados: { emocoes: Emocao[]; vendas: Venda[] },
  extra: { regrasRanking?: { porReal?: number | null; porGema?: number | null } | null; metaDaLiveBatida?: boolean } = {},
): TotaisDaRegra {
  let emocoes = 0;
  let pontos = 0;
  let gemasTodas = 0;
  for (const e of dados.emocoes) {
    gemasTodas += e.gemas || 0;
    if (!contaEmocao(regra, e)) continue;
    emocoes++;
    pontos += e.gemas || 0;
  }
  const r = resumoVendas(dados.vendas);
  return {
    emocoes,
    pontos,
    itens: r.itens,
    reais: r.total,
    ranking: pontosDaLive(r.total, gemasTodas, extra.regrasRanking),
    metaDaLive: !!extra.metaDaLiveBatida,
  };
}

// Quantos sorteios a regra já liberou e o que falta para o próximo.
export function liberacoes(regra: Regra, t: TotaisDaRegra, jaSorteados: number) {
  if (regra.liberacao === "livre") return { livre: true, liberados: Infinity, disponiveis: Infinity, proximo: null as null | { falta: number; unidade: string; progresso: number } };
  const m = regra.metas;
  if (m.metaDaLive) {
    const liberados = t.metaDaLive ? 1 : 0;
    return { livre: false, liberados, disponiveis: Math.max(0, liberados - jaSorteados), proximo: liberados ? null : { falta: 1, unidade: "meta da live", progresso: 0 } };
  }
  const lista: { a: number; total: number; unidade: string }[] = [];
  if (m.emocoes) lista.push({ a: m.emocoes, total: t.emocoes, unidade: "emotions" });
  if (m.pontos) lista.push({ a: m.pontos, total: t.pontos, unidade: "pontos" });
  if (m.itens) lista.push({ a: m.itens, total: t.itens, unidade: "itens vendidos" });
  if (m.reais) lista.push({ a: m.reais, total: t.reais, unidade: "reais vendidos" });
  if (m.ranking) lista.push({ a: m.ranking, total: t.ranking, unidade: "pontos no ranking" });
  const liberados = lista.reduce((s, x) => s + Math.floor(x.total / x.a), 0);
  // O próximo é o que está mais perto (em proporção).
  const proximo = lista
    .map((x) => ({ falta: x.a - (x.total % x.a), unidade: x.unidade, progresso: (x.total % x.a) / x.a }))
    .sort((a, b) => b.progresso - a.progresso)[0] ?? null;
  return { livre: false, liberados, disponiveis: Math.max(0, liberados - jaSorteados), proximo };
}

// Meta individual: quanto cada pessoa já somou e quem chegou ao alvo.
export function progressoIndividual(regra: Regra, dados: { emocoes: Emocao[] }, vendedor?: string | null) {
  const alvo = Number(regra.alvo) || 0;
  const dono = semArroba(vendedor).toLowerCase();
  const m = new Map<string, Pessoa & { atual: number }>();
  for (const e of dados.emocoes) {
    if (!contaEmocao(regra, e)) continue;
    const h = semArroba(e.handle);
    if (!h || h.toLowerCase() === dono) continue;
    const p = m.get(h) ?? { handle: h, nome: e.nome || h, foto: e.foto || null, atual: 0 };
    if (e.foto && !p.foto) p.foto = e.foto;
    p.atual += regra.unidade === "pontos" ? e.gemas || 0 : 1;
    m.set(h, p);
  }
  const lista = [...m.values()].sort((a, b) => b.atual - a.atual);
  return { alvo, bateram: lista.filter((p) => alvo > 0 && p.atual >= alvo), faltam: lista.filter((p) => !(alvo > 0 && p.atual >= alvo)) };
}

export function mensagemDoRanking(r: { posicao?: number | null; pontos?: number | null; acima?: { handle: string; pontos: number; posicao: number } | null } | null, estimado?: number | null) {
  if (!r?.posicao) return "🏆 Bora subir no ranking mensal da Jamble! Cada carpa e cada compra contam pontos 🐟";
  const pts = estimado ?? r.pontos ?? 0;
  const falta = r.acima ? Math.max(0, r.acima.pontos - pts) : 0;
  return falta > 0
    ? `🏆 Estamos em #${r.posicao} no Ranking Mensal da Jamble! Faltam ${int(falta)} pontos pra passar o #${r.posicao - 1}. Cada R$ vale 3 pts e cada gema 2 pts — bora! 🐟`
    : `🏆 Estamos em #${r.posicao} no Ranking Mensal da Jamble! Obrigado, galera! 🐟`;
}

// ---------- metas ----------
//
// Meta da live (a live inteira chega a X) ou meta por pessoa (cada um que
// chegar a X ganha). "posicao" é chegar ao #N do ranking mensal.

export type Totais = {
  gemas: number;
  carpas: number;
  emocoes: number;
  faturamento: number;
  itens: number;
  compradores: number;
  pontosLive: number;
  posicao?: number | null;
};

export const TIPOS_DE_META: { id: string; nome: string; unidade: string; pessoa: boolean }[] = [
  { id: "pontos", nome: "Pontos do ranking mensal ganhos na live", unidade: "pts", pessoa: false },
  { id: "gemas", nome: "Gemas em emotions desta live", unidade: "gemas", pessoa: true },
  { id: "carpas", nome: "Carpas douradas", unidade: "carpas", pessoa: true },
  { id: "faturamento", nome: "Total vendido (R$)", unidade: "reais", pessoa: true },
  { id: "itens", nome: "Itens vendidos", unidade: "itens", pessoa: true },
  { id: "compradores", nome: "Compradores", unidade: "compradores", pessoa: false },
  { id: "posicao", nome: "Chegar ao # do ranking mensal", unidade: "", pessoa: false },
];

export function tipoDeMeta(id: string) {
  return TIPOS_DE_META.find((t) => t.id === id) ?? { id, nome: id, unidade: "", pessoa: false };
}

export function progressoMeta(meta: { tipo: string; alvo: number }, t: Totais) {
  const alvo = Number(meta.alvo) || 0;
  if (meta.tipo === "posicao") {
    const pos = t.posicao ?? null;
    const batida = pos != null && pos > 0 && pos <= alvo;
    return { atual: pos ?? 0, alvo, falta: pos == null ? null : Math.max(0, pos - alvo), progresso: batida ? 1 : 0, batida };
  }
  const atual =
    meta.tipo === "pontos" ? t.pontosLive
    : meta.tipo === "gemas" ? t.gemas
    : meta.tipo === "carpas" ? t.carpas
    : meta.tipo === "faturamento" ? t.faturamento
    : meta.tipo === "itens" ? t.itens
    : meta.tipo === "compradores" ? t.compradores
    : 0;
  return {
    atual,
    alvo,
    falta: Math.max(0, alvo - atual),
    progresso: alvo > 0 ? Math.min(1, atual / alvo) : 0,
    batida: alvo > 0 && atual >= alvo,
  };
}

// Pontos que a live rende no ranking mensal, pelas regras que vêm da Jamble
// (+3 por real vendido, +2 por gema hoje).
export function pontosDaLive(faturamento: number, gemas: number, regras?: { porReal?: number | null; porGema?: number | null } | null) {
  const porReal = regras?.porReal ?? 3;
  const porGema = regras?.porGema ?? 2;
  return Math.round(faturamento * porReal + gemas * porGema);
}

// Meta por pessoa: quem já chegou e quem está perto.
export function metaPorPessoa(
  meta: { tipo: string; alvo: number },
  dados: { emocoes: Emocao[]; mensagens: Mensagem[]; vendas: Venda[]; termos: string[] },
) {
  const alvo = Number(meta.alvo) || 0;
  let lista: (Pessoa & { atual: number })[] = [];
  if (meta.tipo === "gemas") lista = pontosPorPessoa(dados.emocoes).map((p) => ({ ...p, atual: p.gemas }));
  else if (meta.tipo === "carpas") lista = rankingCarpas(dados.emocoes, dados.mensagens, dados.termos).map((p) => ({ ...p, atual: p.carpas }));
  else if (meta.tipo === "faturamento") lista = rankingCompradores(dados.vendas).map((p) => ({ ...p, atual: p.total }));
  else if (meta.tipo === "itens") lista = rankingCompradores(dados.vendas).map((p) => ({ ...p, atual: p.itens }));
  const ordenada = lista.sort((a, b) => b.atual - a.atual);
  return {
    bateram: ordenada.filter((p) => alvo > 0 && p.atual >= alvo),
    perto: ordenada.filter((p) => !(alvo > 0 && p.atual >= alvo)).slice(0, 5),
  };
}

// ---------- mensagens prontas para o chat ----------

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function mensagemDeStatus(d: {
  carpas: number;
  vendas: number;
  posicao?: number | null;
  faltaAcima?: number | null;
  proximoSorteio?: { nome: string; falta: number; unidade: string } | null;
  meta?: { nome: string; falta: number; unidade: string } | null;
  topCarpa?: string | null;
}) {
  const partes: string[] = [];
  if (d.posicao) {
    partes.push(
      d.faltaAcima && d.faltaAcima > 0
        ? `🏆 Estamos em #${d.posicao} no ranking da Jamble — faltam ${int(d.faltaAcima)} pts pro #${d.posicao - 1}!`
        : `🏆 Estamos em #${d.posicao} no ranking da Jamble!`,
    );
  }
  if (d.carpas) partes.push(`🐟 ${int(d.carpas)} carpas douradas na live${d.topCarpa ? ` (top: @${d.topCarpa})` : ""}`);
  if (d.proximoSorteio && d.proximoSorteio.falta > 0) {
    partes.push(`🎁 Faltam ${int(d.proximoSorteio.falta)} ${d.proximoSorteio.unidade} pro próximo sorteio: ${d.proximoSorteio.nome}`);
  }
  if (d.meta && d.meta.falta > 0) partes.push(`🎯 Meta "${d.meta.nome}": faltam ${int(d.meta.falta)} ${d.meta.unidade}`);
  if (!partes.length) partes.push("Bora que a live tá só começando! Manda tua carpa 🐟");
  return partes.join(" · ");
}

export function mensagemDeSorteioLiberado(nome: string, premio?: string | null) {
  return `🎉 Sorteio liberado: ${nome}${premio ? ` — prêmio: ${premio}` : ""}! Valendo agora, fica na live!`;
}

export function mensagemDeGanhador(handle: string, premio?: string | null) {
  return `🥳 Parabéns @${semArroba(handle)}! Ganhou${premio ? ` ${premio}` : " o sorteio"}! Chama a gente no privado.`;
}

export function mensagemDeMetaBatida(nome: string) {
  return `🎯 META BATIDA: ${nome}! Obrigado demais, galera! 🙌`;
}

export { brl, int };
