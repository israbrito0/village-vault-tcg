import type { Metadata } from "next";
import PageTitle from "@/components/PageTitle";
import CarrinhoLoja from "@/components/CarrinhoLoja";

export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false, follow: false },
};

export default function CarrinhoPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-10 pt-6">
      <PageTitle title="Carrinho" />
      <div className="mt-6">
        <CarrinhoLoja />
      </div>
    </main>
  );
}
