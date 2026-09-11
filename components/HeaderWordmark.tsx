"use client";

import { usePathname } from "next/navigation";
import Wordmark from "./Wordmark";

// O cabeçalho é o mesmo em todas as páginas internas; as asas aparecem só no catálogo.
export default function HeaderWordmark() {
  const pathname = usePathname();
  return <Wordmark wings={pathname === "/catalogo"} />;
}
