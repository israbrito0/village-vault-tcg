// Cotação de frete pelo Melhor Envio, saindo da loja em Maceió.

export const CEP_ORIGEM = "57038800";

const API = process.env.MELHORENVIO_SANDBOX
  ? "https://sandbox.melhorenvio.com.br"
  : "https://melhorenvio.com.br";

// Medidas de embalagem por tipo de produto (cm e kg). É o que o Melhor Envio
// usa para calcular; ajuste aqui se a embalagem real for outra.
export const PACOTES = {
  carta: { nome: "Carta avulsa (envelope com top loader)", width: 11, height: 2, length: 16, weight: 0.05 },
  slab: { nome: "Carta graduada (slab)", width: 12, height: 3, length: 18, weight: 0.2 },
  selado: { nome: "Produto selado", width: 20, height: 10, length: 25, weight: 0.8 },
} as const;

export type TipoPacote = keyof typeof PACOTES;

export type OpcaoFrete = {
  id: number;
  nome: string;
  empresa: string;
  centavos: number;
  prazoDias: number | null;
};

export function temMelhorEnvio() {
  return Boolean(process.env.MELHORENVIO_TOKEN);
}

export function limparCep(cep: string) {
  return cep.replace(/\D/g, "");
}

type RespostaServico = {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { name?: string };
};

// Para o carrinho: vários produtos, cada um com a sua embalagem. O Melhor
// Envio monta a caixa e cota o conjunto.
// `medidas`, quando o produto tem as dele, vale mais que a embalagem padrão.
export type Medidas = { width: number; height: number; length: number; weight: number };
export type ItemFrete = { pacote: TipoPacote; medidas?: Medidas; quantidade: number; valorCentavos: number };

export async function cotarFrete({
  cepDestino,
  pacote = "carta",
  valorSeguroCentavos = 0,
  itens,
}: {
  cepDestino: string;
  pacote?: TipoPacote;
  valorSeguroCentavos?: number;
  itens?: ItemFrete[];
}): Promise<OpcaoFrete[]> {
  const token = process.env.MELHORENVIO_TOKEN;
  if (!token) throw new Error("Frete ainda não configurado (falta o token do Melhor Envio).");

  const destino = limparCep(cepDestino);
  if (destino.length !== 8) throw new Error("CEP inválido.");

  const medidas = PACOTES[pacote] ?? PACOTES.carta;
  const conteudo = itens?.length
    ? {
        products: itens.map((item, i) => {
          const m = item.medidas ?? PACOTES[item.pacote] ?? PACOTES.carta;
          return {
            id: String(i + 1),
            width: m.width,
            height: m.height,
            length: m.length,
            weight: m.weight,
            insurance_value: item.valorCentavos / 100,
            quantity: item.quantidade,
          };
        }),
      }
    : {
        package: { width: medidas.width, height: medidas.height, length: medidas.length, weight: medidas.weight },
        options: { insurance_value: valorSeguroCentavos / 100, receipt: false, own_hand: false },
      };

  const r = await fetch(`${API}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      // O Melhor Envio pede um User-Agent com contato do aplicativo.
      "user-agent": "Village Vault TCG (contato@villagetcg.com.br)",
    },
    body: JSON.stringify({
      from: { postal_code: CEP_ORIGEM },
      to: { postal_code: destino },
      ...conteudo,
    }),
  });

  const texto = await r.text();
  if (!r.ok) throw new Error(`Melhor Envio ${r.status}: ${texto.slice(0, 160)}`);

  let servicos: RespostaServico[] = [];
  try {
    servicos = JSON.parse(texto);
  } catch {
    throw new Error("Resposta do Melhor Envio não veio em JSON.");
  }

  return servicos
    .filter((s) => !s.error && (s.custom_price ?? s.price))
    .map((s) => ({
      id: s.id,
      nome: s.name,
      empresa: s.company?.name ?? "",
      centavos: Math.round(Number(s.custom_price ?? s.price) * 100),
      prazoDias: s.custom_delivery_time ?? s.delivery_time ?? null,
    }))
    .filter((s) => Number.isFinite(s.centavos) && s.centavos > 0)
    .sort((a, b) => a.centavos - b.centavos);
}
