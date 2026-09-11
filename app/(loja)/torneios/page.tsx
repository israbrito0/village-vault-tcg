import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";

export const metadata: Metadata = { title: "Torneios" };

export default function TorneiosPage() {
  return (
    <InfoPage
      title="Torneios"
      intro="A agenda de torneios vai ficar aqui. Quer saber dos próximos eventos? Chama a gente no WhatsApp."
      whatsappMessage="Olá! Quero saber dos próximos torneios."
    />
  );
}
