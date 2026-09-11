import BannerFan from "./BannerFan";
import { BANNERS, getFanBanners } from "@/lib/banners";

// Banners em leque do topo do catálogo e das páginas do menu.
// Com `game`, o leque já abre no banner daquele jogo.
export default function Promocoes({ game }: { game?: string }) {
  const index = game ? BANNERS.findIndex((b) => b.game === game) : -1;
  return <BannerFan banners={getFanBanners()} initialIndex={Math.max(index, 0)} compact />;
}
