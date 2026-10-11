"use client";

// Sons e voz do painel. Tudo no próprio navegador: nada sai do computador.

let ctx: AudioContext | null = null;
export function audio() {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    ctx = new C();
    // Sem um clique o navegador deixa o áudio parado: o primeiro clique ou
    // tecla na página destrava (a música do sorteio começa nessa hora).
    const destravar = () => {
      if (ctx?.state === "running") {
        window.removeEventListener("pointerdown", destravar);
        window.removeEventListener("keydown", destravar);
        return;
      }
      ctx?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", destravar);
    window.addEventListener("keydown", destravar);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function nota(freq: number, inicio: number, dur: number, volume: number, tipo: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.value = freq;
  const t = a.currentTime + inicio;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Som = "venda" | "pagamento" | "carpa" | "sorteio" | "meta" | "tique" | "lance" | "mamou";

export function tocar(som: Som, volume = 0.5) {
  // Volume de 0 a 200%, como no Dash TCG.
  const v = Math.max(0, Math.min(2, volume)) * 0.25;
  if (!v) return;
  if (som === "venda") {
    // Caixa registradora: o "tchan" do sino e a gaveta abrindo.
    nota(1568, 0, 0.12, v, "square");
    nota(2093, 0.08, 0.5, v * 0.9);
    nota(110, 0.02, 0.12, v * 0.6, "sawtooth");
  } else if (som === "pagamento") {
    // Moedas caindo.
    [2637, 3136, 2794, 3520].forEach((f, i) => nota(f, i * 0.07, 0.12, v * 0.6, "triangle"));
  } else if (som === "carpa") {
    nota(660, 0, 0.08, v * 0.7, "triangle");
    nota(990, 0.06, 0.12, v * 0.7, "triangle");
  } else if (som === "lance") {
    nota(520, 0, 0.07, v * 0.6, "square");
  } else if (som === "tique") {
    nota(1800, 0, 0.03, v * 0.5, "square");
  } else if (som === "mamou") {
    // "Uón, uón, uón, uóóón": três notas descendo e a última comprida.
    [311, 294, 277].forEach((f, i) => nota(f, i * 0.42, 0.38, v * 0.8, "sawtooth"));
    nota(262, 1.26, 1.1, v * 0.8, "sawtooth");
    nota(131, 1.26, 1.1, v * 0.4, "triangle");
  } else {
    // sorteio e meta: fanfarra curta
    [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.11, 0.35, v, "triangle"));
  }
}

// Destrava o áudio no primeiro clique (o navegador não deixa tocar antes).
export function destravarAudio() {
  audio();
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.getVoices();
}

export function vozes() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const todas = window.speechSynthesis.getVoices();
  const pt = todas.filter((v) => v.lang?.toLowerCase().startsWith("pt"));
  return pt.length ? pt : todas;
}

const fila: string[] = [];
export function falar(texto: string, opcoes: { voz?: string; volume?: number; velocidade?: number } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis || !texto) return;
  // Não deixa acumular: numa live movimentada, fala o mais novo.
  if (fila.length > 3) {
    window.speechSynthesis.cancel();
    fila.length = 0;
  }
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "pt-BR";
  const escolhida = vozes().find((v) => v.name === opcoes.voz) ?? vozes().find((v) => v.lang?.toLowerCase() === "pt-br");
  if (escolhida) u.voice = escolhida;
  u.volume = Math.max(0, Math.min(1, opcoes.volume ?? 1));
  u.rate = Math.max(0.6, Math.min(1.8, opcoes.velocidade ?? 1.1));
  fila.push(texto);
  u.onend = u.onerror = () => {
    fila.shift();
  };
  window.speechSynthesis.speak(u);
}

// "R$ 250,00" lido em voz alta vira "250 reais".
export function reaisFalado(n: number) {
  const inteiro = Math.floor(n);
  const centavos = Math.round((n - inteiro) * 100);
  return centavos ? `${inteiro} reais e ${centavos}` : `${inteiro} reais`;
}
