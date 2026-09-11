import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Carrinho" };

export default function CarrinhoPage() {
  return (
    <InfoPage
      title="Carrinho"
      intro="O carrinho online está chegando. Por enquanto, as compras são feitas pelo WhatsApp: escolha o produto no catálogo e toque em “Comprar pelo WhatsApp” que a gente finaliza com você."
      whatsappMessage="Olá! Quero fazer um pedido."
    />
  );
}
