import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import MegaMenu from "@/components/MegaMenu";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cinzel",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Village & Vault TCG",
  description:
    "Cartas e produtos selados de Pokémon, Magic e outros TCGs, com condição e estoque verificados.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="font-sans">
        <Header />
        <MegaMenu />
        {children}
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
