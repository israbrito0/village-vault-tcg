"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { haQuanto, inteiro, reais, useAgora, useDash } from "@/lib/dash/cliente";
import { Avatar, Kpi, Vazio } from "@/components/dash/ui";

// Ranking de vendedores da Jamble inteira, por mês (o "Ranking Mensal de
// Vendedores" da Jamble, com todos os vendedores, não só o top 20).

type Linha = { id: string; posicao: number; handle: string; foto: string | null; pontos: number; recompensado: boolean };
type Mes = { mes: string; total: number; atualizadoEm: number };
type Resposta = { meses: Mes[]; mes: string | null; conta: string; lista: Linha[] };

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return `${NOMES[n - 1][0].toUpperCase()}${NOMES[n - 1].slice(1)} ${a}`;
};
const mesAnterior = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`;
};

export default function RankingJamble() {
  const { chamar } = useDash();
  const agora = useAgora(10000);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [mes, setMes] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(
    async (m: string | null) => {
      setErro("");
      try {
        setDados(await chamar<Resposta>(`/api/dash/ranking-jamble${m ? `?mes=${m}` : ""}`));
      } catch (e) {
        setErro(String((e as Error).message));
      }
    },
    [chamar],
  );

  useEffect(() => {
    carregar(mes);
  }, [carregar, mes]);

  async function atualizar() {
    setOcupado(true);
    try {
      await chamar("/api/dash/ranking-jamble", { corpo: { acao: "atualizar" } });
      await carregar(mes);
    } catch (e) {
      setErro(String((e as Error).message));
    }
    setOcupado(false);
  }

  const atual = dados?.mes ?? null;
  const info = dados?.meses.find((m) => m.mes === atual);
  // Os meses para escolher: os guardados e, se faltar, o anterior (para dizer
  // que ele não existe na Jamble).
  const meses = useMemo(() => {
    const lista = (dados?.meses ?? []).map((m) => m.mes);
    const primeiro = lista[lista.length - 1];
    if (primeiro && !lista.includes(mesAnterior(primeiro))) lista.push(mesAnterior(primeiro));
    return lista;
  }, [dados]);
  const semDados = mes && !dados?.meses.some((m) => m.mes === mes);

  const lista = useMemo(() => {
    const t = busca.trim().replace(/^@/, "").toLowerCase();
    return (dados?.lista ?? []).filter((l) => !t || l.handle.toLowerCase().includes(t));
  }, [dados, busca]);
  const eu = dados?.lista.find((l) => l.handle.toLowerCase() === dados.conta.toLowerCase());
  const primeiro = dados?.lista[0];

  return (
    <main className="d-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="d-page-title">Ranking de vendedores</h1>
          <p className="d-page-sub">Ranking Mensal de Vendedores da Jamble inteira: todos os vendedores, por pontos (+3 por R$ vendido, +2 por gema recebida).</p>
        </div>
        <input placeholder="Buscar @vendedor" className="d-field w-full sm:w-64" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </header>

      <section className="d-card flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {meses.map((m) => (
            <button key={m} className={`d-chip ${(mes ?? atual) === m ? "d-chip-on" : ""}`} onClick={() => setMes(m)}>
              {nomeDoMes(m)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {info && (
            <p className="text-xs text-d-ink3">
              {inteiro(info.total)} vendedores · lido {haQuanto(info.atualizadoEm, agora)}
            </p>
          )}
          <button className="d-btn d-btn-secondary" onClick={atualizar} disabled={ocupado}>
            <RefreshCw className={`size-4 ${ocupado ? "animate-spin" : ""}`} />
            Atualizar agora
          </button>
        </div>
      </section>
      {erro && <p className="text-sm text-d-bad">{erro}</p>}

      {semDados ? (
        <section className="d-card">
          <div className="d-card-body space-y-2 text-sm">
            <p className="font-semibold">{nomeDoMes(mes!)}: a Jamble não guarda o ranking de meses passados.</p>
            <p className="text-d-ink3">
              Ela só mostra o mês que está correndo, e esse mês fechou antes de o Dash começar a guardar. Daqui para frente o Dash salva o ranking todo dia (e às 23h50
              do último dia), então cada mês que fechar fica aqui para sempre.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi rotulo="Vendedores no ranking" valor={inteiro(dados?.lista.length ?? 0)} />
            <Kpi rotulo={`Sua posição (@${dados?.conta ?? ""})`} valor={eu ? `#${eu.posicao}` : "—"} cor="text-d-gold" />
            <Kpi rotulo="Seus pontos" valor={eu ? inteiro(eu.pontos) : "—"} />
            <Kpi rotulo={`Pontos do #1${primeiro ? ` (@${primeiro.handle})` : ""}`} valor={primeiro ? inteiro(primeiro.pontos) : "—"} />
          </div>

          <div className="d-card overflow-hidden">
            <div className="d-scroll overflow-x-auto">
              {!dados ? (
                <Vazio>Lendo o ranking da Jamble…</Vazio>
              ) : lista.length ? (
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="d-table-head">
                    <tr>
                      <th className="w-14 px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Vendedor</th>
                      <th className="px-4 py-3 text-right font-semibold">Pontos</th>
                      <th className="px-4 py-3 text-right font-semibold" title="A Jamble soma vendas e gemas nos pontos; se fosse tudo venda, seria isto (pontos ÷ 3)">
                        Vendido (até)
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">Atrás do anterior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-d-line">
                    {lista.map((l) => {
                      const anterior = dados.lista.find((x) => x.posicao === l.posicao - 1);
                      const sou = l.handle.toLowerCase() === dados.conta.toLowerCase();
                      return (
                        <tr key={l.id} className={sou ? "bg-d-brand/10" : "hover:bg-d-panel2/60"}>
                          <td className={`px-4 py-2.5 font-bold tabular-nums ${l.posicao <= 3 ? "text-d-gold" : "text-d-ink3"}`}>
                            {l.posicao <= 3 ? <Trophy className="mr-1 inline size-3.5" /> : null}
                            {l.posicao}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar foto={l.foto} nome={l.handle} tamanho={30} />
                              <span className="font-medium">@{l.handle}</span>
                              {sou && <span className="rounded-full bg-d-brand/15 px-2 py-0.5 text-[10px] font-semibold text-d-brand">você</span>}
                              {l.recompensado && <span className="rounded-full bg-d-ok/15 px-2 py-0.5 text-[10px] font-semibold text-d-ok">premiado</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">{inteiro(l.pontos)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{reais(l.pontos / 3)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-d-ink3">{anterior ? inteiro(anterior.pontos - l.pontos) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <Vazio>Nenhum vendedor {busca ? "com esse nome" : "neste mês"}.</Vazio>
              )}
            </div>
          </div>
          <p className="text-xs text-d-ink3">
            “Vendido (até)” é o máximo que o vendedor pode ter vendido: a Jamble junta vendas (3 pts por R$) e gemas recebidas (2 pts cada) nos mesmos pontos e não mostra
            as duas coisas separadas.
          </p>
        </>
      )}
    </main>
  );
}
