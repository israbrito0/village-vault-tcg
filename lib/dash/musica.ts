"use client";

import { audio } from "@/lib/dash/som";

// A música do sorteio: toca com a tela do sorteio aberta (em loop) até o
// ganhador aparecer.
//   - "arquivo": o MP3 que a conta enviou;
//   - "padrao": uma marchinha de programa de auditório feita aqui mesmo, no
//     navegador (composição própria, sem arquivo e sem direitos de terceiros),
//     que fecha com uma fanfarra quando o pião para;
//   - "nenhuma": silêncio.

export type Musica = { tipo: "padrao" | "arquivo" | "nenhuma"; url?: string | null; loop?: boolean };
// bloqueado(): o navegador não deixou tocar sozinho (falta um clique na página).
export type Tocando = { vitoria: () => void; parar: (someEmMs?: number) => void; bloqueado: () => boolean };

const SILENCIO: Tocando = { vitoria: () => {}, parar: () => {}, bloqueado: () => false };
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// ---------- os instrumentos ----------

function ruido(a: AudioContext) {
  const b = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function voz(a: AudioContext, saida: AudioNode, midi: number, t: number, dur: number, vol: number, tipo: OscillatorType, corte = 3200) {
  const o = a.createOscillator();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.value = freq(midi);
  f.type = "lowpass";
  f.frequency.value = corte;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(vol * 0.55, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(saida);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function bumbo(a: AudioContext, saida: AudioNode, t: number, vol: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(saida);
  o.start(t);
  o.stop(t + 0.2);
}

function caixa(a: AudioContext, saida: AudioNode, buf: AudioBuffer, t: number, vol: number, dur = 0.16) {
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  s.buffer = buf;
  f.type = "highpass";
  f.frequency.value = 1100;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(saida);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

function chimbal(a: AudioContext, saida: AudioNode, buf: AudioBuffer, t: number, vol: number) {
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  s.buffer = buf;
  f.type = "highpass";
  f.frequency.value = 7500;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  s.connect(f).connect(g).connect(saida);
  s.start(t, Math.random() * 0.5);
  s.stop(t + 0.06);
}

// ---------- a marchinha (4 compassos que se repetem) ----------

const BPM = 150;
const COLCHEIA = 60 / BPM / 2;
// Melodia em colcheias (0 = pausa). Composição própria.
const MELODIA = [
  76, 79, 84, 79, 81, 79, 76, 79,
  77, 81, 84, 81, 79, 76, 74, 76,
  76, 79, 84, 86, 88, 86, 84, 81,
  79, 81, 79, 76, 74, 0, 79, 0,
];
const BAIXO = [48, 43, 48, 43, 41, 48, 41, 48, 48, 43, 45, 40, 43, 38, 43, 47]; // semínimas
const ACORDES = [
  [60, 64, 67],
  [57, 60, 65],
  [57, 60, 64],
  [55, 59, 62],
];

function tocarPadrao(volume: number): Tocando {
  const a = audio();
  if (!a) return SILENCIO;
  const mestre = a.createGain();
  mestre.gain.value = Math.max(0, Math.min(2, volume)) * 0.32;
  mestre.connect(a.destination);
  const buf = ruido(a);
  const inicio = a.currentTime + 0.08;
  let proxima = 0; // próxima colcheia a agendar
  let rodando = true;

  const agendar = () => {
    if (!rodando) return;
    const ate = a.currentTime + 0.35;
    for (let t = inicio + proxima * COLCHEIA; t < ate; t = inicio + proxima * COLCHEIA) {
      const i = proxima % MELODIA.length;
      const tempo = i % 2 === 0;
      const batida = Math.floor(i / 2) % 4; // 0..3 no compasso
      const compasso = Math.floor(i / 8);
      if (MELODIA[i]) voz(a, mestre, MELODIA[i], t, COLCHEIA * 0.95, 0.16, "square");
      if (tempo) {
        voz(a, mestre, BAIXO[Math.floor(i / 2)], t, COLCHEIA * 1.8, 0.28, "triangle", 900);
        if (batida === 0 || batida === 2) bumbo(a, mestre, t, 0.7);
        if (batida === 1 || batida === 3) caixa(a, mestre, buf, t, 0.28);
        if (batida === 0 || batida === 2) for (const n of ACORDES[compasso]) voz(a, mestre, n, t, COLCHEIA * 1.4, 0.05, "sawtooth", 1800);
      }
      chimbal(a, mestre, buf, t, tempo ? 0.06 : 0.035);
      proxima++;
    }
  };
  agendar();
  const relogio = setInterval(agendar, 100);

  const sumir = (ms: number) => {
    const t = a.currentTime;
    mestre.gain.cancelScheduledValues(t);
    mestre.gain.setValueAtTime(mestre.gain.value, t);
    mestre.gain.linearRampToValueAtTime(0.0001, t + ms / 1000);
    setTimeout(() => mestre.disconnect(), ms + 300);
  };

  return {
    vitoria: () => {
      if (!rodando) return;
      rodando = false;
      clearInterval(relogio);
      // Fanfarra: subida rápida e o acorde final com prato.
      const t = a.currentTime + 0.05;
      [72, 76, 79, 84].forEach((n, k) => voz(a, mestre, n, t + k * 0.09, 0.22, 0.2, "square"));
      for (const n of [60, 64, 67, 72, 76]) voz(a, mestre, n, t + 0.36, 1.9, 0.09, "sawtooth", 2400);
      bumbo(a, mestre, t + 0.36, 0.9);
      caixa(a, mestre, buf, t + 0.36, 0.35, 1.6);
      for (let k = 0; k < 6; k++) caixa(a, mestre, buf, t + k * 0.06, 0.12 + k * 0.03, 0.08);
    },
    parar: (ms = 600) => {
      rodando = false;
      clearInterval(relogio);
      sumir(ms);
    },
    // Sem um clique na página o áudio fica parado ("suspended"); ele começa
    // sozinho quando a página destrava o som.
    bloqueado: () => a.state !== "running",
  };
}

// ---------- o arquivo enviado ----------

function tocarArquivo(url: string, volume: number, loop = false): Tocando {
  if (typeof window === "undefined") return SILENCIO;
  const el = new Audio(url);
  const alvo = Math.max(0, Math.min(1, volume * 0.8));
  el.volume = alvo;
  el.loop = loop;
  let travado = false;
  let parado = false;
  const tentar = () =>
    el.play().then(
      () => {
        travado = false;
      },
      () => {
        // Sem clique na página o navegador não deixa tocar: tenta de novo no
        // primeiro clique ou tecla.
        travado = true;
        const destravar = () => {
          window.removeEventListener("pointerdown", destravar);
          window.removeEventListener("keydown", destravar);
          if (!parado) tentar();
        };
        window.addEventListener("pointerdown", destravar);
        window.addEventListener("keydown", destravar);
      },
    );
  tentar();
  let fade: ReturnType<typeof setInterval> | null = null;
  return {
    bloqueado: () => travado,
    vitoria: () => {},
    parar: (ms = 1500) => {
      parado = true;
      if (fade) return;
      const passos = Math.max(1, Math.round(ms / 50));
      let k = 0;
      fade = setInterval(() => {
        k++;
        el.volume = Math.max(0, alvo * (1 - k / passos));
        if (k >= passos) {
          clearInterval(fade!);
          el.pause();
          el.src = "";
        }
      }, 50);
    },
  };
}

export function tocarMusica(m: Musica, volume: number): Tocando {
  if (volume <= 0 || m.tipo === "nenhuma") return SILENCIO;
  if (m.tipo === "arquivo" && m.url) return tocarArquivo(m.url, volume, m.loop === true);
  return tocarPadrao(volume);
}

// O som dos 10 segundos do ganhador (o arquivo que a conta enviou), uma vez.
export function tocarSomDaContagem(url: string, volume: number): Tocando {
  if (volume <= 0 || !url) return SILENCIO;
  return tocarArquivo(url, volume, false);
}
