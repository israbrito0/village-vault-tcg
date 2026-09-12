import type { EstadoLeilao } from "./leilao-db";

// Leilão de mentira, usado só enquanto o banco não está configurado. Serve para
// ver a tela funcionando; nada aqui é gravado.
export function leilaoDemo(agora = Date.now()): EstadoLeilao {
  const lote = (n: number, titulo: string, inicial: number, incremento: number, estado: string) => ({
    id: `demo-${n}`,
    ordem: n,
    titulo,
    lanceInicialCentavos: inicial,
    incrementoCentavos: incremento,
    estado: estado as "aguardando" | "aberto" | "encerrado",
  });

  return {
    leilao: { id: "demo", titulo: "Leilão de demonstração", descricao: null, estado: "ao_vivo" },
    lotes: [
      {
        ...lote(1, "Umbreon VMAX Alt Art", 80000, 5000, "encerrado"),
        vencedorId: "demo-p1",
        vencedorNome: "Rafa",
        vencedorCentavos: 105000,
      },
      { ...lote(2, "Charizard ex Obsidian Flames", 18900, 1000, "aberto"), abertoEm: agora - 20000, fechaEm: agora + 42000 },
      lote(3, "Mega Gardevoir ex Poster Collection", 32900, 2000, "aguardando"),
      lote(4, "Nidoqueen Holo 1ª Edição PSA 10", 5499900, 50000, "aguardando"),
    ],
    lances: [
      { id: "d1", loteId: "demo-2", participanteId: "demo-p2", nome: "Bianca", centavos: 18900, em: agora - 18000 },
      { id: "d2", loteId: "demo-2", participanteId: "demo-p1", nome: "Rafa", centavos: 19900, em: agora - 12000 },
      { id: "d3", loteId: "demo-2", participanteId: "demo-p3", nome: "Lu", centavos: 20900, em: agora - 6000 },
    ],
    mensagens: [
      { id: "m1", nome: "Bianca", texto: "essa carta é linda demais", em: agora - 30000 },
      { id: "m2", nome: "Lu", texto: "vou até 250 nessa", em: agora - 15000 },
      { id: "m3", nome: "Rafa", texto: "boa sorte pessoal 🔥", em: agora - 5000 },
    ],
  };
}
