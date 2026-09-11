import type { Metadata } from "next";
import InfoPage, { Question } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Trocas e devoluções" };

export default function TrocasPage() {
  return (
    <InfoPage title="Trocas e devoluções" whatsappMessage="Olá! Quero solicitar uma troca ou devolução.">
      <Question q="Desistiu da compra?">
        Você tem até 7 dias depois de receber o pedido para desistir, como garante o Código de Defesa
        do Consumidor (art. 49). Fale com a gente pelo WhatsApp que explicamos o envio de volta e o
        reembolso.
      </Question>

      <Question q="Produto chegou diferente do anunciado ou com defeito?">
        Chama a gente pelo WhatsApp com fotos do produto e o número do pedido. Resolvemos com troca
        ou reembolso.
      </Question>
    </InfoPage>
  );
}
