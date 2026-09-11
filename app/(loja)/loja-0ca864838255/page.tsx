import type { Metadata } from "next";
import Image from "next/image";
import { Clock, ExternalLink, MapPin, Navigation, Phone, Star, Trees } from "lucide-react";
import InfoPage from "@/components/InfoPage";
import {
  GOOGLE_PROFILE_URL,
  GOOGLE_RATING,
  GOOGLE_REVIEWS,
  SITE_NAME,
  STORE_ADDRESS,
  STORE_HOURS,
  STORE_PHONE,
} from "@/lib/site";

// Página escondida: fora do menu e do sitemap, sem indexação. Só abre quem tem o link.
export const metadata: Metadata = {
  title: "Nossa loja",
  description: "Loja física da Village & Vault TCG em Atalaia (AL), ao lado da Village Fotografia.",
  robots: { index: false, follow: false },
};

const BUSCA = `${SITE_NAME}, Atalaia - AL`;
const ROTAS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(BUSCA)}`;
const MAPA = `https://maps.google.com/maps?q=${encodeURIComponent(BUSCA)}&z=14&output=embed`;
const TEL = `tel:+55${STORE_PHONE.replace(/\D/g, "")}`;
const NOTA = GOOGLE_RATING.toFixed(1).replace(".", ",");
const AVALIACOES = `${GOOGLE_REVIEWS} ${GOOGLE_REVIEWS === 1 ? "avaliação" : "avaliações"}`;

const SANTUARIO_SITE = "https://santuarioecosantatereza.com";
const SANTUARIO_INSTAGRAM = "https://www.instagram.com/santuarioecosantatereza/";

const BOTAO_GOOGLE =
  "inline-flex items-center gap-1.5 rounded-full border border-[#DADCE0] bg-white px-4 py-2 text-[13px] font-medium text-[#1A73E8] transition-colors hover:bg-[#F1F6FE]";

function Estrelas({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(GOOGLE_RATING) ? "fill-[#FBBC04] text-[#FBBC04]" : "fill-[#DADCE0] text-[#DADCE0]"}
        />
      ))}
    </span>
  );
}

function LogoGoogle() {
  return (
    <span className="font-semibold">
      <span className="text-[#4285F4]">G</span>
      <span className="text-[#EA4335]">o</span>
      <span className="text-[#FBBC05]">o</span>
      <span className="text-[#4285F4]">g</span>
      <span className="text-[#34A853]">l</span>
      <span className="text-[#EA4335]">e</span>
    </span>
  );
}

export default function LojaPage() {
  return (
    <InfoPage
      title="Nossa loja"
      intro="Além das vendas pelo site, a Village & Vault TCG tem loja física dentro do Parque Santuário Ecológico Fazenda Santa Tereza, em Atalaia (AL), ao lado da Village Fotografia. Passe para conhecer os produtos selados e as cartas de perto."
      whatsappMessage="Olá! Quero visitar a loja física."
    >
      {/* Cartão no formato do perfil da empresa no Google */}
      <article className="overflow-hidden rounded-xl border border-[#DADCE0] bg-white shadow-[0_1px_6px_rgba(32,33,36,0.12)]">
        <div className="grid h-64 grid-cols-3 grid-rows-2 gap-0.5 bg-[#DADCE0] sm:h-80">
          <div className="relative col-span-2 row-span-2">
            <Image
              src="/loja-0ca864838255/fachada-village-tcg.jpg"
              alt="Fachada da Village TCG, ao lado da Village Fotografia, com mesas e guarda-sóis na frente"
              fill
              className="object-cover"
              sizes="(max-width: 672px) 67vw, 448px"
              priority
            />
          </div>
          <div className="relative">
            <Image
              src="/loja-0ca864838255/entrada-loja.jpg"
              alt="Entrada da loja com portas de vidro e o balcão ao fundo"
              fill
              className="object-cover"
              sizes="(max-width: 672px) 33vw, 224px"
            />
          </div>
          <div className="relative">
            <Image
              src="/loja-0ca864838255/balcao-tcg.jpg"
              alt="Balcão da loja com caixas de produtos Pokémon TCG"
              fill
              className="object-cover"
              sizes="(max-width: 672px) 33vw, 224px"
            />
          </div>
        </div>

        <div className="p-5 text-[#202124]">
          <div className="flex items-start gap-3">
            <Image
              src="/logo.jpg"
              alt=""
              width={48}
              height={48}
              className="shrink-0 rounded-full border border-[#DADCE0]"
            />
            <div className="min-w-0">
              <h2 className="text-xl leading-tight">{SITE_NAME}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-[#4D5156]">
                <span className="text-[#202124]">{NOTA}</span>
                <Estrelas />
                <a
                  href={GOOGLE_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1A73E8] hover:underline"
                >
                  {AVALIACOES} no Google
                </a>
              </p>
              <p className="text-[13px] text-[#4D5156]">Loja de cards colecionáveis em Atalaia, AL</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href={GOOGLE_PROFILE_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_GOOGLE}>
              <ExternalLink size={15} />
              Ver no Google
            </a>
            <a href={ROTAS} target="_blank" rel="noopener noreferrer" className={BOTAO_GOOGLE}>
              <Navigation size={15} />
              Rotas
            </a>
            <a href={TEL} className={BOTAO_GOOGLE}>
              <Phone size={15} />
              Ligar
            </a>
          </div>

          <div className="mt-4 space-y-2.5 border-t border-[#DADCE0] pt-4 text-[13px]">
            <p className="flex items-start gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#1A73E8]" />
              <span>
                <span className="font-semibold">Endereço:</span> {STORE_ADDRESS}
              </span>
            </p>
            <p className="flex items-start gap-2.5">
              <Phone size={16} className="mt-0.5 shrink-0 text-[#1A73E8]" />
              <span>
                <span className="font-semibold">Telefone:</span>{" "}
                <a href={TEL} className="text-[#1A73E8] hover:underline">
                  {STORE_PHONE}
                </a>
              </span>
            </p>
            <p className="flex items-start gap-2.5">
              <Clock size={16} className="mt-0.5 shrink-0 text-[#1A73E8]" />
              <span>
                <span className="font-semibold">Horário:</span> {STORE_HOURS}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DADCE0] bg-[#F8F9FA] px-5 py-4">
          <div>
            <p className="text-[13px] text-[#4D5156]">
              Avaliações no <LogoGoogle />
            </p>
            <p className="mt-0.5 flex items-center gap-2">
              <span className="text-3xl text-[#202124]">{NOTA}</span>
              <Estrelas size={18} />
            </p>
            <p className="text-[12px] text-[#4D5156]">{AVALIACOES}</p>
          </div>
          <a
            href={GOOGLE_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#1A73E8] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#1765CC]"
          >
            Ver avaliações
          </a>
        </div>
      </article>

      <section className="rounded-xl border border-card-border bg-white p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink">
          <Trees size={16} className="text-brand-green" />
          Dentro do Santuário Ecológico
        </h2>
        <p className="mt-2 text-ink/75">
          A loja fica no Parque Santuário Ecológico Fazenda Santa Tereza, uma reserva particular de Mata
          Atlântica com mais de 100 hectares, a cerca de 48 km de Maceió. O parque tem piscinas naturais,
          trilhas e área de lazer para a família: dá para curtir o passeio e passar na loja no mesmo dia.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={SANTUARIO_SITE} target="_blank" rel="noopener noreferrer" className={BOTAO_GOOGLE}>
            <ExternalLink size={15} />
            Site do Santuário
          </a>
          <a href={SANTUARIO_INSTAGRAM} target="_blank" rel="noopener noreferrer" className={BOTAO_GOOGLE}>
            <ExternalLink size={15} />
            Instagram do Santuário
          </a>
        </div>
      </section>

      <iframe
        title={`Mapa da ${SITE_NAME} no Google Maps`}
        src={MAPA}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-72 w-full rounded-xl border border-[#DADCE0]"
      />
    </InfoPage>
  );
}
