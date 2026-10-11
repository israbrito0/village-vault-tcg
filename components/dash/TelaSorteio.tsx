"use client";

import { useContext } from "react";
import { DashContexto, useLiveDash, usePreferencia } from "@/lib/dash/cliente";
import { useContasLive } from "@/components/dash/blocos";
import { duracaoDoGiro, Palco, useGiroDeFora, useSorteioAgendado, useSortear } from "@/components/dash/Sorteios";
import { DURACAO_PIAO } from "@/components/dash/Piao";

// Um sorteio sozinho, em 16:9 ou 9:16, para o OBS (fonte Navegador ou captura
// de janela). Abre com o link com a chave; quando alguém sorteia no painel,
// a roleta roda aqui também.

export function TelaSorteio({ showId, sorteioId, chave }: { showId: string; sorteioId?: string; chave?: string }) {
  const dash = useContext(DashContexto);
  const { dados: d, erro, trocar } = useLiveDash(showId, 2500, chave);
  const c = useContasLive(d);
  const [volume] = usePreferencia("volume", 1);
  const [mudo, setMudo] = usePreferencia("sorteio-mudo", false);
  const duracao = d ? duracaoDoGiro(d.visual) : DURACAO_PIAO;
  const { giro: meuGiro, sortear, acao } = useSortear(showId, trocar, mudo ? 0 : volume, duracao);
  const giroDeFora = useGiroDeFora(c, meuGiro, duracao, sorteioId);
  useSorteioAgendado(d?.sorteios, acao, !!dash && !!d?.podeEditar, d?.desvio ?? 0);

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
      acao={acao}
      podeEditar={!!dash && d.podeEditar}
      volume={volume}
      mudo={mudo}
      setMudo={setMudo}
      soUm={!!sorteioId}
    />
  );
}
