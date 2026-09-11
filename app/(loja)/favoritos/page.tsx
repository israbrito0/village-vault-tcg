import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Favoritos" };

export default function FavoritosPage() {
  return (
    <InfoPage
      title="Favoritos"
      intro="Em breve você vai poder salvar as cartas que quer acompanhar. Procurando alguma carta específica? Manda pra gente que avisamos quando chegar."
      whatsappMessage="Olá! Estou procurando uma carta:"
    />
  );
}
