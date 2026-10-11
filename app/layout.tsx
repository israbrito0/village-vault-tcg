import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import SoForaDoDash from "@/components/SoForaDoDash";
import WhatsAppButton from "@/components/WhatsAppButton";
import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Nome da loja e títulos.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// Texto e botões; 600 e 700 são os pesos reais dos menus em negrito.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  // "swap": o texto aparece na hora com a fonte do sistema e troca quando a
  // Inter chega. Mudar as opções também refaz a fonte do zero na Vercel (o
  // cache dela tinha juntado duas versões e o site ficou sem a Inter).
  display: "swap",
});

// Refaz as páginas no máximo a cada hora: assim banners com data (ex.: live)
// saem do ar sozinhos, sem precisar publicar de novo.
export const revalidate = 3600;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="font-sans">
        {children}
        <SoForaDoDash>
          <Footer />
          <WhatsAppButton />
        </SoForaDoDash>
      </body>
    </html>
  );
}
