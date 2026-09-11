// Dados da loja usados em todo o site. Troque aqui e vale para todas as páginas.

export const SITE_NAME = "Village & Vault TCG";
export const SITE_URL = "https://www.villagetcg.com.br";
export const SITE_DESCRIPTION =
  "Cartas e produtos selados de Pokémon, Magic e outros TCGs, com condição e estoque verificados.";

// Imagem da prévia quando o link é compartilhado no WhatsApp, Instagram etc.
export const SHARE_IMAGE = { url: "/hero-poster.jpg", width: 1024, height: 460, alt: SITE_NAME };

// WhatsApp da loja: código do país + DDD + número, sem espaços.
export const WHATSAPP_NUMBER = "5582999677824";
// Convite do grupo de leilões no WhatsApp (ex.: "https://chat.whatsapp.com/..."). Vazio, o
// botão do banner abre uma conversa com a loja pedindo para entrar no grupo.
export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/BdiGqtUYuaJEVulwMb5O5O";
// Perfil da loja na Jamble, onde acontecem as vendas ao vivo.
export const LIVE_URL = "https://www.jamble.com/u/israelbrito";
// Caixa no Mail do iCloud (domínio personalizado do iCloud+).
export const CONTACT_EMAIL = "contato@villagetcg.com.br";

// Loja física (mesmo endereço da sede, ao lado da Village Fotografia).
export const STORE_ADDRESS = "Fazenda Santa Tereza, Rodovia AL-316, 2,7 km à direita, Zona Rural, Atalaia - AL, 57690-000";
export const STORE_HOURS = "Segunda a sábado, das 9h às 20h";
export const STORE_PHONE = "(49) 99920-3436";

// Perfil da empresa no Google. Nota e total de avaliações são atualizados à mão.
export const GOOGLE_PROFILE_URL = "https://share.google/qAJACwW1O2Z3Su5rZ";
export const GOOGLE_RATING: number = 5;
export const GOOGLE_REVIEWS: number = 3;

export const PIX_DISCOUNT = 0.05;
export const MAX_INSTALLMENTS = 12;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
