import { db, erro, membroDaRequisicao, ok } from "@/lib/dash/servidor";

// A música do sorteio que a conta envia. O arquivo vai direto do navegador
// para o Supabase Storage (bucket público "dash-musicas") com um link de envio
// assinado -- assim um MP3 grande não passa pelo limite de 4,5 MB da Vercel.
//   POST {nome, tipo, tamanho} -> link para enviar e o endereço público
//   DELETE ?url=               -> apaga um arquivo antigo da conta
export const dynamic = "force-dynamic";

const BUCKET = "dash-musicas";
const MAXIMO = 20 * 1024 * 1024;
const TIPOS = /^audio\/(mpeg|mp3|wav|x-wav|ogg|aac|mp4|x-m4a|webm)$/;

const caminhoDaUrl = (url: string) => {
  const m = url.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`));
  return m ? decodeURIComponent(m[1]) : null;
};

export async function POST(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  if (membro.papel !== "dono") return erro(403, "só o dono muda a música do sorteio");
  const corpo = (await req.json().catch(() => ({}))) as { nome?: unknown; tipo?: unknown; tamanho?: unknown };
  const tipo = String(corpo.tipo ?? "");
  const tamanho = Number(corpo.tamanho) || 0;
  if (!TIPOS.test(tipo)) return erro(400, "Envie um arquivo de áudio (MP3, WAV, OGG ou M4A).");
  if (tamanho <= 0 || tamanho > MAXIMO) return erro(400, "O arquivo passa de 20 MB.");
  const nome = String(corpo.nome ?? "musica").slice(0, 120);
  const ext = (nome.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "mp3").toLowerCase();
  const caminho = `${membro.conta}/${Date.now()}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data) return erro(500, "não consegui preparar o envio");
  const { data: publico } = db().storage.from(BUCKET).getPublicUrl(caminho);
  return ok({ caminho, token: data.token, url: publico.publicUrl, nome });
}

export async function DELETE(req: Request) {
  const membro = await membroDaRequisicao(req);
  if (!membro) return erro(401, "sem acesso");
  if (membro.papel !== "dono") return erro(403, "só o dono muda a música do sorteio");
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const caminho = caminhoDaUrl(url);
  // Só apaga arquivo da própria conta.
  if (!caminho || !caminho.startsWith(`${membro.conta}/`)) return erro(400, "arquivo de outra conta");
  await db().storage.from(BUCKET).remove([caminho]);
  return ok({ ok: true });
}
