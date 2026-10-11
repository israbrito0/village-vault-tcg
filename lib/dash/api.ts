import { regraDoSorteio, type Emocao, type Mensagem, type Regra, type Venda } from "@/lib/dash/calculos";

// O formato das respostas da API do Dash, usado pelas telas e pelas rotas.
// As linhas do banco viram os tipos de calculos.ts (datas em milissegundos).

type Linha = Record<string, unknown>;
const ms = (v: unknown) => (v ? new Date(String(v)).getTime() : 0);
const semLive = (id: unknown) => String(id ?? "").replace(/^[^:]+:/, "");

export function emocaoDaLinha(r: Linha): Emocao {
  return {
    id: String(r.id),
    handle: String(r.handle ?? ""),
    nome: (r.nome as string) ?? null,
    foto: (r.foto as string) ?? null,
    icone: String(r.icone ?? ""),
    gemas: Number(r.gemas) || 0,
    time: (r.time as string) ?? null,
    ts: ms(r.ts),
  };
}

export function mensagemDaLinha(r: Linha): Mensagem {
  return {
    id: String(r.id),
    handle: String(r.handle ?? ""),
    nome: (r.nome as string) ?? null,
    foto: (r.foto as string) ?? null,
    texto: String(r.texto ?? ""),
    ts: ms(r.ts),
  };
}

export function vendaDaLinha(r: Linha): Venda {
  return {
    id: semLive(r.id),
    titulo: String(r.titulo ?? ""),
    imagem: (r.imagem as string) ?? null,
    comprador: (r.comprador as string) ?? null,
    foto: (r.foto as string) ?? null,
    preco: Number(r.preco) || 0,
    quantidade: Number(r.quantidade) || 0,
    total: Number(r.total) || 0,
    tipo: (r.tipo as string) ?? null,
    pago: (r.pago as boolean | null) ?? null,
    cancelado: r.cancelado === true,
    ts: ms(r.ts),
  };
}

export type LiveInfo = {
  showId: string;
  vendedor: string | null;
  vendedorFoto: string | null;
  titulo: string | null;
  capa: string | null;
  inicio: number | null;
  fim: number | null;
  aoVivo: boolean;
  audiencia: number | null;
  pico: number | null;
  likes: number | null;
  metricas: Record<string, number | string | boolean | null>;
  participacao: { handle: string; nome?: string; pontos?: number; gastou?: number; gemas?: number; mensagens?: number; foto?: string | null }[];
  leilao: Leilao | null;
  batalha: Batalha | null;
  vistoEm: number;
};

export type Leilao = {
  id: string;
  titulo?: string;
  tipo?: string;
  inicial?: number;
  melhor?: number;
  vencedor?: string | null;
  lances?: number;
  disputaram?: number;
  restam?: number | null;
  vendidas?: number;
  situacao?: string;
  inicio?: number | null;
  termina?: number | null;
};

export type Batalha = {
  lider: string;
  diferenca: number;
  vermelho: { pessoas: number; pontos: number; topNomes?: (string | null)[] };
  azul: { pessoas: number; pontos: number; topNomes?: (string | null)[] };
  acabou: boolean;
  termina?: number | null;
};

export function liveDaLinha(r: Linha): LiveInfo {
  return {
    showId: String(r.show_id),
    vendedor: (r.vendedor as string) ?? null,
    vendedorFoto: (r.vendedor_foto as string) ?? null,
    titulo: (r.titulo as string) ?? null,
    capa: (r.capa_url as string) ?? null,
    inicio: r.inicio ? ms(r.inicio) : null,
    fim: r.fim ? ms(r.fim) : null,
    aoVivo: r.ao_vivo === true,
    audiencia: (r.audiencia as number) ?? null,
    pico: (r.audiencia_pico as number) ?? null,
    likes: (r.likes as number) ?? null,
    metricas: (r.metricas as LiveInfo["metricas"]) ?? {},
    participacao: (r.participacao as LiveInfo["participacao"]) ?? [],
    leilao: (r.leilao as Leilao) ?? null,
    batalha: (r.batalha as Batalha) ?? null,
    vistoEm: ms(r.visto_em),
  };
}

export type Sorteio = {
  id: string;
  nome: string;
  premio: string | null;
  fonte: string;
  peso: "quantidade" | "igual";
  repetir: boolean;
  excluirSuspeitos: boolean;
  excluir: string[];
  modo: "livre" | "meta";
  aCada: number | null;
  ativo: boolean;
  ordem: number;
  criadoEm: number;
  // Sorteio agendado: a hora (no relógio do servidor) em que ele começa sozinho.
  agendadoPara: number | null;
  regra: Regra;
  ganhadores: Ganhador[];
};

export type Ganhador = {
  id: string;
  handle: string;
  foto: string | null;
  bilhetes: number;
  totalBilhetes: number;
  participantes: number;
  marco: number | null;
  status: "valido" | "ausente" | "resorteado";
  presente: boolean | null;
  ts: number;
};

export function sorteioDaLinha(r: Linha, ganhadores: Linha[], termos?: string[]): Sorteio {
  const antigo = {
    fonte: String(r.fonte),
    peso: String(r.peso),
    repetir: r.repetir !== false,
    excluirSuspeitos: r.excluir_suspeitos !== false,
    excluir: (r.excluir as string[]) ?? [],
    modo: String(r.modo),
    aCada: (r.a_cada as number) ?? null,
  };
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    premio: (r.premio as string) ?? null,
    fonte: String(r.fonte),
    peso: r.peso === "igual" ? "igual" : "quantidade",
    repetir: r.repetir !== false,
    excluirSuspeitos: r.excluir_suspeitos !== false,
    excluir: (r.excluir as string[]) ?? [],
    modo: r.modo === "meta" ? "meta" : "livre",
    aCada: (r.a_cada as number) ?? null,
    ativo: r.ativo !== false,
    ordem: Number(r.ordem) || 0,
    criadoEm: ms(r.criado_em),
    agendadoPara: r.agendado_para ? ms(r.agendado_para) : null,
    regra: regraDoSorteio({ ...antigo, regra: (r.regra as Partial<Regra>) ?? null }, termos),
    ganhadores: ganhadores
      .filter((g) => g.sorteio_id === r.id)
      .map((g) => ({
        id: String(g.id),
        handle: String(g.handle),
        foto: (g.foto as string) ?? null,
        bilhetes: Number(g.bilhetes) || 0,
        totalBilhetes: Number(g.total_bilhetes) || 0,
        participantes: Number(g.participantes) || 0,
        marco: (g.marco as number) ?? null,
        status: (g.status as Ganhador["status"]) ?? "valido",
        presente: (g.presente as boolean | null) ?? null,
        ts: ms(g.ts),
      }))
      .sort((a, b) => a.ts - b.ts),
  };
}

export type Meta = {
  id: string;
  nome: string;
  tipo: string;
  escopo: "live" | "pessoa";
  alvo: number;
  premio: string | null;
  ativo: boolean;
  batidaEm: number | null;
  criadoEm: number;
};

export function metaDaLinha(r: Linha): Meta {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    tipo: String(r.tipo),
    escopo: r.escopo === "pessoa" ? "pessoa" : "live",
    alvo: Number(r.alvo) || 0,
    premio: (r.premio as string) ?? null,
    ativo: r.ativo !== false,
    batidaEm: r.batida_em ? ms(r.batida_em) : null,
    criadoEm: ms(r.criado_em),
  };
}

export type Ranking = {
  ts: number;
  mes: string;
  pontos: number | null;
  posicao: number | null;
  acima: { handle: string; posicao: number; pontos: number } | null;
  abaixo: { handle: string; posicao: number; pontos: number } | null;
  lista: { handle: string; posicao: number; pontos: number }[];
  regras: { porReal?: number | null; porGema?: number | null } | null;
};

export function rankingDaLinha(r: Linha | null): Ranking | null {
  if (!r) return null;
  return {
    ts: ms(r.ts),
    mes: String(r.mes ?? ""),
    pontos: (r.pontos as number) ?? null,
    posicao: (r.posicao as number) ?? null,
    acima: (r.acima as Ranking["acima"]) ?? null,
    abaixo: (r.abaixo as Ranking["abaixo"]) ?? null,
    lista: (r.lista as Ranking["lista"]) ?? [],
    regras: (r.regras as Ranking["regras"]) ?? null,
  };
}

export type Icone = { url: string | null; nome: string | null; gemas: number | null };

// Uma live que o robô (sem a extensão) está acompanhando.
export type MonitorInfo = {
  id: string;
  showId: string;
  vendedor: string | null;
  titulo: string | null;
  ativo: boolean;
  automatico: boolean;
  criadoEm: number;
  ate: number;
  ultimoCiclo: number | null;
  ultimoErro: string | null;
  // Live agendada: quando ela começa (o robô entra 10 min antes).
  comecaEm: number | null;
};

export type RespostaEu = {
  membro: { email: string; conta: string; papel: string; recursos: string[] };
  config: { telaChave: string; termosCarpa: string; preferencias: Record<string, unknown> };
  live: LiveInfo | null;
  outras: LiveInfo[];
  ranking: Ranking | null;
  extensaoVistaEm: number | null;
  // O robô: quando começou a última rodada e quantas lives ele acompanha.
  robo: { rodouEm: number | null; ativos: number; agendada: { showId: string; titulo: string | null; inicio: number | null; capa: string | null } | null };
};

export type RespostaLive = {
  live: LiveInfo;
  emocoes: Emocao[];
  chat: Mensagem[];
  vendas: Venda[] | null;
  vendasSig: string;
  ranking: Ranking | null;
  sorteios: Sorteio[];
  metas: Meta[];
  termos: string;
  icones: Record<string, Icone>;
  souVendedor: boolean;
  podeEditar: boolean;
  conta: string;
  agora: number;
  visual: VisualDoSorteio;
};

// Como o sorteio roda (escolha da conta, vale no painel e na tela do OBS):
// o tambor do "Pião" ou a fita de rostos, e a música enquanto gira.
export type VisualDoSorteio = {
  estilo: "piao" | "fita";
  musica: "padrao" | "arquivo" | "nenhuma";
  musicaUrl: string | null;
  musicaNome: string | null;
  // O som dos 10 segundos para o ganhador responder: o tique do Dash ou um
  // arquivo enviado.
  contagem: "padrao" | "arquivo";
  contagemUrl: string | null;
  contagemNome: string | null;
};

export function visualDoSorteio(preferencias: Record<string, unknown> | null | undefined): VisualDoSorteio {
  const s = (preferencias?.sorteio ?? {}) as Partial<VisualDoSorteio>;
  const https = (u: unknown) => (typeof u === "string" && u.startsWith("https://") ? u : null);
  const url = https(s.musicaUrl);
  const contagemUrl = https(s.contagemUrl);
  return {
    estilo: s.estilo === "fita" ? "fita" : "piao",
    musica: s.musica === "nenhuma" ? "nenhuma" : s.musica === "arquivo" && url ? "arquivo" : "padrao",
    musicaUrl: url,
    musicaNome: typeof s.musicaNome === "string" ? s.musicaNome.slice(0, 120) : null,
    contagem: s.contagem === "arquivo" && contagemUrl ? "arquivo" : "padrao",
    contagemUrl,
    contagemNome: typeof s.contagemNome === "string" ? s.contagemNome.slice(0, 120) : null,
  };
}

export type LiveResumo = {
  showId: string;
  titulo: string | null;
  vendedor: string | null;
  vendedorFoto: string | null;
  inicio: number;
  aoVivo: boolean;
  total: number;
  pago: number;
  itens: number;
  vendas: number;
  compradores: number;
  emocoes: number;
  gemas: number;
  ganhadores: number;
};

export type Cliente = {
  comprador: string;
  foto: string | null;
  total: number;
  pago: number;
  pendente: number;
  itens: number;
  compras: number;
  lives: number;
  primeira: number;
  ultima: number;
};
