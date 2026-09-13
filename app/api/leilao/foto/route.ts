import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Sobe a foto da carta (a de verdade, tirada por você) para o Storage do
// Supabase e devolve o endereço público, que vai no lote.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TAMANHO_MAXIMO = 8 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

function autorizado(req: Request) {
  const esperado = process.env.METRICAS_TOKEN;
  const enviado = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return Boolean(esperado) && enviado === esperado;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: "chave inválida" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !servico) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("foto");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Mande a foto no campo 'foto'." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return NextResponse.json({ erro: "Foto acima de 8 MB." }, { status: 400 });
  }
  if (!TIPOS.includes(arquivo.type)) {
    return NextResponse.json({ erro: "Use JPG, PNG ou WEBP." }, { status: 400 });
  }

  const db = createClient(url, servico, { auth: { persistSession: false } });
  const extensao = arquivo.type.split("/")[1].replace("jpeg", "jpg");
  const nome = `cartas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;

  const { error } = await db.storage.from("leilao").upload(nome, arquivo, {
    contentType: arquivo.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const { data } = db.storage.from("leilao").getPublicUrl(nome);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
