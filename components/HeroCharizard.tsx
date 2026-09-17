"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { LIVE_URL } from "@/lib/site";
import LiveLink from "./LiveLink";
import Wordmark from "./Wordmark";
import { MENU_INICIAL } from "./HeroEstatico";

// Entrada do site: o Charizard surge do escuro. Só os olhos acendem; de repente
// a luz revela o rosto e as asas, ele pisca um olho, inspira e solta uma rajada
// de fogo. Depois fica voando devagar atrás do título e do menu. Tudo é uma
// linha do tempo em segundos, contada de quando o modelo terminou de carregar.

const MODELO = "/charizard-voando.glb";

// Ajustes do modelo: tamanho, giro para ficar de frente, e onde ficam os olhos
// e a boca em relação ao osso da cabeça (coordenadas locais do osso).
const AJUSTE = {
  altura: 3.2,
  rotacaoY: 0,
  ossoCabeca: /^Head_/,
  ossoMandibula: /^JAW/,
  // Olhos e boca são achados nas malhas (pupilas e dentes) e guardados em
  // coordenadas do osso; estes são só os valores de partida.
  olhoEsq: new THREE.Vector3(-0.11, 0.16, 0.2),
  olhoDir: new THREE.Vector3(0.11, 0.16, 0.2),
  boca: new THREE.Vector3(0, -0.02, 0.22),
  abreBoca: 0.75, // radianos que a mandíbula abre na rajada (eixo X do osso)
  direcaoFogo: new THREE.Vector3(0.38, -0.12, 1).normalize(),
  // Câmera: de frente para a cabeça, na altura dos olhos, longe o bastante
  // para as asas aparecerem. O alvo fica um pouco abaixo da cabeça, para ela
  // ficar na parte de cima da tela (o menu entra embaixo).
  camera: new THREE.Vector3(0.25, 0.1, 4.2),
  cameraFim: new THREE.Vector3(0.0, 0.05, 3.7), // aproxima devagar ao longo da cena
  alvoAbaixo: 0.55,
};

// Linha do tempo (segundos).
const T = {
  olhos: 0.7, // olhos começam a acender no escuro
  olhosCheios: 1.6,
  revela: 2.6, // a luz acende de repente: rosto e asas
  revelaFim: 2.95,
  pisca: 3.6, // pisca um olho
  piscaFim: 3.85,
  inspira: 4.2,
  fogo: 4.7, // rajada
  fogoFim: 7.2,
  texto: 6.8, // título e menu
  ciclo: 14, // depois, piscada e rajada de novo a cada tanto tempo
};

function suave(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
function faixa(t: number, a: number, b: number) {
  return suave((t - a) / (b - a));
}

// ---- Fogo: partículas calculadas na GPU a partir do tempo ----
const N_FOGO = 4000;

const FOGO_VERTEX = /* glsl */ `
  attribute float aAtraso;
  attribute float aVida;
  attribute vec3 aVel;
  attribute float aSemente;
  uniform float uIdade;
  uniform vec3 uOrigem;
  uniform mat3 uBase;   // gira a velocidade para a direção atual da boca
  uniform float uDpr;
  varying float vFase;

  void main() {
    float idade = uIdade - aAtraso;
    vFase = idade / aVida;
    vec3 pos = uOrigem;
    bool viva = idade > 0.0 && vFase < 1.0;
    if (viva) {
      float t = idade;
      vec3 vel = uBase * aVel;
      pos += vel * (t - 0.3 * t * t / aVida);
      pos.y += 0.35 * t * t; // fogo sobe um pouco
      pos += 0.12 * vec3(
        sin(t * 9.0 + aSemente * 40.0),
        cos(t * 7.0 + aSemente * 30.0),
        sin(t * 8.0 + aSemente * 20.0)
      ) * t;
    }
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float tamanho = viva ? (8.0 + 34.0 * vFase) * (0.6 + 0.8 * fract(aSemente * 7.3)) : 0.0;
    gl_PointSize = tamanho * (3.2 / max(0.5, -mv.z)) * uDpr;
  }
`;

const FOGO_FRAGMENT = /* glsl */ `
  varying float vFase;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float macio = smoothstep(0.5, 0.0, d);
    vec3 c1 = vec3(1.0, 0.9, 0.5);
    vec3 c2 = vec3(1.0, 0.45, 0.08);
    vec3 c3 = vec3(0.8, 0.12, 0.02);
    vec3 c4 = vec3(0.1, 0.06, 0.05);
    vec3 cor = vFase < 0.2 ? mix(c1, c2, vFase / 0.2)
             : vFase < 0.55 ? mix(c2, c3, (vFase - 0.2) / 0.35)
             : mix(c3, c4, (vFase - 0.55) / 0.45);
    float alfa = macio * (1.0 - vFase) * (vFase < 0.55 ? 0.7 : 0.35);
    gl_FragColor = vec4(cor, alfa);
  }
`;

function montarFogo(dpr: number) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N_FOGO * 3);
  const atraso = new Float32Array(N_FOGO);
  const vida = new Float32Array(N_FOGO);
  const vel = new Float32Array(N_FOGO * 3);
  const semente = new Float32Array(N_FOGO);
  // Cone em volta do eixo +z; a rotação para a boca entra pelo uniforme uBase.
  const v = new THREE.Vector3();
  for (let i = 0; i < N_FOGO; i++) {
    atraso[i] = Math.pow(Math.random(), 0.8) * 1.6;
    vida[i] = 0.6 + Math.random() * 0.8;
    const ang = Math.random() * Math.PI * 2;
    const abertura = Math.pow(Math.random(), 1.5) * 0.3; // jato fechado
    const forca = 3.2 + Math.random() * 3.2;
    v.set(Math.cos(ang) * abertura, Math.sin(ang) * abertura, 1).normalize().multiplyScalar(forca);
    vel.set([v.x, v.y, v.z], i * 3);
    semente[i] = Math.random();
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aAtraso", new THREE.BufferAttribute(atraso, 1));
  geo.setAttribute("aVida", new THREE.BufferAttribute(vida, 1));
  geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
  geo.setAttribute("aSemente", new THREE.BufferAttribute(semente, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: FOGO_VERTEX,
    fragmentShader: FOGO_FRAGMENT,
    uniforms: {
      uIdade: { value: -1 },
      uOrigem: { value: new THREE.Vector3() },
      uBase: { value: new THREE.Matrix3() },
      uDpr: { value: dpr },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  return pontos;
}

// Brilho suave (sprite) para os olhos e a garganta.
function brilho(cor: string, tamanho: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, cor);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(tamanho);
  s.renderOrder = 10;
  return s;
}

export default function HeroCharizard() {
  const secao = useRef<HTMLElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<"carregando" | "cena" | "falhou">("carregando");
  const [mostrarTexto, setMostrarTexto] = useState(false);

  useEffect(() => {
    const canvas = tela.current;
    const el = secao.current;
    if (!canvas || !el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: process.env.NODE_ENV !== "production",
      });
    } catch {
      setFase("falhou");
      return;
    }
    const celular = window.innerWidth < 640;
    const dpr = Math.min(window.devicePixelRatio || 1, celular ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

    // Luzes: começa tudo apagado; a linha do tempo acende.
    const ambiente = new THREE.AmbientLight("#4a2a10", 0);
    const principal = new THREE.SpotLight("#ffb56b", 0, 30, Math.PI / 5, 0.6, 1.0);
    const contra = new THREE.DirectionalLight("#2fb7d6", 0);
    contra.position.set(-3, 2, -4);
    const garganta = new THREE.PointLight("#ff7a1a", 0, 10, 1.6);
    cena.add(ambiente, principal, principal.target, contra, garganta);

    const dragao = new THREE.Group();
    cena.add(dragao);
    const olhoEsq = brilho("rgba(255,140,40,0.9)", 0.22);
    const olhoDir = brilho("rgba(255,140,40,0.9)", 0.22);
    const gargantaBrilho = brilho("rgba(255,120,20,0.9)", 0.5);
    cena.add(olhoEsq, olhoDir, gargantaBrilho);
    // Pálpebra: um disco na cor do corpo que cobre o olho direito na piscada.
    const palpebra = (() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const ctx = cv.getContext("2d")!;
      const g = ctx.createRadialGradient(32, 28, 4, 32, 32, 32);
      g.addColorStop(0, "#f08a3a");
      g.addColorStop(0.75, "#d9672a");
      g.addColorStop(1, "rgba(160,70,20,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0, depthTest: false }));
      s.renderOrder = 11;
      return s;
    })();
    cena.add(palpebra);

    const fogo = montarFogo(dpr);
    cena.add(fogo);

    let vivo = true;
    let visivel = true;
    let inicio = -1;
    let deslocTempo = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let cabeca: THREE.Object3D | null = null; // osso da cabeça (ou o corpo, se não achar)
    let mandibula: THREE.Object3D | null = null;
    const olhosMateriais: THREE.MeshStandardMaterial[] = [];
    const relogio = new THREE.Clock();
    const mouse = { x: 0, y: 0 };
    const posCabeca = new THREE.Vector3();
    const rotCabeca = new THREE.Quaternion();
    const posMand = new THREE.Vector3();
    const rotMand = new THREE.Quaternion();
    const escCabeca = new THREE.Vector3();
    const posOlhoE = new THREE.Vector3();
    const posOlhoD = new THREE.Vector3();
    const posBoca = new THREE.Vector3();
    const dirBoca = new THREE.Vector3();
    const alvoCam = new THREE.Vector3();
    const posCam = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const baseFogo = new THREE.Matrix3();
    const m4 = new THREE.Matrix4();
    const ossos: string[] = [];

    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      MODELO,
      (gltf) => {
        if (!vivo) return;
        const modelo = gltf.scene;
        const caixa = new THREE.Box3().setFromObject(modelo);
        const tam = new THREE.Vector3();
        caixa.getSize(tam);
        const centro = new THREE.Vector3();
        caixa.getCenter(centro);
        const escala = AJUSTE.altura / Math.max(tam.y, 1e-6);
        modelo.position.copy(centro).multiplyScalar(-escala);
        modelo.scale.setScalar(escala);
        dragao.add(modelo);
        dragao.rotation.y = AJUSTE.rotacaoY;

        modelo.traverse((o) => {
          if ((o as THREE.Bone).isBone) ossos.push(o.name);
          if (!cabeca && (o as THREE.Bone).isBone && AJUSTE.ossoCabeca.test(o.name)) cabeca = o;
          if (!mandibula && (o as THREE.Bone).isBone && AJUSTE.ossoMandibula.test(o.name)) mandibula = o;
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.frustumCulled = false;
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat && "roughness" in mat) mat.roughness = Math.min(mat.roughness ?? 0.8, 0.7);
            // Os olhos são malhas próprias: brilham de verdade no escuro.
            if (mat && /eye|pupil|cornea/i.test(mat.name)) {
              mat.emissive = new THREE.Color("#ff8a2a");
              mat.emissiveIntensity = 0;
              olhosMateriais.push(mat);
            }
          }
        });
        if (!cabeca) cabeca = modelo;

        // Acha olhos e boca pelas malhas das pupilas e dos dentes, já no
        // espaço do osso (pose de descanso), para seguirem a animação.
        dragao.updateMatrixWorld(true);
        const mediaNoOsso = (malha: THREE.Mesh, osso: THREE.Object3D, lado?: 1 | -1) => {
          // Da malha para o mundo e do mundo para o osso (pose de descanso).
          const m = new THREE.Matrix4().copy(osso.matrixWorld).invert().multiply(malha.matrixWorld);
          const pos = malha.geometry.attributes.position;
          const v = new THREE.Vector3();
          const soma = new THREE.Vector3();
          let n = 0;
          for (let k = 0; k < pos.count; k++) {
            v.fromBufferAttribute(pos, k).applyMatrix4(m);
            if (lado && Math.sign(v.x) !== lado) continue;
            soma.add(v);
            n++;
          }
          return n ? soma.divideScalar(n) : null;
        };
        modelo.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const nome = (m.material as THREE.Material).name || "";
          if (/pupil/i.test(nome) && cabeca) {
            const e = mediaNoOsso(m, cabeca, -1);
            const d = mediaNoOsso(m, cabeca, 1);
            if (e) AJUSTE.olhoEsq.copy(e);
            if (d) AJUSTE.olhoDir.copy(d);
          }
          if (/teeth|dente/i.test(nome) && mandibula) {
            const b = mediaNoOsso(m, mandibula);
            if (b) AJUSTE.boca.lerp(b, 0.5);
          }
        });

        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(modelo);
          const acao = mixer.clipAction(gltf.animations[0]);
          acao.play();
        }
        inicio = relogio.getElapsedTime();
        setFase("cena");
      },
      undefined,
      () => setFase("falhou"),
    );

    function redimensionar() {
      const w = el!.clientWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    redimensionar();

    function desenhar(t: number, dt: number) {
      mixer?.update(dt);

      const olhos = faixa(t, T.olhos, T.olhosCheios);
      // Revelação súbita, com uma tremida de lâmpada acendendo.
      const revela = faixa(t, T.revela, T.revelaFim);
      const tremida = revela > 0 && revela < 1 ? 0.6 + 0.4 * Math.sin(t * 90) : 1;
      const luz = revela * tremida;
      // Piscada e rajada repetem a cada ciclo.
      const tCiclo = t < T.ciclo ? t : T.pisca - 0.2 + ((t - (T.pisca - 0.2)) % T.ciclo);
      const pisca = faixa(tCiclo, T.pisca, T.pisca + 0.1) * (1 - faixa(tCiclo, T.piscaFim - 0.1, T.piscaFim));
      const idadeFogo = tCiclo - T.fogo;
      const vivaFogo = idadeFogo > 0 && idadeFogo < T.fogoFim - T.fogo;
      const inspira = faixa(tCiclo, T.inspira, T.fogo) * (1 - faixa(tCiclo, T.fogo, T.fogo + 0.5));
      const rajada = vivaFogo ? 1 - faixa(idadeFogo, 1.6, 2.3) : 0;

      // A mandíbula abre por cima da animação: um pouco ao inspirar, bem na rajada.
      if (mandibula) mandibula.rotation.x += AJUSTE.abreBoca * (0.3 * inspira + rajada);
      dragao.updateMatrixWorld(true);

      // Onde estão a cabeça e a boca agora (seguem a animação).
      cabeca!.matrixWorld.decompose(posCabeca, rotCabeca, escCabeca);
      (mandibula ?? cabeca!).matrixWorld.decompose(posMand, rotMand, escCabeca);
      posOlhoE.copy(AJUSTE.olhoEsq).applyQuaternion(rotCabeca).add(posCabeca);
      posOlhoD.copy(AJUSTE.olhoDir).applyQuaternion(rotCabeca).add(posCabeca);
      posBoca.copy(AJUSTE.boca).applyQuaternion(rotMand).add(posMand);
      // O fogo vai para a frente (o dragão olha para a câmera), desviado um
      // pouco para o lado e para baixo: passa ao lado de quem olha, não na cara.
      dirBoca.copy(AJUSTE.direcaoFogo).applyQuaternion(dragao.quaternion).normalize();
      olhoEsq.position.copy(posOlhoE);
      olhoDir.position.copy(posOlhoD);
      // A pálpebra fica um pouco à frente do olho, virada para a câmera.
      palpebra.position.copy(posOlhoD).addScaledVector(tmp.subVectors(camera.position, posOlhoD).normalize(), 0.06);
      gargantaBrilho.position.copy(posBoca);

      // Com a luz acesa o brilho dos olhos diminui (o olho de verdade aparece).
      for (const m of olhosMateriais) m.emissiveIntensity = olhos * (2.5 - 1.5 * luz);
      const brilhoOlhos = olhos * (1 - 0.55 * luz);
      (olhoEsq.material as THREE.SpriteMaterial).opacity = brilhoOlhos * (0.75 + 0.25 * Math.sin(t * 2.1));
      (olhoDir.material as THREE.SpriteMaterial).opacity = brilhoOlhos * (0.75 + 0.25 * Math.cos(t * 1.9)) * (1 - pisca);
      // A piscada fecha o olho direito: o brilho some e a pálpebra (escala) achata.
      olhoDir.scale.set(0.22, 0.22 * (1 - 0.9 * pisca), 1);
      (palpebra.material as THREE.SpriteMaterial).opacity = pisca * luz;
      palpebra.scale.set(0.2, 0.16, 1);
      ambiente.intensity = 0.2 * luz;
      principal.intensity = 40 * luz;
      contra.intensity = 1.5 * luz;
      const chama = rajada * (0.7 + 0.3 * Math.sin(t * 27));
      garganta.intensity = 8 * chama + 1.5 * inspira;
      (gargantaBrilho.material as THREE.SpriteMaterial).opacity = 0.9 * chama + 0.35 * inspira;
      garganta.position.copy(posBoca).addScaledVector(dirBoca, 0.5);

      // Luz principal acompanha a cabeça, vindo de cima e da frente.
      principal.position.copy(posCabeca).add(tmp.set(1.8, 2.4, 3.0));
      principal.target.position.copy(posCabeca);

      // O dragão inteiro balança um pouco com o mouse e recua ao inspirar.
      dragao.rotation.y = AJUSTE.rotacaoY + mouse.x * 0.12;
      dragao.rotation.x = mouse.y * 0.06 - inspira * 0.05;

      // Câmera: de frente para a cabeça, aproximando devagar ao longo da cena.
      // Não segue a cabeça quadro a quadro (enjoaria); segue uma média suave.
      alvoCam.lerp(tmp.copy(posCabeca).setY(posCabeca.y - AJUSTE.alvoAbaixo), 0.08);
      const aproxima = faixa(t, 0, 12);
      // Tela estreita: afasta para caber.
      const afastar = Math.max(1, 1.2 / camera.aspect);
      tmp.lerpVectors(AJUSTE.camera, AJUSTE.cameraFim, aproxima).multiplyScalar(afastar).add(alvoCam);
      posCam.lerp(tmp, 0.08);
      camera.position.copy(posCam);
      camera.lookAt(alvoCam);

      // Fogo sai da boca, na direção em que a cabeça aponta.
      m4.lookAt(tmp.set(0, 0, 0), dirBoca.clone().negate(), new THREE.Vector3(0, 1, 0));
      baseFogo.setFromMatrix4(m4);
      const u = (fogo.material as THREE.ShaderMaterial).uniforms;
      u.uOrigem.value.copy(posBoca);
      u.uBase.value.copy(baseFogo);
      u.uIdade.value = vivaFogo ? idadeFogo : -1;

      renderer.render(cena, camera);
    }

    let ultimo = 0;
    function quadro() {
      if (!vivo) return;
      requestAnimationFrame(quadro);
      if (!visivel || inicio < 0) return;
      const agora = relogio.getElapsedTime();
      const dt = Math.min(0.05, agora - ultimo);
      ultimo = agora;
      const t = agora - inicio + deslocTempo;
      desenhar(t, dt);
      if (t >= T.texto) setMostrarTexto(true);
    }
    requestAnimationFrame(quadro);

    function aoMover(e: PointerEvent) {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    const observador = new IntersectionObserver(([e]) => (visivel = e.isIntersecting), { threshold: 0 });
    observador.observe(el);
    window.addEventListener("resize", redimensionar);
    window.addEventListener("pointermove", aoMover, { passive: true });

    // Fora de produção: deixa um teste pular para um instante e ler os ossos.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __vvHero?: unknown }).__vvHero = {
        irPara(t: number) {
          if (inicio < 0) return;
          deslocTempo = t - (relogio.getElapsedTime() - inicio);
          desenhar(t, 0);
          if (t >= T.texto) setMostrarTexto(true);
        },
        ossos,
        cabeca: () => cabeca?.name,
        mandibula: () => mandibula?.name,
        camera,
        cena,
        renderer,
        texto: (v: boolean) => setMostrarTexto(v),
        fogo,
        dirBoca,
        posicoes: () => ({ cabeca: posCabeca.toArray(), boca: posBoca.toArray(), cam: posCam.toArray(), alvo: alvoCam.toArray() }),
        T,
        ajuste: AJUSTE,
        dragao,
      };
    }

    return () => {
      vivo = false;
      observador.disconnect();
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("pointermove", aoMover);
      draco.dispose();
      renderer.dispose();
    };
  }, []);

  const textoVisivel = mostrarTexto || fase === "falhou";

  return (
    <section ref={secao} className="relative min-h-screen overflow-hidden bg-[#050408] text-white" data-fase={fase}>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "radial-gradient(55% 45% at 50% 55%, rgba(255,122,26,0.10), transparent 70%)" }}
      />
      <canvas ref={tela} className="absolute inset-0 h-full w-full" />

      <div className="absolute right-4 top-4 z-20 flex gap-4 text-white/70">
        <Link href="/catalogo" aria-label="Buscar produtos" className="hover:text-white">
          <Search size={20} strokeWidth={1.75} />
        </Link>
        <Link href="/carrinho" aria-label="Carrinho" className="hover:text-white">
          <ShoppingCart size={20} strokeWidth={1.75} />
        </Link>
      </div>

      {/* Título e menu entram depois da rajada. */}
      <div
        className="absolute inset-x-0 bottom-[6vh] z-10 flex flex-col items-center px-5 text-center transition-all duration-1000"
        style={{ opacity: textoVisivel ? 1 : 0, transform: `translateY(${textoVisivel ? 0 : 24}px)`, pointerEvents: textoVisivel ? "auto" : "none" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-28 bottom-0 -z-10 bg-gradient-to-t from-[#050408] via-[#050408]/70 to-transparent" />
        <Wordmark tone="dark" />
        <nav aria-label="Menu inicial" className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
          {MENU_INICIAL.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="w-[140px] rounded border-2 border-gold/60 bg-white/5 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:border-gold hover:bg-gold hover:text-ink sm:w-[170px]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-[11px] text-white/60">Frete calculado na hora · 12x sem juros · 5% off no Pix</p>
        <LiveLink href={LIVE_URL} className="mt-2 text-[11px]" />
        <p className="mt-4 text-[9px] uppercase tracking-[0.2em] text-white/30">
          Modelo 3D: Charizard Flying Animation, por ryad_raba (Sketchfab, CC BY)
        </p>
      </div>
    </section>
  );
}
