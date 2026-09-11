import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { PRODUCTS, getProductBySlug, formatPriceBRL } from "@/lib/mock-data";
import { GAMES, SUBCATEGORIES } from "@/lib/types";
import {
  MAX_INSTALLMENTS,
  PIX_DISCOUNT,
  SHARE_IMAGE,
  SITE_NAME,
  SITE_URL,
  whatsappLink,
} from "@/lib/site";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return {};

  const title = `${product.name} (${product.setName})`;
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
      images: [SHARE_IMAGE],
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
    `Olá! Quero comprar: ${product.name} (${product.setName}), ` +
    `condição ${product.condition}, por ${formatPriceBRL(product.priceCents)}.\n` +
    `${SITE_URL}/produto/${product.slug}`;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="aspect-[3/4] overflow-hidden rounded-lg border border-card-border bg-card">
          <Image
            src="/placeholder-card.svg"
            alt={product.name}
            width={500}
            height={667}
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {gameLabel} · {subLabel}
          </p>
          <h1 className="mt-1 font-display text-xl text-cream">{product.name}</h1>
          <p className="mt-1 text-sm text-muted">{product.setName}</p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-medium text-gold">
              {formatPriceBRL(product.priceCents)}
            </span>
            {product.compareAtPriceCents && (
              <span className="text-sm text-muted line-through">
                {formatPriceBRL(product.compareAtPriceCents)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-cream/80">
            <span className="text-gold">{formatPriceBRL(pixPriceCents)}</span> no Pix (
            {Math.round(PIX_DISCOUNT * 100)}% off) ou em até {MAX_INSTALLMENTS}x de{" "}
            {formatPriceBRL(installmentCents)} sem juros
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded border border-card-border px-2 py-1 text-cream/80">
              Condição: {product.condition}
            </span>
            <span className="rounded border border-card-border px-2 py-1 text-cream/80">
              Origem: {product.origin}
            </span>
            {product.stock === 1 ? (
              <span className="rounded border border-gold-dim px-2 py-1 text-gold">
                Última unidade
              </span>
            ) : (
              <span className="rounded border border-card-border px-2 py-1 text-cream/80">
                {product.stock} em estoque
              </span>
            )}
          </div>

          <p className="mt-5 text-sm leading-relaxed text-cream/80">{product.description}</p>

          <a
            href={whatsappLink(buyMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded bg-gold py-3 text-sm font-medium text-ink sm:w-auto sm:px-8"
          >
            <MessageCircle size={18} strokeWidth={2} />
            Comprar pelo WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
