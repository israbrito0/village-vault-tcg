"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { PRODUCTS, formatPriceBRL, loadImageDirectly } from "@/lib/products";
import { esvaziarCarrinho, lerCarrinho, mudarQuantidade, ouvirCarrinho, type LinhaCarrinho } from "@/lib/carrinho";
import { supabaseNavegador } from "@/lib/supabase-navegador";

type Endereco = { id: string; cep: string; rua: string; numero: string; cidade: string; uf: string; principal: boolean };
type OpcaoFrete = { id: number; nome: string; empresa: string; centavos: number; prazoDias: number | null };

const CARTAO = "rounded-xl border border-card-border bg-white p-4 shadow-[0_2px_6px_rgba(0,0,0,0.04)]";

export default function CarrinhoLoja() {
  const [linhas, setLinhas] = useState<LinhaCarrinho[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoId, setEnderecoId] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcaoFrete[] | null>(null);
  const [freteId, setFreteId] = useState<number | null>(null);
  const [semEnvio, setSemEnvio] = useState(false);
  const [freteACombinar, setFreteACombinar] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const atualizar = () => setLinhas(lerCarrinho());
    atualizar();
    return ouvirCarrinho(atualizar);
  }, []);

  useEffect(() => {
    const db = supabaseNavegador();
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
      setUsuarioId(data.session?.user.id ?? null);
    });
    const { data } = db.auth.onAuthStateChange((_e, s) => {
      setToken(s?.access_token ?? null);
      setUsuarioId(s?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const itens = linhas
    .map((l) => ({ linha: l, produto: PRODUCTS.find((p) => p.slug === l.slug) }))
    .filter((x) => x.produto);
  const subtotal = itens.reduce((t, x) => t + x.produto!.priceCents * x.linha.quantidade, 0);

  const cotar = useCallback(
    async (cep: string) => {
      setOpcoes(null);
      setFreteId(null);
      setSemEnvio(false);
      setFreteACombinar(false);
      if (!linhas.length) return;
      const r = await fetch("/api/loja/frete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cep, itens: linhas }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 503) return setFreteACombinar(true);
      if (!r.ok) return setErro(d.erro ?? "Não consegui calcular o frete.");
      if (d.semEnvio) return setSemEnvio(true);
      setOpcoes(d.opcoes ?? []);
      if (d.opcoes?.[0]) setFreteId(d.opcoes[0].id);
    },
    [linhas],
  );

  // Logado: carrega os endereços da conta e já cota o frete do principal.
  useEffect(() => {
    const db = supabaseNavegador();
    if (!db || !usuarioId) return;
    db.from("enderecos")
      .select("id, cep, rua, numero, cidade, uf, principal")
      .eq("cliente_id", usuarioId)
      .order("principal", { ascending: false })
      .then(({ data }) => {
        setEnderecos(data ?? []);
        if (data?.[0]) {
          setEnderecoId(data[0].id);
          cotar(data[0].cep);
        }
      });
  }, [usuarioId, cotar]);

  async function pagar() {
    if (!token) return;
    setErro("");
    const precisaEndereco = !semEnvio;
    if (precisaEndereco && !enderecoId) return setErro("Escolha o endereço de entrega.");
    if (precisaEndereco && !freteACombinar && freteId === null) return setErro("Escolha o frete.");

    setOcupado(true);
    const janela = window.open("", "_blank");
    try {
      const r = await fetch("/api/loja/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ itens: linhas, enderecoId, freteServicoId: freteId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.link) {
        janela?.close();
        setErro(d.erro ?? "Não consegui fechar o pedido.");
        return;
      }
      // Pedido registrado: o carrinho esvazia e o pagamento fica em "Meus pedidos".
      esvaziarCarrinho();
      if (janela) janela.location.href = d.link;
      else window.location.href = d.link;
    } catch {
      janela?.close();
      setErro("Não consegui fechar o pedido agora.");
    } finally {
      setOcupado(false);
    }
  }

  if (!itens.length) {
    return (
      <div className={`${CARTAO} text-center`}>
        <ShoppingCart size={28} className="mx-auto text-muted" />
        <p className="mt-2 font-bold text-ink">Seu carrinho está vazio</p>
        <Link href="/catalogo" className="mt-3 inline-block rounded-full bg-brand-yellow px-5 py-2.5 text-[12px] font-bold uppercase text-ink">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const frete = semEnvio ? 0 : (opcoes?.find((o) => o.id === freteId)?.centavos ?? 0);

  return (
    <div className="space-y-3">
      <section className={CARTAO}>
        <ul className="divide-y divide-card-border">
          {itens.map(({ linha, produto }) => (
            <li key={linha.slug} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              {produto!.image ? (
                <Image
                  src={produto!.image}
                  alt={produto!.name}
                  width={56}
                  height={78}
                  className="h-[78px] w-14 shrink-0 rounded object-contain"
                  unoptimized={loadImageDirectly(produto!.image)}
                />
              ) : (
                <span className="h-[78px] w-14 shrink-0 rounded bg-surface" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/produto/${produto!.slug}`} className="block truncate text-[14px] font-medium text-ink">
                  {produto!.name}
                </Link>
                <p className="truncate text-[12px] text-muted">
                  {produto!.setName} · {produto!.condition}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-full border border-card-border">
                    <button
                      type="button"
                      aria-label="Menos"
                      onClick={() => mudarQuantidade(linha.slug, linha.quantidade - 1)}
                      className="grid h-8 w-8 place-items-center"
                    >
                      {linha.quantidade === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                    </button>
                    <span className="w-6 text-center text-[13px]">{linha.quantidade}</span>
                    <button
                      type="button"
                      aria-label="Mais"
                      disabled={linha.quantidade >= produto!.stock}
                      onClick={() => mudarQuantidade(linha.slug, linha.quantidade + 1)}
                      className="grid h-8 w-8 place-items-center disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <strong className="text-[14px] text-ink">{formatPriceBRL(produto!.priceCents * linha.quantidade)}</strong>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {!token ? (
        <section className={`${CARTAO} text-center`}>
          <p className="font-bold text-ink">Entre na sua conta para finalizar</p>
          <p className="mt-1 text-[12px] text-muted">É lá que ficam seu endereço, o frete e seus pedidos.</p>
          <Link
            href="/conta?voltar=/carrinho"
            className="mt-3 block rounded-full bg-brand-yellow px-4 py-2.5 text-[12px] font-bold uppercase text-ink"
          >
            Entrar ou criar conta
          </Link>
        </section>
      ) : (
        <section className={CARTAO}>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            <Truck size={14} />
            Entrega
          </p>

          {semEnvio && <p className="mt-2 text-[13px] text-ink">Código digital: não tem envio.</p>}

          {!semEnvio && enderecos.length === 0 && (
            <p className="mt-2 text-[13px] text-ink">
              Cadastre um endereço para calcular o frete.{" "}
              <Link href="/conta?voltar=/carrinho" className="font-bold text-brand-blue">
                Cadastrar endereço
              </Link>
            </p>
          )}

          {!semEnvio &&
            enderecos.map((e) => (
              <label key={e.id} className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
                <input
                  type="radio"
                  name="endereco"
                  checked={enderecoId === e.id}
                  onChange={() => {
                    setEnderecoId(e.id);
                    cotar(e.cep);
                  }}
                  className="mt-1"
                />
                <span className="text-ink">
                  {e.rua}, {e.numero} · {e.cidade}/{e.uf}
                </span>
              </label>
            ))}

          {freteACombinar && <p className="mt-2 text-[13px] text-ink">O frete será combinado com a loja pelo WhatsApp.</p>}
          {!semEnvio && !freteACombinar && enderecoId && opcoes === null && (
            <p className="mt-2 text-[12px] text-muted">Calculando o frete saindo de Maceió…</p>
          )}
          {opcoes?.map((o) => (
            <label key={o.id} className="mt-2 flex cursor-pointer items-center justify-between gap-2 text-[13px]">
              <span className="flex items-center gap-2">
                <input type="radio" name="frete" checked={freteId === o.id} onChange={() => setFreteId(o.id)} />
                <span className="text-ink">
                  {o.empresa} {o.nome}
                  {o.prazoDias ? <span className="text-muted"> · até {o.prazoDias} dias úteis</span> : null}
                </span>
              </span>
              <strong>{formatPriceBRL(o.centavos)}</strong>
            </label>
          ))}
        </section>
      )}

      <section className={CARTAO}>
        <div className="flex justify-between text-[13px] text-ink/80">
          <span>Produtos</span>
          <span>{formatPriceBRL(subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-[13px] text-ink/80">
          <span>Frete</span>
          <span>{semEnvio ? "sem envio" : freteACombinar ? "a combinar" : frete ? formatPriceBRL(frete) : "—"}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-card-border pt-2 text-[16px] font-bold text-ink">
          <span>Total</span>
          <span>{formatPriceBRL(subtotal + frete)}</span>
        </div>

        {erro && <p className="mt-2 rounded-lg bg-brand-red/10 px-3 py-2 text-[12px] font-medium text-brand-red">{erro}</p>}

        <button
          type="button"
          onClick={pagar}
          disabled={!token || ocupado}
          className="mt-3 w-full rounded-full bg-brand-green px-4 py-3 text-[14px] font-bold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {ocupado ? "Gerando pagamento…" : `Pagar ${formatPriceBRL(subtotal + frete)}`}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-muted">Pix ou cartão em até 12x, pela InfinitePay.</p>
      </section>
    </div>
  );
}
