import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import RankingAoVivo from "@/components/RankingAoVivo";

export const metadata: Metadata = {
  title: "Top compradores",
  description: "Ranking dos maiores compradores das lives da Village & Vault TCG na Jamble.",
};

export default function RankingPage() {
  return (
    <InfoPage
      title="Top compradores"
      intro="O ranking das lives na Jamble, atualizado ao vivo. Cada compra soma no total de quem levou, e a lista muda na hora."
      whatsappMessage="Olá! Quero saber sobre o ranking de compradores das lives."
    >
      <RankingAoVivo />
    </InfoPage>
  );
}
