// Troque o número abaixo pelo WhatsApp real da loja (código do país + DDD + número, sem espaços).
const WHATSAPP_NUMBER = "5547999999999";

export default function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-2xl text-ink shadow-lg"
    >
      ✆
    </a>
  );
}
