/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // Imagens das cartas de Pokémon (TCGdex). As de Magic (Scryfall) não
      // passam pelo otimizador; veja loadImageDirectly em lib/products.ts.
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
      },
    ],
  },
};

export default nextConfig;
