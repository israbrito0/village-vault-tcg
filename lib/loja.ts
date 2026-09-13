import { createClient } from "@supabase/supabase-js";
import { PRODUCTS } from "./products";
import type { Product } from "./types";
import { cotarFrete, temMelhorEnvio, type ItemFrete, type TipoPacote } from "./frete";
import { criarLinkPagamento, temInfinitePay } from "./infinitepay";
import { SITE_URL } from "./site";

// Pedido do carrinho da loja. Preço, estoque e nome vêm SEMPRE do catálogo
// no servidor; do navegador só aceitamos qual produto e quantas unidades.

function cliente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !servico) throw new Error("Supabase não configurado");
  return createClient(url, servico, { auth: { persistSession: false } });
}

export type ItemCarrinho = { slug: string; quantidade: number };

// Embalagem por categoria. Código digital não viaja: não entra no frete.
export function pacoteDe(produto: Product): TipoPacote | null {
  if (produto.subcategory === "codigos-digitais") return null;
  if (produto.subcategory === "cartas-graduadas") return "slab";
  if (produto.subcategory === "cartas-avulsas") return "carta";
  return "selado";
}

export function conferirCarrinho(itens: ItemCarrinho[]) {
  const linhas: { produto: Product; quantidade: number }[] = [];
  const problemas: string[] = [];

  for (const item of itens.slice(0, 50)) {
    const produto = PRODUCTS.find((p) => p.slug === item.slug);
    const quantidade = Math.max(1, Math.floor(Number(item.quantidade) || 1));
    if (!produto) {
      problemas.push(`Produto não encontrado: ${item.slug}`);
      continue;
    }
    if (produto.preorder) {
      problemas.push(`${produto.name} é pré-venda: a reserva é pelo WhatsApp.`);
      continue;
    }
    if (produto.stock < quantidade) {
      problemas.push(
        produto.stock === 0 ? `${produto.name} esgotou.` : `${produto.name}: só temos ${produto.stock} em estoque.`,
      );
      continue;
    }
    linhas.push({ produto, quantidade });
  }

  const subtotal = linhas.reduce((t, l) => t + l.produto.priceCents * l.quantidade, 0);
  const itensFrete: ItemFrete[] = linhas
    .map((l) => ({ pacote: pacoteDe(l.produto), quantidade: l.quantidade, valorCentavos: l.produto.priceCents }))
    .filter((i): i is ItemFrete => i.pacote !== null);

  return { linhas, problemas, subtotal, itensFrete, precisaEnvio: itensFrete.length > 0 };
}

export async function cotarFreteCarrinho(cep: string, itens: ItemCarrinho[]) {
  const { itensFrete, precisaEnvio } = conferirCarrinho(itens);
  if (!precisaEnvio) return [];
  return cotarFrete({ cepDestino: cep, itens: itensFrete });
}

export async function fecharPedido({
  usuarioId,
  itens,
  enderecoId,
  freteServicoId,
}: {
  usuarioId: string;
  itens: ItemCarrinho[];
  enderecoId?: string;
  freteServicoId?: number;
}) {
  const conferido = conferirCarrinho(itens);
  if (conferido.problemas.length) return { erro: conferido.problemas.join(" "), status: 409 };
  if (!conferido.linhas.length) return { erro: "Seu carrinho está vazio.", status: 400 };
  if (!temInfinitePay()) return { erro: "Pagamento online ainda não configurado.", status: 503 };

  const db = cliente();
  let frete: { centavos: number; servico: string } | null = null;
  let endereco: Record<string, unknown> | null = null;

  if (conferido.precisaEnvio) {
    if (!enderecoId) return { erro: "Escolha o endereço de entrega.", status: 400 };
    const { data } = await db
      .from("enderecos")
      .select("id, cep, rua, numero, complemento, bairro, cidade, uf")
      .eq("id", enderecoId)
      .eq("cliente_id", usuarioId)
      .maybeSingle();
    if (!data) return { erro: "Endereço não encontrado na sua conta.", status: 400 };
    endereco = data;

    if (temMelhorEnvio()) {
      if (!freteServicoId) return { erro: "Escolha o frete.", status: 400 };
      // O preço do frete é calculado de novo aqui: o da tela não vale.
      const opcoes = await cotarFrete({ cepDestino: String(data.cep), itens: conferido.itensFrete });
      const escolhida = opcoes.find((o) => o.id === Number(freteServicoId));
      if (!escolhida) return { erro: "Essa opção de frete não está mais disponível. Escolha de novo.", status: 409 };
      frete = { centavos: escolhida.centavos, servico: `${escolhida.empresa} ${escolhida.nome}`.trim() };
    }
  }

  const fotoItens = conferido.linhas.map((l) => ({
    slug: l.produto.slug,
    nome: l.produto.name,
    colecao: l.produto.setName,
    condicao: l.produto.condition,
    precoCentavos: l.produto.priceCents,
    quantidade: l.quantidade,
  }));
  const total = conferido.subtotal + (frete?.centavos ?? 0);

  const { data: pedido, error } = await db
    .from("pedidos")
    .insert({
      usuario_id: usuarioId,
      itens: fotoItens,
      subtotal_centavos: conferido.subtotal,
      frete_centavos: frete?.centavos ?? 0,
      frete_servico: frete?.servico ?? (conferido.precisaEnvio ? "a combinar" : "sem envio (digital)"),
      endereco_id: (endereco?.id as string) ?? null,
      endereco,
      total_centavos: total,
    })
    .select("id")
    .single();
  if (error || !pedido) return { erro: "Não consegui registrar o pedido.", status: 500 };

  const itensLink = conferido.linhas.map((l) => ({
    nome: `${l.produto.name}${l.quantidade > 1 ? ` (x${l.quantidade})` : ""}`,
    centavos: l.produto.priceCents * l.quantidade,
  }));
  if (frete) itensLink.push({ nome: `Frete · ${frete.servico}`, centavos: frete.centavos });

  const link = await criarLinkPagamento({
    nsu: pedido.id,
    itens: itensLink,
    redirecionar: `${SITE_URL}/conta?pedido=${pedido.id}`,
    webhook: `${SITE_URL}/api/pagamento/infinitepay`,
  });
  await db.from("pedidos").update({ link }).eq("id", pedido.id);

  return { pedidoId: pedido.id, link, totalCentavos: total };
}

// Webhook: se o nsu for de um pedido da loja, marca como pago.
export async function marcarPedidoPago(pedidoId: string) {
  const db = cliente();
  const { data } = await db
    .from("pedidos")
    .update({ estado: "pago", pago_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("estado", "aguardando")
    .select("id");
  return (data ?? []).length > 0;
}
