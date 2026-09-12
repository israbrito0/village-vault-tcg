import { diaDe, type Estado } from "./ranking";

// Números da aba privada de métricas, todos calculados a partir do mesmo
// estado que alimenta o ranking (ou seja, das vendas das lives na Jamble).

const FUSO = "America/Sao_Paulo";
const DIA_MS = 24 * 60 * 60 * 1000;

export type Metricas = {
  agora: number;
  live: {
    id: string;
    titulo: string | null;
    inicio: number;
    atualizado: number;
    centavos: number;
    pedidos: number;
    compradores: number;
    ticketCentavos: number;
    porHoraCentavos: number;
    minutos: { minuto: number; centavos: number }[];
    emAndamento: boolean;
  };
  mes: {
    rotulo: string;
    centavos: number;
    pedidos: number;
    ticketCentavos: number;
    diasComVenda: number;
    diaAtual: number;
    diasNoMes: number;
    mediaDiariaCentavos: number;
    projecaoCentavos: number;
    mesAnteriorCentavos: number;
  };
  total: {
    centavos: number;
    pedidos: number;
    compradores: number;
    ticketCentavos: number;
    desde: number;
  };
  dias: { dia: string; centavos: number; pedidos: number }[];
};

function partesDaData(ts: number) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ano, mes, dia] = f.format(new Date(ts)).split("-").map(Number);
  return { ano, mes, dia };
}

function chaveMes(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function somaDoMes(dias: Estado["dias"], prefixo: string) {
  let centavos = 0;
  let pedidos = 0;
  let diasComVenda = 0;
  for (const [dia, valores] of Object.entries(dias)) {
    if (!dia.startsWith(prefixo)) continue;
    centavos += valores.centavos;
    pedidos += valores.pedidos;
    if (valores.centavos > 0) diasComVenda += 1;
  }
  return { centavos, pedidos, diasComVenda };
}

function media(total: number, quantidade: number) {
  return quantidade > 0 ? Math.round(total / quantidade) : 0;
}

export function calcularMetricas(estado: Estado, agora = Date.now()): Metricas {
  const { ano, mes, dia } = partesDaData(agora);
  const prefixoMes = chaveMes(ano, mes);
  const mesAnterior = mes === 1 ? chaveMes(ano - 1, 12) : chaveMes(ano, mes - 1);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  const doMes = somaDoMes(estado.dias, prefixoMes);
  const doAnterior = somaDoMes(estado.dias, mesAnterior);

  // Projeção simples: o ritmo médio por dia corrido até aqui, esticado até o
  // fim do mês. Com poucos dias de histórico ela oscila bastante.
  const mediaDiaria = media(doMes.centavos, dia);
  const projecao = mediaDiaria * diasNoMes;

  const minutos = Object.entries(estado.live.minutos ?? {})
    .map(([minuto, centavos]) => ({ minuto: Number(minuto), centavos }))
    .sort((a, b) => a.minuto - b.minuto)
    .slice(-120);

  const umaHoraAtras = agora - 60 * 60 * 1000;
  const naUltimaHora = minutos
    .filter((m) => m.minuto * 60000 >= umaHoraAtras)
    .reduce((t, m) => t + m.centavos, 0);

  const ultimosDias: { dia: string; centavos: number; pedidos: number }[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const chave = diaDe(agora - i * DIA_MS);
    const v = estado.dias[chave] ?? { centavos: 0, pedidos: 0 };
    ultimosDias.push({ dia: chave, centavos: v.centavos, pedidos: v.pedidos });
  }

  return {
    agora,
    live: {
      id: estado.live.id,
      titulo: estado.live.titulo ?? null,
      inicio: estado.live.inicio,
      atualizado: estado.live.atualizado,
      centavos: estado.live.centavos,
      pedidos: estado.live.pedidos,
      compradores: estado.live.compradores.length,
      ticketCentavos: media(estado.live.centavos, estado.live.pedidos),
      porHoraCentavos: naUltimaHora,
      minutos,
      emAndamento: agora - estado.live.atualizado < 5 * 60 * 1000 && estado.live.pedidos > 0,
    },
    mes: {
      rotulo: prefixoMes,
      centavos: doMes.centavos,
      pedidos: doMes.pedidos,
      ticketCentavos: media(doMes.centavos, doMes.pedidos),
      diasComVenda: doMes.diasComVenda,
      diaAtual: dia,
      diasNoMes,
      mediaDiariaCentavos: mediaDiaria,
      projecaoCentavos: projecao,
      mesAnteriorCentavos: doAnterior.centavos,
    },
    total: {
      centavos: estado.acumulado.centavos,
      pedidos: estado.acumulado.pedidos,
      compradores: estado.acumulado.compradores.length,
      ticketCentavos: media(estado.acumulado.centavos, estado.acumulado.pedidos),
      desde: estado.acumulado.desde,
    },
    dias: ultimosDias,
  };
}
