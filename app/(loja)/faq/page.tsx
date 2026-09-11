import type { Metadata } from "next";
import Link from "next/link";
import InfoPage, { Question } from "@/components/InfoPage";
import { MAX_INSTALLMENTS, PIX_DISCOUNT } from "@/lib/site";

export const metadata: Metadata = { title: "Perguntas frequentes" };

export default function FaqPage() {
  return (
    <InfoPage title="Perguntas frequentes" whatsappMessage="Olá! Tenho uma dúvida:">
      <Question q="Como faço uma compra?">
        Escolha o produto no <Link href="/catalogo" className="font-medium text-brand-blue hover:underline">catálogo</Link> e
        toque em “Comprar pelo WhatsApp”. A mensagem já vai com o nome e o preço da carta, e a gente
        finaliza o pedido com você por lá.
      </Question>

      <Question q="Quais as formas de pagamento?">
        Pix com {Math.round(PIX_DISCOUNT * 100)}% de desconto, ou cartão em até {MAX_INSTALLMENTS}x sem
        juros.
      </Question>

      <Question q="Os produtos são originais?">
        Sim. Todos os produtos são originais, com condição e estoque verificados antes do envio.
      </Question>

      <Question q="O que significam as siglas de condição?">
        <ul className="mt-1 space-y-1">
          <li><strong className="text-ink">NM</strong> (Near Mint): praticamente perfeita, sem marcas visíveis.</li>
          <li><strong className="text-ink">SP</strong> (Slightly Played): pequenos sinais de uso, como leves marcas nas bordas.</li>
          <li><strong className="text-ink">MP</strong> (Moderately Played): desgaste visível, mas sem danos estruturais.</li>
          <li><strong className="text-ink">HP</strong> (Heavily Played): bastante desgaste, vincos ou marcas fortes.</li>
          <li><strong className="text-ink">Graduada</strong>: avaliada e lacrada por uma empresa de graduação.</li>
        </ul>
      </Question>

      <Question q="O que é a origem BR, US ou JP?">
        É o idioma e a região de impressão da carta: Brasil (português), Estados Unidos (inglês) ou
        Japão (japonês).
      </Question>

      <Question q="Posso trocar ou devolver?">
        Pode. Veja como funciona em{" "}
        <Link href="/trocas" className="font-medium text-brand-blue hover:underline">trocas e devoluções</Link>.
      </Question>
    </InfoPage>
  );
}
