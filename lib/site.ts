// Dados da loja usados em todo o site. Troque aqui e vale para todas as páginas.

export const SITE_NAME = "Village & Vault TCG";
export const SITE_URL = "https://www.villagetcg.com.br";
export const SITE_DESCRIPTION =
  "Cartas e produtos selados de Pokémon, Magic e outros TCGs, com condição e estoque verificados.";

// Imagem da prévia quando o link é compartilhado no WhatsApp, Instagram etc.
export const SHARE_IMAGE = { url: "/hero-poster.jpg", width: 1024, height: 460, alt: SITE_NAME };

// WhatsApp da loja: código do país + DDD + número, sem espaços.
export const WHATSAPP_NUMBER = "5582999677824";
// Perfil da loja na Jamble, onde acontecem as vendas ao vivo.
export const LIVE_URL = "https://www.jamble.com/u/israelbrito";
// Só recebe mensagens depois de contratar um serviço de email para o domínio.
export const CONTACT_EMAIL = "contato@villagetcg.com.br";

export const PIX_DISCOUNT = 0.05;
export const MAX_INSTALLMENTS = 12;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
