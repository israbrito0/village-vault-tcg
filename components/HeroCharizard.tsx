"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import * as THREE from "three";
import { LIVE_URL } from "@/lib/site";
import LiveLink from "./LiveLink";
import Wordmark from "./Wordmark";
import { MENU_INICIAL } from "./HeroEstatico";

// Entrada do site: a rolagem leva a câmera por um Charizard feito de pontos de
// luz, e os produtos em destaque vão surgindo pelo caminho. Tudo é guiado pelo
// progresso da rolagem (0 no topo, 1 no fim da seção); nada avança sozinho.

export type ProdutoEntrada = {
  slug: string;
  nome: string;
  colecao: string;
  preco: string;
  imagem: string;
  categoria: string;
};

// A silhueta é um SVG com uma cor por região; o ponto herda a região da cor.
type Regiao = { nome: string; rgb: [number, number, number]; grossura: number; borda: number; cores: [string, string] };
const REGIOES: Regiao[] = [
  { nome: "corpo", rgb: [232, 112, 42], grossura: 0.95, borda: 16, cores: ["#ff7a1a", "#ffb347"] },
  { nome: "barriga", rgb: [246, 217, 160], grossura: 0.8, borda: 14, cores: ["#f4af14", "#ffe08a"] },
  { nome: "asa", rgb: [31, 122, 140], grossura: 0.12, borda: 3, cores: ["#2fb7d6", "#8fe9f7"] },
  { nome: "chama", rgb: [255, 179, 0], grossura: 0.45, borda: 8, cores: ["#fff3b0", "#ffd23f"] },
  { nome: "chama", rgb: [255, 77, 26], grossura: 0.45, borda: 8, cores: ["#ff6a1a", "#ffc043"] },
  { nome: "boca", rgb: [107, 42, 16], grossura: 0, borda: 0, cores: ["#000", "#000"] },
];

const SVG_W = 1000;
const SVG_H = 800;
// Centro visual do dragão no SVG: vira a origem do mundo 3D.
const CENTRO = { x: 600, y: 450 };
const ESCALA = 10 / SVG_W; // o desenho tem 10 unidades de largura no mundo

function mundo(px: number, py: number, z = 0) {
  return new THREE.Vector3((px - CENTRO.x) * ESCALA, (CENTRO.y - py) * ESCALA, z);
}

type Quadro = { p: number; olhar: THREE.Vector3; camera: THREE.Vector3 };

// Roteiro da câmera: onde ela está e para onde olha em cada ponto da rolagem.
const ROTEIRO: Quadro[] = [
  { p: 0.0, olhar: mundo(600, 450), camera: mundo(600, 450, 13) },
  { p: 0.1, olhar: mundo(600, 450), camera: mundo(600, 450, 8.5) },
  { p: 0.24, olhar: mundo(380, 330), camera: mundo(380, 330).add(new THREE.Vector3(-1.2, 0.7, 6.2)) },
  { p: 0.4, olhar: mundo(790, 300), camera: mundo(790, 300).add(new THREE.Vector3(0.6, 1.4, 6.2)) },
  { p: 0.56, olhar: mundo(480, 470), camera: mundo(480, 470).add(new THREE.Vector3(-1.8, -0.4, 5.8)) },
  { p: 0.72, olhar: mundo(860, 400), camera: mundo(860, 400).add(new THREE.Vector3(1.0, 0.4, 5.8)) },
  { p: 0.84, olhar: mundo(600, 450), camera: mundo(600, 450, 10) },
  { p: 1.0, olhar: mundo(600, 450), camera: mundo(600, 450, 10.5) },
];

// Momentos em que cada produto está no centro da cena.
const MOMENTOS_PRODUTO = [0.24, 0.4, 0.56, 0.72];
const LARGURA_PRODUTO = 0.11;

const FORMA_INICIO = 0.02; // pontos soltos viram o dragão entre estes dois pontos
const FORMA_FIM = 0.14;
const DISSOLVE_INICIO = 0.8; // e viram brasas subindo no fim
const DISSOLVE_FIM = 0.93;

function suave(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function faixa(p: number, inicio: number, fim: number) {
  return suave((p - inicio) / (fim - inicio));
}

// Quanto o produto `i` está "no palco" (0 fora, 1 no centro).
function presencaProduto(p: number, i: number) {
  const d = Math.abs(p - MOMENTOS_PRODUTO[i]) / LARGURA_PRODUTO;
  return suave(1 - d);
}

const VERTEX = /* glsl */ `
  attribute vec3 aSolto;
  attribute vec3 aCor;
  attribute float aSemente;
  attribute float aTipo;
  uniform float uForma;
  uniform float uTempo;
  uniform float uDissolve;
  uniform float uTamanho;
  uniform float uDpr;
  varying vec3 vCor;
  varying float vAlfa;

  void main() {
    float s = aSemente;
    // Cada ponto tem o seu atraso: os primeiros já formam enquanto os últimos ainda voam.
    float forma = smoothstep(0.0, 1.0, (uForma - s * 0.35) / 0.65);
    vec3 pos = mix(aSolto, position, forma);

    // Respiração: um balanço leve para o dragão parecer vivo.
    pos += 0.03 * vec3(
      sin(uTempo * 1.1 + s * 6.2831),
      cos(uTempo * 0.9 + s * 12.566),
      sin(uTempo * 1.3 + s * 3.1)
    ) * forma;

    // A chama tremula mais forte e sobe.
    if (aTipo > 2.5) {
      pos.y += (0.5 + 0.5 * sin(uTempo * 7.0 + s * 40.0)) * 0.12 * forma;
      pos.x += sin(uTempo * 5.0 + s * 30.0) * 0.04 * forma;
    }

    // No fim, vira brasa: sobe, espalha e some.
    float d = uDissolve * (0.6 + s * 0.8);
    pos += vec3(sin(s * 9.1) * 2.5 * d, (2.0 + s * 4.0) * d, cos(s * 7.7) * 2.5 * d);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float variacao = 0.55 + 0.9 * fract(s * 13.7);
    // Tamanho em pixels: perto da câmera cresce, longe encolhe; nunca vira um borrão.
    float ganho = aTipo > 2.5 ? 1.3 : 1.0; // chama com pontos um pouco maiores
    gl_PointSize = min(28.0, uTamanho * variacao * ganho * (22.0 / max(1.0, -mv.z))) * uDpr;

    float cintila = 0.75 + 0.25 * sin(uTempo * 3.0 + s * 50.0);
    vCor = aCor;
    vAlfa = (0.45 + 0.4 * forma) * cintila * (1.0 - uDissolve) * (aTipo > 2.5 ? 0.6 : 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vCor;
  varying float vAlfa;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);
    // Miolo mais claro: parece luz, não bolinha.
    vec3 cor = vCor * (0.8 + 1.2 * smoothstep(0.35, 0.0, d));
    gl_FragColor = vec4(cor, a * vAlfa);
  }
`;

type Nuvem = {
  posicao: Float32Array;
  solto: Float32Array;
  cor: Float32Array;
  semente: Float32Array;
  tipo: Float32Array;
};

// Lê a silhueta e sorteia `n` pontos dentro dela, com volume conforme a região.
async function amostrarSilhueta(n: number): Promise<Nuvem> {
  const img = new window.Image();
  img.src = "/charizard-silhueta.svg";
  await img.decode();

  const W = 500;
  const H = 400;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const dados = ctx.getImageData(0, 0, W, H).data;

  // Região de cada pixel (índice em REGIOES) ou -1 fora do desenho.
  const regiao = new Int8Array(W * H).fill(-1);
  const candidatos: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (dados[i * 4 + 3] < 128) continue;
    const r = dados[i * 4];
    const g = dados[i * 4 + 1];
    const b = dados[i * 4 + 2];
    let melhor = 0;
    let menor = Infinity;
    REGIOES.forEach((reg, k) => {
      const dist = (r - reg.rgb[0]) ** 2 + (g - reg.rgb[1]) ** 2 + (b - reg.rgb[2]) ** 2;
      if (dist < menor) {
        menor = dist;
        melhor = k;
      }
    });
    if (REGIOES[melhor].grossura === 0) continue; // boca fica vazia
    regiao[i] = melhor;
    candidatos.push(i);
    // A chama é pequena no desenho, mas precisa brilhar: entra três vezes no sorteio.
    if (REGIOES[melhor].nome === "chama") candidatos.push(i);
  }

  // Distância de cada pixel até a borda do desenho (chanfro em duas passadas):
  // no meio do corpo os pontos ganham mais profundidade; perto da borda, menos.
  const dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = regiao[i] < 0 ? 0 : 1e6;
  const passo = (i: number, j: number, custo: number) => {
    if (j >= 0 && j < W * H && dist[j] + custo < dist[i]) dist[i] = dist[j] + custo;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x > 0) passo(i, i - 1, 1);
      if (y > 0) passo(i, i - W, 1);
      if (x > 0 && y > 0) passo(i, i - W - 1, 1.414);
      if (x < W - 1 && y > 0) passo(i, i - W + 1, 1.414);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (x < W - 1) passo(i, i + 1, 1);
      if (y < H - 1) passo(i, i + W, 1);
      if (x < W - 1 && y < H - 1) passo(i, i + W + 1, 1.414);
      if (x > 0 && y < H - 1) passo(i, i + W - 1, 1.414);
    }

  const posicao = new Float32Array(n * 3);
  const solto = new Float32Array(n * 3);
  const cor = new Float32Array(n * 3);
  const semente = new Float32Array(n);
  const tipo = new Float32Array(n);
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();
  const ex = SVG_W / W; // pixel do canvas -> coordenada do SVG

  for (let k = 0; k < n; k++) {
    const i = candidatos[Math.floor(Math.random() * candidatos.length)];
    const reg = REGIOES[regiao[i]];
    const px = ((i % W) + Math.random()) * ex;
    const py = (Math.floor(i / W) + Math.random()) * ex;

    // Seção arredondada: profundidade máxima no meio, zero na borda.
    const t = Math.min(1, dist[i] / reg.borda);
    const raio = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    const z = (Math.random() * 2 - 1) * reg.grossura * raio;
    const p = mundo(px, py, z);
    posicao.set([p.x, p.y, p.z], k * 3);

    // Ponto de partida: uma nuvem grande em volta.
    const ang = Math.random() * Math.PI * 2;
    const alt = Math.acos(Math.random() * 2 - 1);
    const r = 3 + Math.random() * 8;
    solto.set([r * Math.sin(alt) * Math.cos(ang), r * Math.sin(alt) * Math.sin(ang) * 0.7, r * Math.cos(alt)], k * 3);

    c1.set(reg.cores[0]);
    c2.set(reg.cores[1]);
    c1.lerp(c2, Math.random());
    cor.set([c1.r, c1.g, c1.b], k * 3);
    semente[k] = Math.random();
    tipo[k] = reg.nome === "chama" ? 3 : reg.nome === "asa" ? 2 : reg.nome === "barriga" ? 1 : 0;
  }

  return { posicao, solto, cor, semente, tipo };
}

// Poeira de fundo, parada no espaço: dá noção de profundidade quando a câmera anda.
function poeira(n: number): Nuvem {
  const posicao = new Float32Array(n * 3);
  const cor = new Float32Array(n * 3);
  const semente = new Float32Array(n);
  const tipo = new Float32Array(n);
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    posicao.set([(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 30 - 2], k * 3);
    c.set(Math.random() < 0.7 ? "#f4af14" : "#ff7a1a").multiplyScalar(0.35 + Math.random() * 0.3);
    cor.set([c.r, c.g, c.b], k * 3);
    semente[k] = Math.random();
    tipo[k] = 0;
  }
  return { posicao, solto: posicao, cor, semente, tipo };
}

function montarPontos(nuvem: Nuvem, tamanho: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(nuvem.posicao, 3));
  geo.setAttribute("aSolto", new THREE.BufferAttribute(nuvem.solto, 3));
  geo.setAttribute("aCor", new THREE.BufferAttribute(nuvem.cor, 3));
  geo.setAttribute("aSemente", new THREE.BufferAttribute(nuvem.semente, 1));
  geo.setAttribute("aTipo", new THREE.BufferAttribute(nuvem.tipo, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uForma: { value: 0 },
      uTempo: { value: 0 },
      uDissolve: { value: 0 },
      uTamanho: { value: tamanho },
      uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

function quadroEm(p: number, camera: THREE.Vector3, olhar: THREE.Vector3, afastar: number) {
  let a = ROTEIRO[0];
  let b = ROTEIRO[ROTEIRO.length - 1];
  for (let i = 0; i < ROTEIRO.length - 1; i++) {
    if (p >= ROTEIRO[i].p && p <= ROTEIRO[i + 1].p) {
      a = ROTEIRO[i];
      b = ROTEIRO[i + 1];
      break;
    }
  }
  const t = suave((p - a.p) / Math.max(1e-6, b.p - a.p));
  olhar.lerpVectors(a.olhar, b.olhar, t);
  camera.lerpVectors(a.camera, b.camera, t);
  // Tela estreita (celular, painel): afasta a câmera para caber a mesma cena.
  camera.sub(olhar).multiplyScalar(afastar).add(olhar);
}

export default function HeroCharizard({ produtos }: { produtos: ProdutoEntrada[] }) {
  const secao = useRef<HTMLElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [progresso, setProgresso] = useState(0);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const canvas = tela.current;
    const el = secao.current;
    if (!canvas || !el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
        // Só fora de produção: deixa tirar foto do canvas para conferir a cena.
        preserveDrawingBuffer: process.env.NODE_ENV !== "production",
      });
    } catch {
      setFalhou(true);
      return;
    }

    const celular = window.innerWidth < 640;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.5 : 2));
    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const grupo = new THREE.Group();
    cena.add(grupo);

    const fundo = montarPontos(poeira(celular ? 250 : 500), 1.4);
    cena.add(fundo);

    let dragao: THREE.Points | null = null;
    let vivo = true;
    let visivel = true;
    let alvo = 0; // progresso da rolagem
    let atual = 0; // progresso suavizado (inércia)
    let ultimoEstado = -1;
    const posCam = new THREE.Vector3();
    const olhar = new THREE.Vector3();
    const relogio = new THREE.Clock();

    amostrarSilhueta(celular ? 9000 : 24000)
      .then((nuvem) => {
        if (!vivo) return;
        dragao = montarPontos(nuvem, celular ? 1.5 : 1.7);
        grupo.add(dragao);
        setPronto(true);
      })
      .catch(() => setFalhou(true));

    function redimensionar() {
      const w = el!.clientWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    redimensionar();

    function lerRolagem() {
      const r = el!.getBoundingClientRect();
      const percurso = r.height - window.innerHeight;
      alvo = percurso > 0 ? Math.min(1, Math.max(0, -r.top / percurso)) : 0;
    }
    lerRolagem();

    function desenhar(p: number) {
      const tempo = relogio.getElapsedTime();

      quadroEm(p, posCam, olhar, Math.max(1, 1.35 / camera.aspect));
      camera.position.copy(posCam);
      camera.lookAt(olhar);

      // Um giro leve conforme a rolagem, para o volume aparecer.
      grupo.rotation.y = Math.sin(p * Math.PI * 2) * 0.18;

      const forma = faixa(p, FORMA_INICIO, FORMA_FIM);
      const dissolve = faixa(p, DISSOLVE_INICIO, DISSOLVE_FIM);
      if (dragao) {
        const u = (dragao.material as THREE.ShaderMaterial).uniforms;
        u.uForma.value = forma;
        u.uDissolve.value = dissolve;
        u.uTempo.value = tempo;
      }
      const uf = (fundo.material as THREE.ShaderMaterial).uniforms;
      uf.uForma.value = 1;
      uf.uTempo.value = tempo * 0.3;

      renderer.render(cena, camera);

      // O React só precisa saber do progresso em passos pequenos (cards e textos).
      const passo = Math.round(p * 400);
      if (passo !== ultimoEstado) {
        ultimoEstado = passo;
        setProgresso(p);
      }
    }

    function quadro() {
      if (!vivo) return;
      requestAnimationFrame(quadro);
      if (!visivel) return;
      atual += (alvo - atual) * 0.09;
      desenhar(atual);
    }
    requestAnimationFrame(quadro);

    // Fora de produção: deixa um teste ir direto a um ponto da rolagem.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __vvHero?: unknown }).__vvHero = {
        irPara(p: number) {
          alvo = atual = p;
          desenhar(p);
        },
      };
    }

    const observador = new IntersectionObserver(([e]) => (visivel = e.isIntersecting), { threshold: 0 });
    observador.observe(el);
    window.addEventListener("scroll", lerRolagem, { passive: true });
    window.addEventListener("resize", redimensionar);

    return () => {
      vivo = false;
      observador.disconnect();
      window.removeEventListener("scroll", lerRolagem);
      window.removeEventListener("resize", redimensionar);
      dragao?.geometry.dispose();
      (dragao?.material as THREE.Material | undefined)?.dispose();
      fundo.geometry.dispose();
      (fundo.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, []);

  const abertura = 1 - faixa(progresso, 0.02, 0.1); // marca grande e dica de rolar
  const fechamento = faixa(progresso, 0.9, 0.98); // menu e chamada final

  return (
    <section
      ref={secao}
      className="relative bg-[#07060a] text-white"
      style={{ height: falhou ? "auto" : "520vh" }}
      data-pronto={pronto ? "sim" : "nao"}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Brilho quente no fundo, atrás dos pontos. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 65%, rgba(255,122,26,0.16), transparent 70%), radial-gradient(40% 30% at 50% 20%, rgba(244,175,20,0.08), transparent 70%)",
          }}
        />
        <canvas ref={tela} className="absolute inset-0 h-full w-full" />

        {/* Atalhos discretos: a página inicial não tem o cabeçalho completo. */}
        <div className="absolute right-4 top-4 z-20 flex gap-4 text-white/70">
          <Link href="/catalogo" aria-label="Buscar produtos" className="hover:text-white">
            <Search size={20} strokeWidth={1.75} />
          </Link>
          <Link href="/carrinho" aria-label="Carrinho" className="hover:text-white">
            <ShoppingCart size={20} strokeWidth={1.75} />
          </Link>
        </div>

        {/* Abertura: a marca e a dica de rolar. */}
        <div
          className="absolute inset-x-0 top-[12vh] z-10 flex flex-col items-center px-5 text-center"
          style={{ opacity: abertura, transform: `translateY(${(1 - abertura) * -30}px)`, pointerEvents: abertura > 0.5 ? "auto" : "none" }}
        >
          <Wordmark large tone="dark" />
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-white/60">Role para entrar</p>
          <span aria-hidden className="mt-3 block h-8 w-px bg-gradient-to-b from-gold to-transparent motion-safe:animate-pulse" />
        </div>

        {/* Produtos que surgem pelo caminho. */}
        {produtos.slice(0, 4).map((produto, i) => {
          const presenca = presencaProduto(progresso, i);
          if (presenca <= 0) return null;
          const lado = i % 2 === 0 ? 1 : -1; // alterna direita / esquerda
          const desloca = (progresso - MOMENTOS_PRODUTO[i]) / LARGURA_PRODUTO; // -1 chegando, 1 indo
          return (
            <Link
              key={produto.slug}
              href={`/produto/${produto.slug}`}
              className="absolute top-[58%] z-10 block w-[190px] rounded-2xl sm:top-1/2 border border-white/15 bg-white/[0.07] p-3 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors hover:border-gold/60 sm:w-[240px]"
              style={{
                left: "50%",
                opacity: presenca,
                transform: `translate(calc(-50% + ${lado * (window.innerWidth < 640 ? 0 : 230)}px), calc(-50% + ${desloca * 120}px)) scale(${0.8 + presenca * 0.2}) rotateY(${lado * -8}deg)`,
                pointerEvents: presenca > 0.6 ? "auto" : "none",
              }}
            >
              <span className="mb-2 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-gold">
                {produto.categoria}
              </span>
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-black/30">
                <Image src={produto.imagem} alt={produto.nome} fill sizes="240px" className="object-contain p-2" />
              </div>
              <p className="mt-2 truncate text-[12px] font-semibold">{produto.nome}</p>
              <p className="truncate text-[10px] text-white/60">{produto.colecao}</p>
              <p className="mt-1 text-[13px] font-bold text-gold">{produto.preco}</p>
            </Link>
          );
        })}

        {/* Fechamento: o menu da loja, com uma sombra por trás para ler bem. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[70vh] bg-gradient-to-t from-[#07060a] via-[#07060a]/80 to-transparent"
          style={{ opacity: fechamento }}
        />
        <div
          className="absolute inset-x-0 bottom-[10vh] z-10 flex flex-col items-center px-5 text-center"
          style={{ opacity: fechamento, transform: `translateY(${(1 - fechamento) * 30}px)`, pointerEvents: fechamento > 0.5 ? "auto" : "none" }}
        >
          <Wordmark tone="dark" />
          <nav aria-label="Menu inicial" className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
            {MENU_INICIAL.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="w-[150px] rounded border-2 border-gold/60 bg-white/5 px-3 py-3 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:border-gold hover:bg-gold hover:text-ink sm:w-[180px]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 text-xs text-white/60">Frete calculado na hora · 12x sem juros · 5% off no Pix</p>
          <LiveLink href={LIVE_URL} className="mt-3 text-xs" />
        </div>
      </div>
    </section>
  );
}
