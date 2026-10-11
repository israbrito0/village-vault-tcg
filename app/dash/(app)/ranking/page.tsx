"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { haQuanto, inteiro, reais, useAgora, useDash } from "@/lib/dash/cliente";
import { Avatar, Kpi, Vazio } from "@/components/dash/ui";

// Ranking de vendedores da Jamble inteira, por mês: os pontos do "Ranking
// Mensal de Vendedores" (todos os vendedores, não só o top 20) e o vendido de
// verdade de cada um, somado das listas de vendidos das lives dele. Meses que a
// Jamble não guarda mais aparecem só com o vendido.

type Linha = {
  id: string;
  posicao: number;
  handle: string;
  foto: string | null;
  pontos: number | null;
  recompensado: boolean;
  vendido: number | null;
  itens: number;
  lives: number;
  pendentes: number;
  parcialDesde: number | null;
  lido: boolean;
};
type Mes = { mes: string; total: number; atualizadoEm: number | null; temPontos: boolean };
type Resposta = {
  meses: Mes[];
  mes: string | null;
  temPontos: boolean;
  conta: string;
  leitura: { vendedoresLidos: number; vendedores: number; livesPendentes: number; ultimaRodada: number | null };
  lista: Linha[];
};

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return `${NOMES[n - 1][0].toUpperCase()}${NOMES[n - 1].slice(1)} ${a}`;
};
const diaMes = (ts: number) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

// Gemas que o vendedor recebeu no mês: pontos = 3 × vendido + 2 × gemas.
// Só com o vendido completo (sem lives faltando).
const gemasDe = (l: Linha) =>
  l.pontos != null && l.vendido != null && !l.parcialDesde && !l.pendentes ? Math.max(0, Math.round((l.pontos - 3 * l.vendido) / 2)) : null;

function Vendido({ l }: { l: Linha }) {
  if (l.vendido == null) return <span className="text-xs text-d-ink3">lendo…</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-semibold text-d-ok">{reais(l.vendido)}</span>
      {l.parcialDesde ? (
        <span className="text-[10px] font-medium text-d-warn" title="A Jamble só mostra as 20 lives mais recentes de cada vendedor: as lives do mês antes desta data não entraram na soma.">
          parcial · desde {diaMes(l.parcialDesde)}
        </span>
      ) : l.pendentes ? (
        <span className="text-[10px] text-d-ink3">+{l.pendentes} {l.pendentes === 1 ? "live" : "lives"} na fila</span>
      ) : null}
    </span>
  );
}

export default function RankingJamble() {
  const { chamar } = useDash();
  const agora = useAgora(10000);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [mes, setMes] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"pontos" | "vendido">("pontos");
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

  // Enquanto a leitura dos vendidos não termina, atualiza sozinho a cada minuto.
  const lendo = !!dados && (dados.leitura.vendedoresLidos < dados.leitura.vendedores || dados.leitura.livesPendentes > 0);
  useEffect(() => {
    if (!lendo) return;
    const t = setInterval(() => carregar(mes), 60000);
    return () => clearInterval(t);
  }, [lendo, carregar, mes]);

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
  const temPontos = dados?.temPontos ?? true;
  const porVendido = ordem === "vendido" || !temPontos;

  const lista = useMemo(() => {
    const t = busca.trim().replace(/^@/, "").toLowerCase();
    const l = (dados?.lista ?? []).filter((x) => !t || x.handle.toLowerCase().includes(t));
    return porVendido ? [...l].sort((a, b) => (b.vendido ?? -1) - (a.vendido ?? -1)) : l;
  }, [dados, busca, porVendido]);
  const conta = dados?.conta.toLowerCase() ?? "";
  const eu = dados?.lista.find((l) => l.handle.toLowerCase() === conta);
  const primeiro = dados?.lista[0];
  const posicaoPorVendido = eu?.vendido != null ? [...(dados?.lista ?? [])].sort((a, b) => (b.vendido ?? -1) - (a.vendido ?? -1)).findIndex((l) => l.id === eu.id) + 1 : 0;

  return (
    <main className="d-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="d-page-title">Ranking de vendedores</h1>
          <p className="d-page-sub">
            Ranking Mensal de Vendedores da Jamble inteira: os pontos (+3 por R$ vendido, +2 por gema recebida) e o vendido de verdade de cada vendedor, somado das vendas
            das lives dele.
          </p>
        </div>
        <input placeholder="Buscar @vendedor" className="d-field w-full sm:w-64" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </header>

      <section className="d-card flex flex-wrap items-center gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {(dados?.meses ?? []).map((m) => (
            <button key={m.mes} className={`d-chip ${(mes ?? atual) === m.mes ? "d-chip-on" : ""}`} onClick={() => setMes(m.mes)}>
              {nomeDoMes(m.mes)}
            </button>
          ))}
          {temPontos && (
            <>
              <span className="mx-1 w-px self-stretch bg-d-line" />
              <button className={`d-chip ${ordem === "pontos" ? "d-chip-on" : ""}`} onClick={() => setOrdem("pontos")}>
                Por pontos
              </button>
              <button className={`d-chip ${ordem === "vendido" ? "d-chip-on" : ""}`} onClick={() => setOrdem("vendido")}>
                Por vendido
              </button>
            </>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {info?.atualizadoEm && (
            <p className="text-xs text-d-ink3">
              {inteiro(info.total)} vendedores · pontos lidos {haQuanto(info.atualizadoEm, agora)}
            </p>
          )}
          <button className="d-btn d-btn-secondary" onClick={atualizar} disabled={ocupado}>
            <RefreshCw className={`size-4 ${ocupado ? "animate-spin" : ""}`} />
            Atualizar agora
          </button>
        </div>
      </section>
      {erro && <p className="text-sm text-d-bad">{erro}</p>}
      {dados && lendo && (
        <p className="text-xs text-d-ink3">
          Somando os vendidos: {inteiro(dados.leitura.vendedoresLidos)} de {inteiro(dados.leitura.vendedores)} vendedores lidos
          {dados.leitura.livesPendentes ? ` · ${inteiro(dados.leitura.livesPendentes)} lives na fila` : ""}
          {dados.leitura.ultimaRodada ? ` · última rodada ${haQuanto(dados.leitura.ultimaRodada, agora)}` : ""}. A página se atualiza sozinha.
        </p>
      )}
      {dados && !temPontos && (
        <p className="text-xs text-d-ink3">
          {nomeDoMes(dados.mes!)}: a Jamble não guarda os pontos de meses passados, então as posições aqui são pela soma das vendas de cada vendedor.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {temPontos ? (
          <>
            <Kpi rotulo={`Sua posição (@${dados?.conta ?? ""})`} valor={eu ? `#${eu.posicao}` : "—"} cor="text-d-gold" />
            <Kpi rotulo="Seus pontos" valor={eu?.pontos != null ? inteiro(eu.pontos) : "—"} />
            <Kpi rotulo="Seu vendido no mês" valor={eu?.vendido != null ? reais(eu.vendido) : "—"} dinheiro />
            <Kpi rotulo={`Pontos do #1${primeiro ? ` (@${primeiro.handle})` : ""}`} valor={primeiro?.pontos != null ? inteiro(primeiro.pontos) : "—"} />
          </>
        ) : (
          <>
            <Kpi rotulo="Vendedores com vendas" valor={inteiro(dados?.lista.length ?? 0)} />
            <Kpi rotulo={`Sua posição pelo vendido (@${dados?.conta ?? ""})`} valor={posicaoPorVendido ? `#${posicaoPorVendido}` : "—"} cor="text-d-gold" />
            <Kpi rotulo="Seu vendido no mês" valor={eu?.vendido != null ? reais(eu.vendido) : "—"} dinheiro />
            <Kpi rotulo={`Vendido do #1${primeiro ? ` (@${primeiro.handle})` : ""}`} valor={primeiro?.vendido != null ? reais(primeiro.vendido) : "—"} dinheiro />
          </>
        )}
      </div>

      <div className="d-card overflow-hidden">
        <div className="d-scroll overflow-x-auto">
          {!dados ? (
            <Vazio>Lendo o ranking da Jamble…</Vazio>
          ) : lista.length ? (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="d-table-head">
                <tr>
                  <th className="w-14 px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Vendedor</th>
                  {temPontos && <th className="px-4 py-3 text-right font-semibold">Pontos</th>}
                  <th className="px-4 py-3 text-right font-semibold" title="Soma das vendas pagas (sem canceladas) das lives do vendedor no mês, pela lista de vendidos de cada live">
                    Vendido
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Itens</th>
                  <th className="px-4 py-3 text-right font-semibold">Lives</th>
                  {temPontos && (
                    <th className="px-4 py-3 text-right font-semibold" title="Gemas recebidas no mês: (pontos − 3 × vendido) ÷ 2. Só quando o vendido está completo.">
                      Gemas (≈)
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-d-line">
                {lista.map((l, i) => {
                  const sou = l.handle.toLowerCase() === conta;
                  const pos = porVendido ? i + 1 : l.posicao;
                  const gemas = gemasDe(l);
                  return (
                    <tr key={l.id} className={sou ? "bg-d-brand/10" : "hover:bg-d-panel2/60"}>
                      <td className={`px-4 py-2.5 font-bold tabular-nums ${pos <= 3 ? "text-d-gold" : "text-d-ink3"}`}>
                        {pos <= 3 ? <Trophy className="mr-1 inline size-3.5" /> : null}
                        {pos}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar foto={l.foto} nome={l.handle} tamanho={30} />
                          <span className="font-medium">@{l.handle}</span>
                          {sou && <span className="rounded-full bg-d-brand/15 px-2 py-0.5 text-[10px] font-semibold text-d-brand">você</span>}
                          {l.recompensado && <span className="rounded-full bg-d-ok/15 px-2 py-0.5 text-[10px] font-semibold text-d-ok">premiado</span>}
                          {porVendido && temPontos && <span className="text-[10px] text-d-ink3">#{l.posicao} em pontos</span>}
                        </div>
                      </td>
                      {temPontos && <td className="px-4 py-2.5 text-right font-bold tabular-nums">{l.pontos != null ? inteiro(l.pontos) : "—"}</td>}
                      <td className="dash-valor px-4 py-2.5 text-right tabular-nums">
                        <Vendido l={l} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{l.vendido != null ? inteiro(l.itens) : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{l.lido ? inteiro(l.lives) : "—"}</td>
                      {temPontos && <td className="px-4 py-2.5 text-right tabular-nums text-d-ink2">{gemas != null ? inteiro(gemas) : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Vazio>{busca ? "Nenhum vendedor com esse nome." : "Ainda sem vendas lidas neste mês."}</Vazio>
          )}
        </div>
      </div>
      <p className="text-xs text-d-ink3">
        O vendido vem das listas de vendidos das lives, que a Jamble deixa abertas: vendas pagas, sem as canceladas, contadas no mês em que aconteceram. As lives de cada
        vendedor vêm do perfil dele, que só mostra as 20 mais recentes; quando as lives do mês passam disso, a soma fica marcada como parcial. Daqui para frente o Dash
        também guarda toda live que entra no ar, então os próximos meses ficam completos.
      </p>
    </main>
  );
}
