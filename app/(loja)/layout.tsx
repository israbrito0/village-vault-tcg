import Header from "@/components/Header";
import MegaMenu from "@/components/MegaMenu";

// Páginas internas da loja: cabeçalho com busca e menu dos jogos.
// A página inicial fica de fora e tem o próprio layout, mais limpo.
export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <MegaMenu />
      {children}
    </>
  );
}
