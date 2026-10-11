"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { DashContexto, useLiveDash, usePreferencia } from "@/lib/dash/cliente";
import { useContasLive } from "@/components/dash/blocos";
import { duracaoDoGiro, Palco, useSortear } from "@/components/dash/Sorteios";
import { DURACAO_PIAO } from "@/components/dash/Piao";
import { TEMPO_DO_GANHADOR_MS } from "@/components/dash/RespostaDoGanhador";

// Um sorteio sozinho, em 16:9 ou 9:16, para o OBS (fonte Navegador ou captura
// de janela). Abre com o link com a chave; quando alguém sorteia no painel,
// a roleta roda aqui também.

type Pessoa = { handle: string; foto: string | null; bilhetes: number };

export function TelaSorteio({ showId, sorteioId, chave }: { showId: string; sorteioId?: string; chave?: string }) {
  const dash = useContext(DashContexto);
  const { dados: d, erro, trocar } = useLiveDash(showId, 2500, chave);
  const c = useContasLive(d);
  const [volume] = usePreferencia("volume", 1);
  const [mudo, setMudo] = usePreferencia("sorteio-mudo", false);
  const duracao = d ? duracaoDoGiro(d.visual) : DURACAO_PIAO;
  const { giro: meuGiro, sortear } = useSortear(showId, trocar, mudo ? 0 : volume, duracao);
  const [giroDeFora, setGiroDeFora] = useState<{ chave: string; sorteioId: string; ganhador: Pessoa; lista: Pessoa[]; premio: string | null; nome: string } | null>(null);
  const vistos = useRef<Set<string> | null>(null);

  // Ganhador novo que não foi sorteado nesta janela: roda a roleta aqui.
  useEffect(() => {
    if (!c) return;
    const todos = c.sorteios.flatMap((s) => s.ganhadores.map((g) => ({ s, g })));
    if (vistos.current === null) {
      vistos.current = new Set(todos.map((x) => x.g.id));
      return;
    }
    const novo = todos.find((x) => !vistos.current!.has(x.g.id) && x.g.status === "valido" && (!sorteioId || x.s.id === sorteioId));
    for (const x of todos) vistos.current.add(x.g.id);
    if (novo && meuGiro?.chave !== novo.g.id && Date.now() - novo.g.ts < 60000) {
      const lista = novo.s.concorrendo.slice(0, 60).map((p) => ({ handle: p.handle, foto: p.foto, bilhetes: p.bilhetes }));
      setGiroDeFora({
        chave: novo.g.id,
        sorteioId: novo.s.id,
        ganhador: { handle: novo.g.handle, foto: novo.g.foto, bilhetes: novo.g.bilhetes },
        lista: lista.length ? lista : [{ handle: novo.g.handle, foto: novo.g.foto, bilhetes: 1 }],
        premio: novo.s.premio,
        nome: novo.s.nome,
      });
      // O giro e os 10 segundos para o ganhador responder no chat.
      setTimeout(() => setGiroDeFora(null), duracao + TEMPO_DO_GANHADOR_MS + 500);
    }
  }, [c, sorteioId, meuGiro?.chave, duracao]);

  if (!d || !c) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-d-ink3">
        {erro ? (erro.includes("acesso") ? "Link da tela inválido ou expirado." : erro) : "Abrindo o sorteio…"}
      </div>
    );
  }
  return (
    <Palco
      d={d}
      c={c}
      inicial={sorteioId}
      giro={meuGiro ?? giroDeFora}
      sortear={sortear}
      podeEditar={!!dash && d.podeEditar}
      volume={volume}
      mudo={mudo}
      setMudo={setMudo}
      soUm={!!sorteioId}
    />
  );
}
