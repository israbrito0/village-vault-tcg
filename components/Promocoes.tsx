import SealedSlider from "./SealedSlider";
import { SEALED_SLIDES, getSealedSlides } from "@/lib/banners";

// Banner largo do topo do catálogo e das páginas do menu.
// Com `game`, abre no primeiro slide daquele jogo.
export default function Promocoes({ game }: { game?: string }) {
  const index = game ? SEALED_SLIDES.findIndex((s) => s.game === game && !s.emblem) : -1;
  return <SealedSlider slides={getSealedSlides()} initialIndex={Math.max(index, 0)} />;
}
