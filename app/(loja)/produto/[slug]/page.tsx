import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { PRODUCTS, getProductBySlug, formatPriceBRL, loadImageDirectly } from "@/lib/products";
import { GAMES, SUBCATEGORIES } from "@/lib/types";
import {
  MAX_INSTALLMENTS,
  PIX_DISCOUNT,
  SHARE_IMAGE,
  SITE_NAME,
  SITE_URL,
  whatsappLink,
} from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

function fullName(product: { name: string; setName: string }) {
  return product.setName ? `${product.name} (${product.setName})` : product.name;
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return {};

  const title = fullName(product);
  return {
    title,
    description: product.description,
    alternates: { canonical: `/produto/${product.slug}` },
    // O openGraph daqui substitui o do layout inteiro, então repete site e imagem.
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      title,
      description: product.description,
      url: `/produto/${product.slug}`,
      images: [product.image ? { url: product.image, alt: product.name } : SHARE_IMAGE],
    },
  };
}

export default function ProdutoPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const gameLabel = GAMES.find((g) => g.slug === product.game)?.label ?? product.game;
  const subLabel =
    SUBCATEGORIES.find((s) => s.slug === product.subcategory)?.label ?? product.subcategory;

  const pixPriceCents = Math.round(product.priceCents * (1 - PIX_DISCOUNT));
  const installmentCents = Math.round(product.priceCents / MAX_INSTALLMENTS);
  const buyMessage =
    `Olá! Quero ${product.preorder ? "reservar na pré-venda" : "comprar"}: ${fullName(product)}, ` +
    `condição ${product.condition}, por ${formatPriceBRL(product.priceCents)}.\n` +
    `${SITE_URL}/produto/${product.slug}`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="grid gap-10 sm:grid-cols-2">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-card-border bg-surface shadow-[0_22px_40px_-20px_rgba(51,56,68,0.45)]">
          {product.image ? (
            // object-contain: a carta aparece inteira, sem cortar o rodapé com
            // o nome do artista e o copyright.
            <Image
              src={product.image}
              alt={product.name}
              fill
              priority
              unoptimized={loadImageDirectly(product.image)}
              sizes="(min-width: 640px) 480px, 100vw"
              className="object-contain p-4"
            />
          ) : (
            <Image
              src="/placeholder-card.svg"
              alt={product.name}
              width={500}
              height={667}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            {gameLabel} · {subLabel}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{product.name}</h1>
          <p className="mt-1 text-sm text-muted">{product.setName}</p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-3xl font-bold text-ink">
              {formatPriceBRL(product.priceCents)}
            </span>
            {product.compareAtPriceCents && (
              <span className="text-sm text-muted line-through">
                {formatPriceBRL(product.compareAtPriceCents)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink/80">
            <span className="font-bold text-brand-green">{formatPriceBRL(pixPriceCents)}</span> no Pix (
            {Math.round(PIX_DISCOUNT * 100)}% off) ou em até {MAX_INSTALLMENTS}x de{" "}
            {formatPriceBRL(installmentCents)} sem juros
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
            <span className="rounded-full bg-surface px-3 py-1 text-ink/80">
              Condição: {product.condition}
            </span>
            <span className="rounded-full bg-surface px-3 py-1 text-ink/80">
              Origem: {product.origin}
            </span>
            {product.preorder && (
              <span className="rounded-full bg-brand-blue px-3 py-1 text-white">Pré-venda</span>
            )}
            {product.stock === 1 ? (
              <span className="rounded-full border border-brand-red/50 px-3 py-1 text-brand-red">
                Última unidade
              </span>
            ) : (
              <span className="rounded-full bg-surface px-3 py-1 text-ink/80">
                {product.stock} em estoque
              </span>
            )}
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink/80">{product.description}</p>

          <a
            href={whatsappLink(buyMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded border-2 border-brand-green bg-brand-green py-3 text-[13px] font-bold uppercase tracking-wide text-white shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-colors hover:bg-white hover:text-brand-green sm:w-auto sm:px-10"
          >
            <MessageCircle size={18} strokeWidth={2} />
            {product.preorder ? "Reservar pelo WhatsApp" : "Comprar pelo WhatsApp"}
          </a>
        </div>
      </div>
    </main>
  );
}
