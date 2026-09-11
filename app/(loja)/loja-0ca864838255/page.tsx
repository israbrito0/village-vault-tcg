import type { Metadata } from "next";
import Image from "next/image";
import { Clock, MapPin } from "lucide-react";
import InfoPage from "@/components/InfoPage";
import { STORE_ADDRESS, STORE_HOURS } from "@/lib/site";

// Página escondida: fora do menu e do sitemap, sem indexação. Só abre quem tem o link.
export const metadata: Metadata = {
  title: "Nossa loja",
  description: "Loja física da Village & Vault TCG em Atalaia (AL), ao lado da Village Fotografia.",
  robots: { index: false, follow: false },
};

const MAPA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;

export default function LojaPage() {
  return (
    <InfoPage
      title="Nossa loja"
      intro="Além das vendas pelo site, a Village & Vault TCG tem loja física em Atalaia (AL), ao lado da Village Fotografia. Passe para conhecer os produtos selados e as cartas de perto."
      whatsappMessage="Olá! Quero visitar a loja física."
    >
      <figure className="overflow-hidden rounded-lg border border-card-border bg-white">
        <Image
          src="/loja-0ca864838255/fachada-village-tcg.jpg"
          alt="Fachada da Village TCG, ao lado da Village Fotografia, com mesas e guarda-sóis na frente"
          width={1086}
          height={1448}
          className="h-auto w-full"
          sizes="(max-width: 672px) 100vw, 672px"
          priority
        />
      </figure>

      <div className="grid grid-cols-2 gap-3">
        <Image
          src="/loja-0ca864838255/entrada-loja.jpg"
          alt="Entrada da loja com portas de vidro e o balcão ao fundo"
          width={1200}
          height={2132}
          className="h-full w-full rounded-lg border border-card-border object-cover"
          sizes="(max-width: 672px) 50vw, 336px"
        />
        <Image
          src="/loja-0ca864838255/balcao-tcg.jpg"
          alt="Balcão da loja com caixas de produtos Pokémon TCG"
          width={1200}
          height={2608}
          className="h-full w-full rounded-lg border border-card-border object-cover"
          sizes="(max-width: 672px) 50vw, 336px"
        />
      </div>

      <video
        src="/loja-0ca864838255/tour-loja.mp4"
        poster="/loja-0ca864838255/tour-loja-capa.jpg"
        controls
        muted
        playsInline
        preload="none"
        className="w-full rounded-lg border border-card-border bg-black"
      />

      <section className="space-y-2 rounded-lg border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <p className="flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-brand-blue" />
          <span>
            {STORE_ADDRESS}{" "}
            <a href={MAPA} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-blue hover:underline">
              Ver no mapa
            </a>
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Clock size={16} className="shrink-0 text-brand-blue" />
          {STORE_HOURS}
        </p>
      </section>
    </InfoPage>
  );
}
