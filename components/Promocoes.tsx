import BannerFan from "./BannerFan";
import SealedSlider from "./SealedSlider";
import { BANNERS, getFanBanners, getSealedSlides } from "@/lib/banners";

// Topo do catálogo e das páginas do menu: banner largo dos produtos lacrados
// e, logo abaixo, o leque dos jogos com cupons.
// Com `game`, o leque já abre no banner daquele jogo.
export default function Promocoes({ game }: { game?: string }) {
  const index = game ? BANNERS.findIndex((b) => b.game === game) : -1;
  return (
    <>
      <SealedSlider slides={getSealedSlides()} />
      <BannerFan banners={getFanBanners()} initialIndex={Math.max(index, 0)} compact />
    </>
  );
}
