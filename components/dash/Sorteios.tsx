"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pencil, Plus, Radio, RotateCcw, Save, Shuffle, Trash2, Tv, UserX, X } from "lucide-react";
import {
  FONTES,
  TIPOS_DE_META,
  lerTermos,
  marcos,
  mensagemDeGanhador,
  metaPorPessoa,
  nomeDaFonte,
  participantes,
  pontosDaLive,
  porIcone,
  progressoMeta,
  rankingCarpas,
  resumoVendas,
  tipoDeMeta,
  totalDaFonte,
  type Participante,
  type Totais,
} from "@/lib/dash/calculos";
import type { Meta, Sorteio } from "@/lib/dash/api";
import { copiar, dataHora, inteiro, linkDaTela, reais, useDash, useLiveDash, usePreferencia, type LiveCarregada } from "@/lib/dash/cliente";
import { tocar } from "@/lib/dash/som";
import Roleta from "@/components/dash/Roleta";
import { AoVivo, Avatar, Barra, Botao, Cartao, campo, IconeEmocao, Rolagem, Selo, Vazio } from "@/components/dash/ui";

type FormSorteio = {
  id?: string;
  nome: string;
  premio: string;
  fonte: string;
  peso: "quantidade" | "igual";
  repetir: boolean;
  excluirSuspeitos: boolean;
  excluir: string;
  modo: "livre" | "meta";
  aCada: string;
  ativo: boolean;
};

const FORM_VAZIO: FormSorteio = {
  nome: "",
  premio: "",
  fonte: "carpas",
  peso: "quantidade",
  repetir: false,
  excluirSuspeitos: true,
  excluir: "",
  modo: "livre",
  aCada: "",
  ativo: true,
};

type Modelo = Omit<FormSorteio, "id" | "excluir" | "ativo"> & { rotulo: string };

const MODELOS: Modelo[] = [
  { rotulo: "1 sorteio a cada 50 carpas", nome: "Sorteio das carpas", premio: "", fonte: "carpas", peso: "quantidade", repetir: false, excluirSuspeitos: true, modo: "meta", aCada: "50" },
  { rotulo: "Compradores da live", nome: "Sorteio dos compradores", premio: "", fonte: "compradores", peso: "quantidade", repetir: false, excluirSuspeitos: true, modo: "livre", aCada: "" },
  { rotulo: "Quem mandou emotion (1 chance cada)", nome: "Sorteio das emotions", premio: "", fonte: "emocoes", peso: "igual", repetir: false, excluirSuspeitos: true, modo: "livre", aCada: "" },
  { rotulo: "1 sorteio a cada 5.000 gemas", nome: "Sorteio das gemas", premio: "", fonte: "gemas", peso: "quantidade", repetir: false, excluirSuspeitos: true, modo: "meta", aCada: "5000" },
  { rotulo: "Quem escreveu no chat", nome: "Sorteio do chat", premio: "", fonte: "chat", peso: "igual", repetir: false, excluirSuspeitos: true, modo: "livre", aCada: "" },
];

function formDe(s: Sorteio): FormSorteio {
  return {
    id: s.id,
    nome: s.nome,
    premio: s.premio ?? "",
    fonte: s.fonte,
    peso: s.peso,
    repetir: s.repetir,
    excluirSuspeitos: s.excluirSuspeitos,
    excluir: s.excluir.join(", "),
    modo: s.modo,
    aCada: s.aCada ? String(s.aCada) : "",
    ativo: s.ativo,
  };
}

function corpoDe(f: FormSorteio) {
  return {
    nome: f.nome || "Sorteio",
    premio: f.premio || null,
    fonte: f.fonte,
    peso: f.peso,
    repetir: f.repetir,
    excluirSuspeitos: f.excluirSuspeitos,
    excluir: f.excluir.split(/[\s,;]+/).map((h) => h.replace(/^@/, "")).filter(Boolean),
    modo: f.modo,
    aCada: f.modo === "meta" ? Number(f.aCada) || null : null,
    ativo: f.ativo,
  };
}

function dadosDoSorteio(d: LiveCarregada, s: Sorteio) {
  const termos = lerTermos(d.termos);
  const validos = s.ganhadores.filter((g) => g.status === "valido");
  const naoValidos = s.ganhadores.filter((g) => g.status !== "valido").map((g) => g.handle);
  const base = { emocoes: d.emocoes, mensagens: d.chat, vendas: d.vendas, termos, vendedor: d.live.vendedor };
  const lista = participantes(
    { fonte: s.fonte, peso: s.peso, repetir: s.repetir, excluirSuspeitos: s.excluirSuspeitos, excluir: [...s.excluir, ...naoValidos] },
    base,
    validos.map((g) => g.handle),
  );
  const ok = lista.filter((p) => !p.fora);
  const bilhetes = ok.reduce((t, p) => t + p.bilhetes, 0);
  const cru =
    s.fonte === "gemas"
      ? d.emocoes.reduce((t, e) => t + e.gemas, 0)
      : totalDaFonte(
          participantes({ fonte: s.fonte, peso: "quantidade", repetir: true, excluirSuspeitos: false, excluir: [] }, { ...base, vendedor: null }).map((p) => ({ n: p.bilhetes })),
        );
  return { lista, ok, bilhetes, validos, marcos: s.modo === "meta" && s.aCada ? marcos(s.aCada, cru, validos.length) : null, totalFonte: cru };
}

function CartaoSorteio({
  s,
  d,
  showId,
  aoMudar,
  aoEditar,
  aoSortear,
}: {
  s: Sorteio;
  d: LiveCarregada;
  showId: string;
  aoMudar: (sorteios: Sorteio[]) => void;
  aoEditar: () => void;
  aoSortear: (acao: "sortear" | "resortear") => void;
}) {
  const { chamar, eu } = useDash();
  const [verFora, setVerFora] = useState(false);
  const [copiado, setCopiado] = useState("");
  const x = useMemo(() => dadosDoSorteio(d, s), [d, s]);
  const nomes = Object.fromEntries(Object.entries(d.icones).map(([k, v]) => [k, v.nome ?? k]));
  const fonte = nomeDaFonte(s.fonte, nomes);
  const fora = x.lista.filter((p) => p.fora);
  const travado = !!x.marcos && x.marcos.disponiveis <= 0;

  async function acao(corpo: Record<string, unknown>) {
    try {
      const r = await chamar<{ sorteios: Sorteio[] }>(`/api/dash/sorteios/${encodeURIComponent(showId)}`, { corpo: { id: s.id, ...corpo } });
      aoMudar(r.sorteios);
    } catch (e) {
      alert(String((e as Error).message));
    }
  }

  const mudarExcluir = (handle: string, tirar: boolean) => {
    const atual = new Set(s.excluir);
    if (tirar) atual.add(handle.toLowerCase());
    else atual.delete(handle.toLowerCase());
    acao({ acao: "editar", excluir: [...atual] });
  };

  async function copiarLink(rotulo: string, f: string) {
    await copiar(linkDaTela(eu.config.telaChave, { v: "sorteio", f, s: s.id }));
    setCopiado(rotulo);
    setTimeout(() => setCopiado(""), 1800);
  }

  return (
    <Cartao
      titulo={
        <span className="flex items-center gap-2">
          {s.nome}
          {!s.ativo && <Selo>fora da tela</Selo>}
        </span>
      }
      acao={
        <span className="flex items-center gap-1">
          <button title="Editar" onClick={aoEditar} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <Pencil size={14} />
          </button>
          <button
            title="Excluir"
            onClick={() => confirm(`Excluir "${s.nome}" e os ganhadores dele?`) && acao({ acao: "excluir" })}
            className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-[#ff8a8a]"
          >
            <Trash2 size={14} />
          </button>
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#8b93a7]">
        {s.premio && <Selo cor="amarelo">🎁 {s.premio}</Selo>}
        <span>{fonte.nome}</span>·<span>{s.peso === "igual" ? "1 chance por pessoa" : "chance por quantidade"}</span>·
        <span>{s.repetir ? "pode repetir ganhador" : "não repete ganhador"}</span>
        {s.fonte.startsWith("emocao:") && <IconeEmocao id={s.fonte.slice(7)} icones={d.icones} tamanho={18} />}
      </div>

      {x.marcos ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span>
              A cada <b>{inteiro(s.aCada ?? 0)}</b> {fonte.unidade}: {x.marcos.liberados} liberado(s), {x.validos.length} sorteado(s)
            </span>
            {x.marcos.disponiveis > 0 ? <Selo cor="verde">{x.marcos.disponiveis} para sortear</Selo> : <Selo>faltam {inteiro(x.marcos.faltaParaProximo)}</Selo>}
          </div>
          <Barra progresso={x.marcos.progresso} />
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-[#8b93a7]">Sorteio livre: sorteie quando quiser. {inteiro(x.totalFonte)} {fonte.unidade} até agora.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Botao cor="amarelo" onClick={() => aoSortear("sortear")} disabled={!x.ok.length || travado} titulo={travado ? "Ainda não liberou" : undefined}>
          <Shuffle size={14} /> Sortear agora
        </Botao>
        <Botao onClick={() => aoSortear("resortear")} disabled={!x.validos.length} titulo="O último ganhador não vale; sorteia outro">
          <RotateCcw size={14} /> Re-sortear
        </Botao>
        <Botao onClick={() => confirm("Apagar todos os ganhadores deste sorteio?") && acao({ acao: "zerar" })} disabled={!s.ganhadores.length}>
          Zerar
        </Botao>
        <Botao ativo={s.ativo} onClick={() => acao({ acao: "editar", ativo: !s.ativo })} titulo="Mostrar este sorteio na tela do OBS">
          <Tv size={14} /> {s.ativo ? "Na tela" : "Mostrar na tela"}
        </Botao>
        <Botao onClick={() => copiarLink("16", "16x9")}>
          <Copy size={12} /> {copiado === "16" ? "Copiado!" : "Tela 16:9"}
        </Botao>
        <Botao onClick={() => copiarLink("9", "9x16")}>
          <Copy size={12} /> {copiado === "9" ? "Copiado!" : "Tela 9:16"}
        </Botao>
      </div>

      {s.ganhadores.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b93a7]">Ganhadores</p>
          <ul className="space-y-1.5">
            {s.ganhadores.map((g, i) => (
              <li key={g.id} className={`flex items-center gap-2 text-[13px] ${g.status !== "valido" ? "opacity-50" : ""}`}>
                <span className="w-5 text-right text-[11px] text-[#8b93a7]">{i + 1}</span>
                <Avatar foto={g.foto} nome={g.handle} tamanho={24} />
                <span className="min-w-0 flex-1 truncate font-semibold">@{g.handle}</span>
                <span className="text-[11px] text-[#8b93a7]">
                  {g.bilhetes}/{g.totalBilhetes} bilhetes · {dataHora(g.ts)}
                </span>
                {g.status === "valido" ? (
                  <>
                    <button title="Copiar mensagem" onClick={() => copiar(mensagemDeGanhador(g.handle, s.premio))} className="rounded p-1 text-white/50 hover:text-white">
                      <Copy size={13} />
                    </button>
                    <button title="Marcar ausente" onClick={() => acao({ acao: "ausente", ganhadorId: g.id })} className="rounded p-1 text-white/50 hover:text-[#ff8a8a]">
                      <UserX size={13} />
                    </button>
                  </>
                ) : (
                  <Selo>{g.status}</Selo>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b93a7]">
            Participantes · {x.ok.length} concorrendo · {inteiro(x.bilhetes)} bilhetes
          </p>
          {fora.length > 0 && (
            <button onClick={() => setVerFora(!verFora)} className="text-[11px] text-brand-yellow hover:underline">
              {verFora ? "esconder" : "ver"} {fora.length} fora
            </button>
          )}
        </div>
        <Rolagem altura="max-h-64">
          {x.ok.length ? (
            <ul className="space-y-1">
              {x.ok.slice(0, 200).map((p: Participante) => (
                <li key={p.handle} className="group flex items-center gap-2 text-[12px]">
                  <Avatar foto={p.foto} nome={p.handle} tamanho={20} />
                  <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                  <span className="text-[#8b93a7]">{inteiro(p.bilhetes)} 🎟</span>
                  <span className="w-14 text-right font-semibold">{x.bilhetes ? ((p.bilhetes / x.bilhetes) * 100).toFixed(1) : 0}%</span>
                  <button title="Tirar do sorteio" onClick={() => mudarExcluir(p.handle, true)} className="text-white/30 opacity-0 hover:text-[#ff8a8a] group-hover:opacity-100">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Ninguém concorrendo ainda.</Vazio>
          )}
        </Rolagem>
        {verFora && (
          <div className="mt-2 rounded-lg bg-white/[0.03] p-2">
            <label className="mb-2 flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={s.excluirSuspeitos} onChange={(e) => acao({ acao: "editar", excluirSuspeitos: e.target.checked })} className="accent-[#F4AF14]" />
              tirar contas suspeitas (em lote) deste sorteio
            </label>
            <ul className="space-y-1">
              {fora.map((p) => (
                <li key={p.handle} className="flex items-center gap-2 text-[12px] text-white/60">
                  <span className="min-w-0 flex-1 truncate">@{p.handle}</span>
                  <Selo cor={p.fora === "conta suspeita" ? "vermelho" : "neutro"}>{p.fora}</Selo>
                  {p.fora === "tirado da lista" && (
                    <button onClick={() => mudarExcluir(p.handle, false)} className="text-[11px] text-brand-yellow hover:underline">
                      incluir
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Cartao>
  );
}

function FormularioSorteio({
  inicial,
  icones,
  aoSalvar,
  aoFechar,
}: {
  inicial: FormSorteio;
  icones: { id: string; nome: string }[];
  aoSalvar: (f: FormSorteio) => Promise<void>;
  aoFechar: () => void;
}) {
  const { eu, chamar, recarregarEu } = useDash();
  const [f, setF] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const salvos = ((eu.config.preferencias?.modelos as Modelo[] | undefined) ?? []).filter((m) => m && m.rotulo);
  const muda = (k: Partial<FormSorteio>) => setF({ ...f, ...k });

  async function salvarModelo() {
    const rotulo = prompt("Nome do modelo:", f.nome || "Meu modelo");
    if (!rotulo) return;
    const { id: _id, excluir: _e, ativo: _a, ...resto } = f;
    const modelos = [...salvos.filter((m) => m.rotulo !== rotulo), { ...resto, rotulo }].slice(-20);
    await chamar("/api/dash/eu", { metodo: "PATCH", corpo: { preferencias: { modelos } } });
    recarregarEu();
  }

  return (
    <Cartao titulo={f.id ? "Editar sorteio" : "Novo sorteio"} acao={<button onClick={aoFechar} className="text-white/50 hover:text-white"><X size={16} /></button>}>
      {!f.id && (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] text-[#8b93a7]">Modelos</p>
          <div className="flex flex-wrap gap-1.5">
            {[...MODELOS, ...salvos].map((m) => (
              <Botao key={m.rotulo} onClick={() => setF({ ...FORM_VAZIO, ...m })}>
                {m.rotulo}
              </Botao>
            ))}
          </div>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          await aoSalvar(f);
          setOcupado(false);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="text-[12px]">
          Nome
          <input className={`${campo} mt-1`} value={f.nome} onChange={(e) => muda({ nome: e.target.value })} placeholder="Sorteio das carpas" required />
        </label>
        <label className="text-[12px]">
          Prêmio
          <input className={`${campo} mt-1`} value={f.premio} onChange={(e) => muda({ premio: e.target.value })} placeholder="1 mini booster box" />
        </label>
        <label className="text-[12px] sm:col-span-2">
          Quem concorre (de onde vêm os bilhetes)
          <select className={`${campo} mt-1`} value={f.fonte} onChange={(e) => muda({ fonte: e.target.value })}>
            {FONTES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
            {icones.map((i) => (
              <option key={i.id} value={`emocao:${i.id}`}>
                Só quem mandou a emotion {i.nome}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-[12px]">
          <legend className="mb-1">Chances</legend>
          <label className="mr-4 inline-flex items-center gap-1.5">
            <input type="radio" checked={f.peso === "quantidade"} onChange={() => muda({ peso: "quantidade" })} className="accent-[#F4AF14]" />
            por quantidade
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={f.peso === "igual"} onChange={() => muda({ peso: "igual" })} className="accent-[#F4AF14]" />1 por pessoa
          </label>
        </fieldset>
        <fieldset className="text-[12px]">
          <legend className="mb-1">Quando sortear</legend>
          <label className="mr-4 inline-flex items-center gap-1.5">
            <input type="radio" checked={f.modo === "livre"} onChange={() => muda({ modo: "livre" })} className="accent-[#F4AF14]" />
            quando eu quiser
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" checked={f.modo === "meta"} onChange={() => muda({ modo: "meta" })} className="accent-[#F4AF14]" />a cada
            <input
              type="number"
              min={1}
              className="w-20 rounded border border-white/10 bg-[#0f1116] px-2 py-0.5"
              value={f.aCada}
              onChange={(e) => muda({ aCada: e.target.value, modo: "meta" })}
            />
            {nomeDaFonte(f.fonte).unidade}
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-4 text-[12px] sm:col-span-2">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={f.repetir} onChange={(e) => muda({ repetir: e.target.checked })} className="accent-[#F4AF14]" />
            pode repetir ganhador
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={f.excluirSuspeitos} onChange={(e) => muda({ excluirSuspeitos: e.target.checked })} className="accent-[#F4AF14]" />
            tirar contas suspeitas
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={f.ativo} onChange={(e) => muda({ ativo: e.target.checked })} className="accent-[#F4AF14]" />
            mostrar na tela do OBS
          </label>
        </div>
        <label className="text-[12px] sm:col-span-2">
          Tirar da lista (@ separados por vírgula)
          <input className={`${campo} mt-1`} value={f.excluir} onChange={(e) => muda({ excluir: e.target.value })} placeholder="@fulano, @ciclano" />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Botao type="submit" cor="amarelo" disabled={ocupado || (f.modo === "meta" && !(Number(f.aCada) > 0))}>
            <Save size={14} /> {f.id ? "Salvar" : "Criar sorteio"}
          </Botao>
          <Botao onClick={salvarModelo}>Salvar como modelo</Botao>
        </div>
      </form>
    </Cartao>
  );
}

function SecaoMetas({ d, showId, totais, aoMudar }: { d: LiveCarregada; showId: string; totais: Totais; aoMudar: (m: Meta[]) => void }) {
  const { chamar } = useDash();
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ nome: "", tipo: "carpas", escopo: "live" as "live" | "pessoa", alvo: "", premio: "" });
  const [silencio, setSilencio] = usePreferencia("metas-silencio", false);
  const [som] = usePreferencia("som", { ligado: true, volume: 0.5 });
  const termos = lerTermos(d.termos);
  const tipo = tipoDeMeta(f.tipo);

  // Toca a fanfarra quando uma meta da live passa do alvo (com esta tela aberta).
  const batidas = d.metas.filter((m) => m.escopo === "live" && progressoMeta(m, totais).batida).map((m) => m.id).join();
  const antes = useRef<string | null>(null);
  useEffect(() => {
    const ja = antes.current;
    antes.current = batidas;
    if (ja === null || silencio || !som.ligado) return;
    if (batidas.split(",").some((id) => id && !ja.split(",").includes(id))) tocar("meta", som.volume);
  }, [batidas, silencio, som]);

  async function acao(corpo: Record<string, unknown>) {
    try {
      const r = await chamar<{ metas: Meta[] }>(`/api/dash/metas/${encodeURIComponent(showId)}`, { corpo });
      aoMudar(r.metas);
      return true;
    } catch (e) {
      alert(String((e as Error).message));
      return false;
    }
  }

  return (
    <Cartao
      titulo="Metas"
      acao={
        <span className="flex items-center gap-2">
          <Botao ativo={silencio} onClick={() => setSilencio(!silencio)}>
            {silencio ? "Silenciada" : "Silenciar"}
          </Botao>
          <Botao cor="amarelo" onClick={() => setAberto(!aberto)}>
            <Plus size={14} /> Nova meta
          </Botao>
        </span>
      }
    >
      {aberto && (
        <form
          className="mb-4 grid gap-3 rounded-lg bg-white/[0.03] p-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await acao({ acao: "criar", ...f, alvo: Number(f.alvo) })) {
              setAberto(false);
              setF({ ...f, nome: "", alvo: "", premio: "" });
            }
          }}
        >
          <label className="text-[12px]">
            Nome
            <input className={`${campo} mt-1`} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Meta das carpas" />
          </label>
          <label className="text-[12px]">
            Conta o quê
            <select className={`${campo} mt-1`} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, escopo: tipoDeMeta(e.target.value).pessoa ? f.escopo : "live" })}>
              {TIPOS_DE_META.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-[12px]">
            <legend className="mb-1">De quem</legend>
            <label className="mr-4 inline-flex items-center gap-1.5">
              <input type="radio" checked={f.escopo === "live"} onChange={() => setF({ ...f, escopo: "live" })} className="accent-[#F4AF14]" />a live inteira
            </label>
            <label className={`inline-flex items-center gap-1.5 ${tipo.pessoa ? "" : "opacity-40"}`}>
              <input type="radio" disabled={!tipo.pessoa} checked={f.escopo === "pessoa"} onChange={() => setF({ ...f, escopo: "pessoa" })} className="accent-[#F4AF14]" />
              cada pessoa (individual)
            </label>
          </fieldset>
          <label className="text-[12px]">
            {f.tipo === "posicao" ? "Chegar ao #" : `Alvo (${tipo.unidade})`}
            <input type="number" min={1} step="any" className={`${campo} mt-1`} value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })} required />
          </label>
          <label className="text-[12px] sm:col-span-2">
            Prêmio (opcional)
            <input className={`${campo} mt-1`} value={f.premio} onChange={(e) => setF({ ...f, premio: e.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <Botao type="submit" cor="amarelo">
              Criar meta
            </Botao>
          </div>
        </form>
      )}
      {d.metas.length ? (
        <ul className="space-y-4">
          {d.metas.map((m) => {
            const p = progressoMeta(m, totais);
            const t = tipoDeMeta(m.tipo);
            const pessoas = m.escopo === "pessoa" ? metaPorPessoa(m, { emocoes: d.emocoes, mensagens: d.chat, vendas: d.vendas, termos }) : null;
            const dinheiro = m.tipo === "faturamento";
            return (
              <li key={m.id}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">
                    🎯 {m.nome || t.nome} {m.premio && <span className="font-normal text-[#8b93a7]">· 🎁 {m.premio}</span>}
                  </span>
                  {m.escopo === "pessoa" ? <Selo cor="azul">individual</Selo> : p.batida && <Selo cor="verde">batida!</Selo>}
                  <button title="Excluir" onClick={() => confirm("Excluir esta meta?") && acao({ acao: "excluir", id: m.id })} className="text-white/40 hover:text-[#ff8a8a]">
                    <Trash2 size={13} />
                  </button>
                </div>
                {pessoas ? (
                  <div className="mt-1 text-[12px]">
                    <p className="text-[#8b93a7]">
                      Quem chegar a {dinheiro ? reais(m.alvo) : `${inteiro(m.alvo)} ${t.unidade}`}: {pessoas.bateram.length} já chegaram
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pessoas.bateram.map((x) => (
                        <Selo key={x.handle} cor="verde">
                          @{x.handle}
                        </Selo>
                      ))}
                      {pessoas.perto.slice(0, 3).map((x) => (
                        <Selo key={x.handle}>
                          @{x.handle} {dinheiro ? reais(x.atual) : inteiro(x.atual)}
                        </Selo>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    {m.tipo !== "posicao" && <Barra progresso={p.progresso} cor={p.batida ? "bg-brand-green" : "bg-brand-yellow"} />}
                    <p className={`mt-0.5 text-[11px] text-[#8b93a7] ${dinheiro ? "dash-valor" : ""}`}>
                      {m.tipo === "posicao"
                        ? `Agora #${p.atual || "?"} · meta #${m.alvo}`
                        : `${dinheiro ? reais(p.atual) : inteiro(p.atual)} de ${dinheiro ? reais(m.alvo) : inteiro(m.alvo)} ${dinheiro ? "" : t.unidade}${p.falta ? ` · faltam ${dinheiro ? reais(p.falta) : inteiro(p.falta)}` : ""}`}
                    </p>
                    {m.batidaEm && (
                      <button onClick={() => acao({ acao: "reabrir", id: m.id })} className="text-[11px] text-brand-yellow hover:underline">
                        reabrir
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !aberto && <Vazio>Nenhuma meta. Ex.: 300 carpas na live, chegar ao #5 do ranking, ou cada pessoa que mandar 5.000 gemas ganha um booster.</Vazio>
      )}
    </Cartao>
  );
}

export default function Sorteios({ showId }: { showId: string }) {
  const { chamar } = useDash();
  const { dados: d, erro, trocar } = useLiveDash(showId);
  const [form, setForm] = useState<FormSorteio | null>(null);
  const [roleta, setRoleta] = useState<{ chave: number; nome: string; premio: string | null; ganhador: { handle: string; foto: string | null; bilhetes: number }; lista: { handle: string; foto: string | null; bilhetes: number }[] } | null>(null);
  const [volume] = usePreferencia("som", { ligado: true, volume: 0.5 });
  const [erroAcao, setErroAcao] = useState("");

  const extra = useMemo(() => {
    if (!d) return null;
    const termos = lerTermos(d.termos);
    const resumo = resumoVendas(d.vendas);
    const gemas = d.emocoes.reduce((t, e) => t + e.gemas, 0);
    const carpas = rankingCarpas(d.emocoes, d.chat, termos).reduce((t, p) => t + p.carpas, 0);
    const totais: Totais = {
      gemas,
      carpas,
      emocoes: d.emocoes.length,
      faturamento: resumo.total,
      itens: resumo.itens,
      compradores: resumo.compradores,
      pontosLive: pontosDaLive(resumo.total, gemas, d.ranking?.regras),
      posicao: d.ranking?.posicao ?? null,
    };
    // Emotions que já apareceram nesta live, mais as que a Jamble tem na tabela.
    const vistas = porIcone(d.emocoes).map((i) => i.icone);
    const todas = [...new Set([...vistas, ...Object.keys(d.icones)])];
    const icones = todas.map((id) => ({ id, nome: d.icones[id]?.nome ?? id }));
    return { totais, icones };
  }, [d]);

  async function salvar(f: FormSorteio) {
    try {
      const r = await chamar<{ sorteios: Sorteio[] }>(`/api/dash/sorteios/${encodeURIComponent(showId)}`, {
        corpo: { acao: f.id ? "editar" : "criar", id: f.id, ...corpoDe(f) },
      });
      trocar({ sorteios: r.sorteios });
      setForm(null);
    } catch (e) {
      alert(String((e as Error).message));
    }
  }

  async function sortear(s: Sorteio, acao: "sortear" | "resortear") {
    setErroAcao("");
    try {
      const r = await chamar<{
        sorteios: Sorteio[];
        ganhador: { handle: string; foto: string | null; bilhetes: number };
        roleta: { handle: string; foto: string | null; bilhetes: number }[];
      }>(`/api/dash/sorteios/${encodeURIComponent(showId)}`, { corpo: { acao, id: s.id } });
      setRoleta({ chave: Date.now(), nome: s.nome, premio: s.premio, ganhador: r.ganhador, lista: r.roleta });
      // A lista nova (com o ganhador) entra quando a roleta para.
      setTimeout(() => trocar({ sorteios: r.sorteios }), 7000);
    } catch (e) {
      setErroAcao(String((e as Error).message));
      tocar("lance", volume.volume);
    }
  }

  if (!d || !extra) return <p className="py-10 text-center text-[13px] text-[#8b93a7]">{erro ? `Não consegui abrir a live: ${erro}` : "Carregando..."}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate font-display text-lg font-extrabold text-white">Sorteios & metas</h1>
        <AoVivo aoVivo={d.live.aoVivo} />
        <span className="truncate text-[12px] text-[#8b93a7]">{d.live.titulo}</span>
        <span className="flex-1" />
        <Link href={`/dash/painel/${encodeURIComponent(showId)}`}>
          <Botao>
            <Radio size={14} /> Painel
          </Botao>
        </Link>
        <Botao cor="amarelo" onClick={() => setForm({ ...FORM_VAZIO })}>
          <Plus size={14} /> Novo sorteio
        </Botao>
      </div>
      {erroAcao && <p className="mb-3 rounded-lg bg-brand-red/10 px-3 py-2 text-[13px] text-[#ff8a8a]">{erroAcao}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          {form && <FormularioSorteio key={form.id ?? "novo"} inicial={form} icones={extra.icones} aoSalvar={salvar} aoFechar={() => setForm(null)} />}
          {d.sorteios.length ? (
            d.sorteios.map((s) => (
              <CartaoSorteio
                key={s.id}
                s={s}
                d={d}
                showId={showId}
                aoMudar={(sorteios) => trocar({ sorteios })}
                aoEditar={() => setForm(formDe(s))}
                aoSortear={(acao) => sortear(s, acao)}
              />
            ))
          ) : (
            !form && (
              <Cartao>
                <Vazio>Nenhum sorteio nesta live. Clique em “Novo sorteio” e escolha um modelo.</Vazio>
              </Cartao>
            )
          )}
        </div>
        <div className="min-w-0">
          <SecaoMetas d={d} showId={showId} totais={extra.totais} aoMudar={(metas) => trocar({ metas })} />
        </div>
      </div>

      {roleta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl">
            <Roleta
              key={roleta.chave}
              titulo={roleta.nome}
              participantes={roleta.lista}
              ganhador={roleta.ganhador}
              premio={roleta.premio}
              volume={volume.ligado ? volume.volume : 0}
            />
            <div className="mt-6 flex justify-center gap-2">
              <Botao onClick={() => copiar(mensagemDeGanhador(roleta.ganhador.handle, roleta.premio))}>
                <Copy size={13} /> Copiar mensagem
              </Botao>
              <Botao cor="amarelo" onClick={() => setRoleta(null)}>
                Fechar
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
