"use client";

import type { jsPDF } from "jspdf";
import { inteiroBR, reaisBR, textoDoPdf, type Cor, type Destaque, type Relatorio } from "@/lib/dash/relatorio";

// Desenha o relatório em PDF do mesmo jeito que o Dash TCG (folha A4, faixa
// no topo, 8 números, 3 destaques com imagem, tabelas com cabeçalho escuro
// que se repete a cada página, "Página X de Y" no rodapé), com as cores da
// Village. As medidas saíram das páginas do PDF do Dash TCG.

const W = 595.28;
const H = 841.89;
const MX = 40;
const CW = W - 2 * MX;
const TOPO = 57; // onde a tabela recomeça nas páginas seguintes
const BAIXO = 52; // espaço do rodapé

type RGB = [number, number, number];
const C = {
  faixa: [23, 26, 33] as RGB,
  faixa2: [11, 12, 16] as RGB,
  marca: [244, 175, 20] as RGB,
  marcaTexto: [185, 130, 0] as RGB,
  verde: [24, 160, 88] as RGB,
  laranja: [205, 120, 10] as RGB,
  vermelho: [222, 64, 72] as RGB,
  azul: [21, 139, 202] as RGB,
  tinta: [28, 32, 36] as RGB,
  tinta2: [91, 97, 107] as RGB,
  tinta3: [139, 141, 152] as RGB,
  cartao: [246, 246, 249] as RGB,
  linha: [229, 230, 236] as RGB,
  zebra: [246, 246, 249] as RGB,
  divisa: [52, 56, 68] as RGB,
};
const corDe = (c: Cor): RGB => (c === "verde" ? C.verde : c === "laranja" ? C.laranja : c === "vermelho" ? C.vermelho : c === "azul" ? C.azul : C.marca);
const corDoTexto = (c: Cor): RGB => (c === "marca" ? C.marcaTexto : corDe(c));

// ---------- imagens ----------

type Imagem = { data: string; w: number; h: number; formato: "PNG" | "JPEG" };

async function carregarImagem(url: string, px: number, png: boolean): Promise<Imagem | null> {
  try {
    const controle = new AbortController();
    const t = setTimeout(() => controle.abort(), 9000);
    const r = await fetch(url, { mode: "cors", cache: "force-cache", signal: controle.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    const escala = Math.min(1, px / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (!png) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return png ? { data: canvas.toDataURL("image/png"), w, h, formato: "PNG" } : { data: canvas.toDataURL("image/jpeg", 0.86), w, h, formato: "JPEG" };
  } catch {
    return null;
  }
}

async function carregarTodas(pedidos: { url: string; px: number; png: boolean }[], aoAndar?: (feitas: number, total: number) => void) {
  const mapa = new Map<string, Imagem | null>();
  const fila = [...new Map(pedidos.filter((p) => p.url).map((p) => [p.url, p])).values()];
  let feitas = 0;
  const trabalhar = async () => {
    for (let p = fila.shift(); p; p = fila.shift()) {
      mapa.set(p.url, await carregarImagem(p.url, p.px, p.png));
      aoAndar?.(++feitas, mapa.size + fila.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabalhar));
  return mapa;
}

// Imagem "contida" num quadrado (sem esticar).
function desenharImagem(doc: jsPDF, img: Imagem | null | undefined, x: number, y: number, lado: number) {
  if (!img) {
    doc.setFillColor(...C.cartao);
    doc.roundedRect(x, y, lado, lado, 3, 3, "F");
    return;
  }
  const escala = Math.min(lado / img.w, lado / img.h);
  const w = img.w * escala;
  const h = img.h * escala;
  doc.addImage(img.data, img.formato, x + (lado - w) / 2, y + (lado - h) / 2, w, h, undefined, "FAST");
}

// ---------- texto ----------

function cortar(doc: jsPDF, texto: string, largura: number) {
  const t = textoDoPdf(texto);
  if (doc.getTextWidth(t) <= largura) return t;
  let fim = t.length;
  while (fim > 1 && doc.getTextWidth(t.slice(0, fim) + "…") > largura) fim--;
  return t.slice(0, fim).trimEnd() + "…";
}

function fonte(doc: jsPDF, tamanho: number, negrito = false, cor: RGB = C.tinta) {
  doc.setFont("helvetica", negrito ? "bold" : "normal");
  doc.setFontSize(tamanho);
  doc.setTextColor(...cor);
}

// ---------- partes da primeira página ----------

function faixa(doc: jsPDF, r: Relatorio) {
  doc.setFillColor(...C.faixa);
  doc.rect(0, 0, W, 113, "F");
  doc.setFillColor(...C.faixa2);
  doc.rect(W * 0.62, 0, W * 0.38, 113, "F");
  doc.setFillColor(...C.marca);
  doc.rect(0, 113, W, 3.5, "F");
  fonte(doc, 8, true, C.marca);
  doc.text("DASH VILLAGE", MX, 29);
  fonte(doc, 20, true, [255, 255, 255]);
  doc.text(r.nome, MX, 54);
  fonte(doc, 10, false, [215, 218, 224]);
  doc.text(cortar(doc, r.subtitulo, CW), MX, 78);
  fonte(doc, 7.3, false, [150, 156, 170]);
  doc.text(cortar(doc, r.info, CW), MX, 99);
}

function numeros(doc: jsPDF, r: Relatorio) {
  const w = (CW - 3 * 9.2) / 4;
  const h = 59;
  r.kpis.forEach((k, i) => {
    const x = MX + (i % 4) * (w + 9.2);
    const y = 139 + Math.floor(i / 4) * (h + 10);
    doc.setFillColor(...C.cartao);
    doc.setDrawColor(...C.linha);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, w, h, 6, 6, "FD");
    doc.setFillColor(...corDe(k.cor));
    doc.roundedRect(x, y, 3.4, h, 1.7, 1.7, "F");
    fonte(doc, 6.2, true, C.tinta2);
    doc.text(cortar(doc, k.rotulo.toUpperCase(), w - 22), x + 14, y + 16);
    fonte(doc, 13.5, true, C.tinta);
    doc.text(cortar(doc, k.valor, w - 20), x + 14, y + 35);
    fonte(doc, 6.4, false, corDoTexto(k.cor));
    doc.text(cortar(doc, k.sub, w - 20), x + 14, y + 49);
  });
}

function destaques(doc: jsPDF, r: Relatorio, imagens: Map<string, Imagem | null>) {
  const w = (CW - 2 * 10.8) / 3;
  const h = 68;
  const y = 286;
  r.destaques.forEach((d: Destaque, i) => {
    const x = MX + i * (w + 10.8);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...C.linha);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, w, h, 6, 6, "FD");
    if (!d) return;
    let tx = x + 11;
    if (d.imagem) {
      desenharImagem(doc, imagens.get(d.imagem), x + 11, y + 11, 46);
      tx = x + 68;
    }
    const largura = x + w - 10 - tx;
    fonte(doc, 6.2, true, corDoTexto(d.cor));
    doc.text(d.rotulo.toUpperCase(), tx, y + 19);
    fonte(doc, 9.5, true, C.tinta);
    doc.text(cortar(doc, d.titulo, largura), tx, y + 35);
    fonte(doc, 8, false, C.tinta2);
    doc.text(cortar(doc, d.sub, largura), tx, y + 51);
  });
}

// ---------- seções (título + tabela) ----------

type Coluna = { titulo: string; largura: number; direita?: boolean; negrito?: boolean; cor?: RGB; imagem?: boolean };

export async function gerarPdf(r: Relatorio, aoAndar?: (texto: string) => void) {
  aoAndar?.("Carregando as imagens…");
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pedidos = [
    ...r.produtos.map((p) => ({ url: p.imagem ?? "", px: 120, png: false })),
    ...r.icones.map((i) => ({ url: i.imagem ?? "", px: 72, png: true })),
    ...r.destaques.filter(Boolean).map((d) => ({ url: d!.imagem ?? "", px: 140, png: d!.cor === "azul" })),
  ];
  const imagens = await carregarTodas(pedidos, (f, t) => aoAndar?.(`Carregando as imagens… ${f}/${t}`));
  aoAndar?.("Montando o PDF…");

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({ title: `${r.nome} · ${textoDoPdf(r.subtitulo)}`, creator: "Dash Village" });
  faixa(doc, r);
  numeros(doc, r);
  destaques(doc, r, imagens);
  let y = 363;

  const secao = (titulo: string, nota: string, colunas: Coluna[], linhas: (string | number)[][], opcoes: { alturaLinha?: number; imagens?: (string | null)[]; ladoImagem?: number } = {}) => {
    if (!linhas.length) return;
    const alturaLinha = opcoes.alturaLinha ?? 21.6;
    // Título, cabeçalho e ao menos uma linha na mesma página.
    if (y + 25 + 22 + alturaLinha > H - BAIXO) {
      doc.addPage();
      y = TOPO;
    }
    doc.setFillColor(...C.marca);
    doc.roundedRect(MX, y, 6, 17, 3, 3, "F");
    fonte(doc, 12.5, true, C.tinta);
    doc.text(textoDoPdf(titulo), MX + 14, y + 13.5);
    if (nota) {
      fonte(doc, 7.5, false, C.tinta3);
      doc.text(textoDoPdf(nota), W - MX, y + 13.5, { align: "right" });
    }
    autoTable(doc, {
      startY: y + 25,
      margin: { left: MX, right: MX, top: TOPO, bottom: BAIXO },
      theme: "plain",
      showHead: "everyPage",
      head: [colunas.map((c) => ({ content: c.titulo, styles: { halign: c.direita ? "right" : "left" } }))],
      body: linhas.map((l) => l.map((v) => String(v).split("\n").map(textoDoPdf).join("\n"))),
      styles: { font: "helvetica", fontSize: 8, textColor: C.tinta, cellPadding: { top: 6.4, bottom: 6.4, left: 6.5, right: 6.5 }, valign: "middle", overflow: "linebreak", minCellHeight: alturaLinha },
      headStyles: { fillColor: C.faixa, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, minCellHeight: 22, cellPadding: { top: 7, bottom: 7, left: 6.5, right: 6.5 } },
      columnStyles: Object.fromEntries(
        colunas.map((c, i) => [
          i,
          { cellWidth: c.largura, halign: c.direita ? "right" : "left", fontStyle: c.negrito ? "bold" : "normal", ...(c.cor ? { textColor: c.cor } : {}) },
        ]),
      ),
      didParseCell: (d) => {
        if (d.section === "body" && d.row.index % 2 === 0) d.cell.styles.fillColor = C.zebra;
        if (d.section === "body" && colunas[d.column.index]?.imagem) d.cell.text = [];
      },
      didDrawCell: (d) => {
        // As divisas claras entre as colunas do cabeçalho.
        if (d.section === "head" && d.column.index < colunas.length - 1) {
          doc.setDrawColor(...C.divisa);
          doc.setLineWidth(0.6);
          doc.line(d.cell.x + d.cell.width, d.cell.y, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        }
        if (d.section === "body" && colunas[d.column.index]?.imagem && opcoes.imagens) {
          const url = opcoes.imagens[d.row.index];
          const lado = opcoes.ladoImagem ?? 34;
          if (url) desenharImagem(doc, imagens.get(url), d.cell.x + (d.cell.width - lado) / 2, d.cell.y + (d.cell.height - lado) / 2, lado);
        }
      },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 15;
  };

  const verde = C.verde;
  if (r.tipo === "periodo") {
    secao(
      `Lives do período (${r.lives.length})`,
      "",
      [
        { titulo: "Data", largura: 61.5 },
        { titulo: "Vendedor", largura: 57.7 },
        { titulo: "Live", largura: 189 },
        { titulo: "Vendido", largura: 77, direita: true, negrito: true, cor: verde },
        { titulo: "Itens", largura: 34.6, direita: true },
        { titulo: "Compr.", largura: 40, direita: true },
        { titulo: "Emotions", largura: 55.4, direita: true },
      ],
      r.lives.map((l) => [l.data, l.vendedor, l.titulo, reaisBR(l.vendido), inteiroBR(l.itens), inteiroBR(l.compradores), inteiroBR(l.emocoes)]),
    );
  }
  secao(
    `Vendidos por produto (${r.produtos.length})`,
    r.notas.produtos,
    [
      { titulo: "", largura: 41.5, imagem: true },
      { titulo: "Produto", largura: 170, negrito: true },
      { titulo: "Qtd", largura: 37, direita: true },
      { titulo: "Valor total", largura: 77, direita: true, negrito: true, cor: verde },
      { titulo: "Preço médio", largura: 71, direita: true },
      { titulo: "Compradores", largura: 62, direita: true },
      { titulo: "% do total", largura: 57, direita: true },
    ],
    r.produtos.map((p) => ["", p.titulo, inteiroBR(p.qtd), reaisBR(p.total), reaisBR(p.medio), inteiroBR(p.compradores), p.pct]),
    { alturaLinha: 41, imagens: r.produtos.map((p) => p.imagem), ladoImagem: 34 },
  );
  secao(
    `Ranking de compradores (${r.compradores.length})`,
    r.notas.compradores,
    [
      { titulo: "#", largura: 28 },
      { titulo: "Comprador", largura: 144 },
      { titulo: "Itens", largura: 40, direita: true },
      { titulo: "Pago", largura: 78, direita: true },
      { titulo: "Pendente", largura: 79, direita: true },
      { titulo: "Total", largura: 80, direita: true, negrito: true, cor: verde },
      { titulo: "% do total", largura: 66.28, direita: true },
    ],
    r.compradores.map((c) => [c.posicao, `@${c.handle}`, inteiroBR(c.itens), reaisBR(c.pago), c.pendente ? reaisBR(c.pendente) : "—", reaisBR(c.total), c.pct]),
  );
  secao(
    "Emotions por ícone",
    r.notas.icones,
    [
      { titulo: "", largura: 33, imagem: true },
      { titulo: "Emotion", largura: 171.5, negrito: true },
      { titulo: "Quantidade", largura: 105, direita: true },
      { titulo: "Pontos", largura: 83, direita: true },
      { titulo: "% dos pontos", largura: 122.78, direita: true },
    ],
    r.icones.map((i) => ["", i.icone, inteiroBR(i.qtd), inteiroBR(i.pontos), i.pct]),
    { alturaLinha: 32.7, imagens: r.icones.map((i) => i.imagem), ladoImagem: 22 },
  );
  secao(
    `Pontos por usuário (${r.pontos.length})`,
    r.notas.pontos,
    [
      { titulo: "#", largura: 28 },
      { titulo: "Usuário", largura: 211.5 },
      { titulo: "Emotions", largura: 89, direita: true },
      { titulo: "Pontos", largura: 71, direita: true, negrito: true, cor: C.marcaTexto },
      { titulo: "% dos pontos", largura: 115.78, direita: true },
    ],
    r.pontos.map((p) => [p.posicao, `@${p.handle}`, inteiroBR(p.emocoes), inteiroBR(p.pontos), p.pct]),
  );
  secao(
    `Ganhadores dos sorteios (${r.ganhadores.length})`,
    "",
    r.tipo === "live"
      ? [
          { titulo: "Hora", largura: 33 },
          { titulo: "Regra", largura: 171.5 },
          { titulo: "Prêmio", largura: 137 },
          { titulo: "Ganhador", largura: 92 },
          { titulo: "Na live", largura: 37 },
          { titulo: "Situação", largura: 44.78 },
        ]
      : [
          { titulo: "Data", largura: 44.6 },
          { titulo: "Vendedor", largura: 56 },
          { titulo: "Regra", largura: 134 },
          { titulo: "Prêmio", largura: 108 },
          { titulo: "Ganhador", largura: 91.5 },
          { titulo: "Na live", largura: 37 },
          { titulo: "Situação", largura: 44.18 },
        ],
    r.ganhadores.map((g) => (r.tipo === "live" ? [g.quando, g.regra, g.premio, g.handle, g.naLive, g.situacao] : [g.quando.replace(" ", "\n"), g.vendedor, g.regra, g.premio, g.handle, g.naLive, g.situacao])),
  );
  if (r.tipo === "live") {
    secao(
      `Todas as vendas (${r.vendas.length})`,
      "",
      [
        { titulo: "Hora", largura: 36 },
        { titulo: "Item", largura: 116 },
        { titulo: "Comprador", largura: 131 },
        { titulo: "Tipo", largura: 82 },
        { titulo: "Qtd", largura: 28, direita: true },
        { titulo: "Valor", largura: 68.5, direita: true },
        { titulo: "Status", largura: 53.78 },
      ],
      r.vendas.map((v) => [v.hora, v.titulo, v.comprador, v.tipo, inteiroBR(v.qtd), reaisBR(v.valor), v.status]),
    );
  }

  // Topo das páginas seguintes e o rodapé de todas, agora que se sabe quantas são.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFillColor(...C.marca);
      doc.rect(0, 0, W, 4.6, "F");
      fonte(doc, 6.5, true, C.marcaTexto);
      doc.text("DASH VILLAGE", MX, 26);
      fonte(doc, 7, false, C.tinta3);
      doc.text(cortar(doc, r.cabecalho, CW - 90), W - MX, 26, { align: "right" });
    }
    doc.setDrawColor(...C.linha);
    doc.setLineWidth(0.6);
    doc.line(MX, 808, W - MX, 808);
    fonte(doc, 6.5, false, C.tinta3);
    doc.text(cortar(doc, r.rodape, CW - 80), MX, 820);
    doc.text(`Página ${p} de ${total}`, W - MX, 820, { align: "right" });
  }
  return doc;
}

// Gera e baixa o arquivo (o mesmo nome em todo lugar).
export async function baixarPdf(r: Relatorio, aoAndar?: (texto: string) => void) {
  const doc = await gerarPdf(r, aoAndar);
  doc.save(r.arquivo);
  return doc;
}
