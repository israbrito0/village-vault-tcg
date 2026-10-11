import type { Metadata } from "next";
import DashShell from "@/components/dash/DashShell";

// O painel das lives da Jamble. Fica fora do Google e com o login próprio.
export const metadata: Metadata = {
  title: "Dash Village",
  robots: { index: false, follow: false },
};

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return <DashShell>{children}</DashShell>;
}
