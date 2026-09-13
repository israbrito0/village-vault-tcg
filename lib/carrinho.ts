"use client";

// Carrinho da loja guardado no navegador. Aqui só fica qual produto e quantas
// unidades: preço e estoque são conferidos no servidor na hora de pagar.

export type LinhaCarrinho = { slug: string; quantidade: number };

const CHAVE = "vv-carrinho";
const EVENTO = "vv-carrinho-mudou";

export function lerCarrinho(): LinhaCarrinho[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as LinhaCarrinho[]) : [];
    return lista.filter((l) => l.slug && l.quantidade > 0);
  } catch {
    return [];
  }
}

function salvar(lista: LinhaCarrinho[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

export function adicionarAoCarrinho(slug: string, quantidade = 1, maximo = Infinity) {
  const lista = lerCarrinho();
  const atual = lista.find((l) => l.slug === slug);
  if (atual) atual.quantidade = Math.min(maximo, atual.quantidade + quantidade);
  else lista.push({ slug, quantidade: Math.min(maximo, quantidade) });
  salvar(lista);
}

export function mudarQuantidade(slug: string, quantidade: number) {
  const lista = lerCarrinho()
    .map((l) => (l.slug === slug ? { ...l, quantidade } : l))
    .filter((l) => l.quantidade > 0);
  salvar(lista);
}

export function esvaziarCarrinho() {
  salvar([]);
}

export function ouvirCarrinho(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  // Outra aba mexeu no carrinho.
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener("storage", fn);
  };
}
