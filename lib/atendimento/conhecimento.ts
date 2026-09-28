// Base de conhecimento do atendimento. Tudo que o robô sabe responder mora aqui,
// e sai das mesmas constantes que o resto do site usa -- mudou lib/site.ts,
// mudou a resposta. O objetivo é nunca inventar preço, estoque ou prazo.
//
// Esse módulo não sabe nada sobre canal: serve tanto o widget do site quanto,
// no futuro, o webhook do WhatsApp. Por isso devolve texto puro e um link
// opcional, sem JSX.

import {
  CONTACT_EMAIL,
  LIVE_URL,
  MAX_INSTALLMENTS,
  PIX_DISCOUNT,
  STORE_ADDRESS,
  STORE_HOURS,
  WHATSAPP_GROUP_URL,
  whatsappLink,
} from "../site";

export type Acao = { texto: string; href: string };

export type Assunto = {
  id: string;
  // Palavras que fazem essa resposta ser escolhida. Sem acento e em minúsculas:
  // a comparação normaliza os dois lados.
  gatilhos: string[];
  resposta: string;
  acao?: Acao;
  // Perguntas sugeridas depois dessa resposta, para guiar a conversa.
  seguir?: string[];
};

const pix = `${Math.round(PIX_DISCOUNT * 100)}%`;

export const ASSUNTOS: Assunto[] = [
  {
    id: "saudacao",
    gatilhos: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "eai", "opa", "tudo bem"],
    resposta:
      "Oi! Que bom te ver por aqui 😊 Sou o atendimento da Village & Vault. Posso te ajudar com pedidos, formas de pagamento, condição das cartas, envio, lives e leilões. O que você precisa?",
    seguir: ["Como faço uma compra?", "Quais as formas de pagamento?", "Quando é a próxima live?"],
  },
  {
    id: "comprar",
    gatilhos: ["comprar", "compra", "como faco", "pedido", "quero uma carta", "adquirir", "encomendar"],
    resposta:
      "É simples: escolhe a carta no catálogo e toca em “Comprar pelo WhatsApp”. A mensagem já vai com o nome e o preço, e a gente fecha o pedido por lá com você.",
    acao: { texto: "Ver catálogo", href: "/catalogo" },
    seguir: ["Quais as formas de pagamento?", "Como funciona o envio?"],
  },
  {
    id: "pagamento",
    gatilhos: ["pagamento", "pagar", "pix", "cartao", "parcela", "parcelado", "boleto", "desconto"],
    resposta: `Pix sai com ${pix} de desconto, e no cartão dá para parcelar em até ${MAX_INSTALLMENTS}x sem juros.`,
    seguir: ["Como faço uma compra?", "Posso trocar ou devolver?"],
  },
  {
    id: "originais",
    gatilhos: ["original", "originais", "falsa", "fake", "autentic", "verdadeira", "confiavel"],
    resposta:
      "Todas são originais, sem exceção. A gente confere condição e estoque de cada carta antes de enviar.",
    seguir: ["O que significam as siglas de condição?"],
  },
  {
    id: "condicao",
    gatilhos: ["condicao", "sigla", "nm", "sp", "mp", "hp", "graduada", "estado da carta", "conservacao"],
    resposta:
      "São as siglas de estado da carta:\n\n• NM (Near Mint): praticamente perfeita, sem marcas visíveis.\n• SP (Slightly Played): pequenos sinais de uso, como leves marcas nas bordas.\n• MP (Moderately Played): desgaste visível, mas sem danos estruturais.\n• HP (Heavily Played): bastante desgaste, vincos ou marcas fortes.\n• Graduada: avaliada e lacrada por uma empresa de graduação.",
    seguir: ["O que é a origem BR, US ou JP?"],
  },
  {
    id: "origem",
    gatilhos: ["origem", "br us jp", "jp", "br", "us", "idioma", "japonesa", "americana", "ingles", "portugues", "nacional"],
    resposta:
      "É o idioma e a região de impressão: BR é Brasil (português), US é Estados Unidos (inglês) e JP é Japão (japonês).",
    seguir: ["O que significam as siglas de condição?"],
  },
  {
    id: "trocas",
    gatilhos: ["troca", "trocar", "devolver", "devolucao", "arrependimento", "reembolso", "estorno"],
    resposta: "Pode trocar ou devolver, sim. A página de trocas explica os prazos e como funciona.",
    acao: { texto: "Trocas e devoluções", href: "/trocas" },
  },
  {
    id: "envio",
    gatilhos: ["envio", "frete", "entrega", "correio", "sedex", "prazo", "quantos dias", "demora", "chegar", "enviar"],
    resposta:
      "O frete é calculado pelo seu CEP na hora de fechar o pedido, usando o peso e as medidas reais de cada produto. Assim você vê o valor e o prazo antes de confirmar.",
    seguir: ["Como faço uma compra?", "Quero falar com uma pessoa"],
  },
  {
    id: "rastreio",
    gatilhos: ["rastrear", "rastreio", "codigo de rastreio", "cade meu pedido", "meu pedido", "ja enviou", "chegou"],
    resposta:
      "Consigo te ajudar com isso no WhatsApp, onde a gente acessa o seu pedido pelo nome ou número. Me chama por lá que eu confiro na hora.",
    acao: {
      texto: "Falar no WhatsApp",
      href: whatsappLink("Oi! Queria saber do meu pedido, por favor."),
    },
  },
  {
    id: "live",
    gatilhos: ["live", "ao vivo", "jamble", "transmissao", "quando vai ter live", "horario da live"],
    resposta:
      "As vendas ao vivo acontecem na Jamble, e é lá que saem os melhores preços. Entra no grupo do WhatsApp que a gente avisa sempre que vai começar.",
    acao: { texto: "Ver perfil na Jamble", href: LIVE_URL },
    seguir: ["Como entro no grupo do WhatsApp?"],
  },
  {
    id: "grupo",
    gatilhos: ["grupo", "whatsapp grupo", "comunidade", "entrar no grupo", "avisos"],
    resposta:
      "O grupo é onde a gente avisa das lives e solta as promoções primeiro. É só entrar pelo convite:",
    acao: { texto: "Entrar no grupo", href: WHATSAPP_GROUP_URL },
  },
  {
    id: "leilao",
    gatilhos: ["leilao", "leiloes", "lance", "arrematar", "dar lance"],
    resposta:
      "Os leilões rolam aqui no site e também nas lives. Na página de leilões você vê o que está aberto e dá seu lance.",
    acao: { texto: "Ver leilões", href: "/leiloes" },
  },
  {
    id: "torneios",
    gatilhos: ["torneio", "torneios", "campeonato", "evento", "jogar"],
    resposta: "Temos torneios na loja. A página de torneios traz as datas e como se inscrever.",
    acao: { texto: "Ver torneios", href: "/torneios" },
  },
  {
    id: "loja",
    gatilhos: ["loja fisica", "endereco", "onde fica", "presencial", "visitar", "horario", "que horas", "abre", "aberto", "fecha", "funciona"],
    resposta: `A loja fica em ${STORE_ADDRESS}. Abrimos ${STORE_HOURS.toLowerCase()}. Pode aparecer sem avisar.`,
    acao: { texto: "Ver no mapa", href: `https://www.google.com/maps/search/${encodeURIComponent(STORE_ADDRESS)}` },
  },
  {
    id: "catalogo",
    gatilhos: ["catalogo", "estoque", "tem essa carta", "procuro", "disponivel", "preco", "quanto custa", "valor"],
    resposta:
      "Os preços e o que está disponível ficam sempre atualizados no catálogo — prefiro te mandar lá do que arriscar um valor desatualizado. Se não achar a carta, me chama no WhatsApp que eu procuro no estoque.",
    acao: { texto: "Abrir catálogo", href: "/catalogo" },
    seguir: ["Quero falar com uma pessoa"],
  },
  {
    id: "humano",
    gatilhos: ["pessoa", "humano", "atendente", "falar com alguem", "vendedor", "israel", "contato"],
    resposta:
      "Claro! Me chama no WhatsApp que a gente continua por lá — costumo responder rápido.",
    acao: { texto: "Falar no WhatsApp", href: whatsappLink("Oi! Vim pelo site e queria falar com vocês.") },
  },
  {
    id: "email",
    gatilhos: ["email", "e-mail", "nota fiscal", "cnpj", "empresa"],
    resposta: `Para assuntos formais, nota fiscal ou parcerias, escreve para ${CONTACT_EMAIL}. Para o dia a dia, o WhatsApp é bem mais rápido.`,
    acao: { texto: "Falar no WhatsApp", href: whatsappLink("Oi! Vim pelo site.") },
  },
  {
    id: "agradecimento",
    gatilhos: ["obrigado", "obrigada", "valeu", "vlw", "show", "top", "perfeito", "ajudou"],
    resposta: "Por nada! Qualquer coisa é só chamar. Boas cartas pra você 😊",
  },
];

// Resposta quando nada bate. Nunca inventa: assume que não sabe e passa a bola.
export function respostaDeEscape(pergunta: string): { resposta: string; acao: Acao } {
  return {
    resposta:
      "Essa eu prefiro não responder no chute pra não te passar informação errada. Me chama no WhatsApp que a gente resolve rapidinho — ou tenta perguntar de outro jeito que eu tento de novo.",
    acao: {
      texto: "Falar no WhatsApp",
      href: whatsappLink(`Oi! Vim pelo site. Minha dúvida: ${pergunta}`.slice(0, 300)),
    },
  };
}

export const SUGESTOES_INICIAIS = [
  "Como faço uma compra?",
  "Quais as formas de pagamento?",
  "Como funciona o envio?",
  "Quando é a próxima live?",
];
