"use client";

import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, X } from "lucide-react";

type Acao = { texto: string; href: string };
type Mensagem = { de: "cliente" | "loja"; texto: string; acao?: Acao | null };

const SAUDACAO =
  "Oi! Sou o atendimento da Village & Vault 😊 Me conta o que você precisa — pedidos, pagamento, envio, lives ou leilões.";

export default function Atendimento() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ de: "loja", texto: SAUDACAO }]);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Sugestões iniciais vêm da mesma base de conhecimento do servidor.
  useEffect(() => {
    if (!aberto || sugestoes.length) return;
    fetch("/api/atendimento")
      .then((r) => r.json())
      .then((d) => setSugestoes(d.sugestoes ?? []))
      .catch(() => {});
  }, [aberto, sugestoes.length]);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, digitando]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || digitando) return;
    setMensagens((m) => [...m, { de: "cliente", texto: limpa }]);
    setTexto("");
    setDigitando(true);

    try {
      const r = await fetch("/api/atendimento", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pergunta: limpa }),
      });
      const d = await r.json();
      // Uma pausa curta antes de responder: chega instantâneo demais parece robô.
      await new Promise((res) => setTimeout(res, 500));
      setMensagens((m) => [...m, { de: "loja", texto: d.texto, acao: d.acao }]);
      setSugestoes(d.sugestoes ?? []);
    } catch {
      setMensagens((m) => [
        ...m,
        { de: "loja", texto: "Deu um problema na minha conexão aqui. Tenta de novo em instantes?" },
      ]);
    } finally {
      setDigitando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir atendimento"
        className="fixed bottom-20 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-ink shadow-lg transition hover:brightness-105"
      >
        <MessagesSquare size={22} strokeWidth={2} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-5 z-40 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-card-border bg-gold px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Atendimento</p>
          <p className="text-xs text-ink/70">Respondemos na hora</p>
        </div>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar atendimento" className="text-ink">
          <X size={18} />
        </button>
      </div>

      <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {mensagens.map((m, i) => (
          <div key={i} className={m.de === "cliente" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                m.de === "cliente" ? "bg-ink text-white" : "bg-surface text-ink"
              }`}
            >
              {m.texto}
            </div>
            {m.acao && (
              <a
                href={m.acao.href}
                target={m.acao.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="mt-1 block text-sm font-medium text-gold-deep hover:underline"
              >
                {m.acao.texto} →
              </a>
            )}
          </div>
        ))}
        {digitando && <p className="text-xs text-muted">digitando…</p>}
        <div ref={fim} />
      </div>

      {sugestoes.length > 0 && !digitando && (
        <div className="flex flex-wrap gap-1.5 border-t border-card-border px-3 py-2">
          {sugestoes.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => enviar(s)}
              className="rounded-full border border-card-border px-2.5 py-1 text-xs text-ink hover:bg-surface"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex items-center gap-2 border-t border-card-border px-3 py-2"
      >
        <input
          ref={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva sua dúvida…"
          maxLength={500}
          aria-label="Sua mensagem"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Enviar" disabled={!texto.trim() || digitando} className="text-gold-deep disabled:opacity-40">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
