// Cobrança pela InfinitePay: monta o link de pagamento da caixa do cliente.
// O Pix lá é taxa zero, por isso ela foi a escolhida.

const API = "https://api.checkout.infinitepay.io/links";

export type ItemCobranca = { nome: string; centavos: number };

export function temInfinitePay() {
  return Boolean(process.env.INFINITEPAY_HANDLE);
}

export async function criarLinkPagamento({
  nsu,
  itens,
  redirecionar,
  webhook,
}: {
  nsu: string;
  itens: ItemCobranca[];
  redirecionar: string;
  webhook: string;
}) {
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) throw new Error("Falta o handle da InfinitePay (INFINITEPAY_HANDLE).");

  const cabecalho: Record<string, string> = { "content-type": "application/json" };
  // O token só é exigido em contas configuradas para isso.
  if (process.env.INFINITEPAY_TOKEN) cabecalho.authorization = `Bearer ${process.env.INFINITEPAY_TOKEN}`;

  const r = await fetch(API, {
    method: "POST",
    headers: cabecalho,
    body: JSON.stringify({
      handle,
      order_nsu: nsu,
      redirect_url: redirecionar,
      webhook_url: webhook,
      items: itens.map((i) => ({ name: i.nome.slice(0, 60), price: i.centavos, quantity: 1 })),
    }),
  });

  const texto = await r.text();
  if (!r.ok) throw new Error(`InfinitePay ${r.status}: ${texto.slice(0, 200)}`);

  let dados: Record<string, unknown> = {};
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error("Resposta da InfinitePay não veio em JSON.");
  }

  const url = (dados.url ?? dados.link ?? dados.payment_url) as string | undefined;
  if (!url) throw new Error("A InfinitePay não devolveu o link de pagamento.");
  return url;
}
