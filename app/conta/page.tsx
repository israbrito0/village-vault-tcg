import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Minha conta" };

export default function ContaPage() {
  return (
    <InfoPage
      title="Minha conta"
      intro="O cadastro de clientes está chegando. Enquanto isso, você acompanha seus pedidos direto com a gente pelo WhatsApp."
      whatsappMessage="Olá! Quero saber sobre meu pedido."
    />
  );
}
