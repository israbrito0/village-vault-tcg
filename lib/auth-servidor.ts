import { createClient } from "@supabase/supabase-js";

// Descobre quem é a pessoa pelo login dela (token do Supabase Auth), sem
// confiar em nenhum identificador que a tela mande. É isso que impede alguém
// de dar lance ou pagar em nome de outro.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE;

function cliente() {
  if (!URL || !SERVICE) throw new Error("Supabase não configurado");
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

export type ParticipanteLogado = {
  id: string;
  nome: string;
  usuarioId: string;
  whatsapp: string | null;
  bloqueado: boolean;
};

export async function usuarioDaRequisicao(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const db = cliente();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Liga a conta do cliente a um participante do leilão (cria na primeira vez).
export async function participanteDaRequisicao(req: Request): Promise<ParticipanteLogado | null> {
  const usuario = await usuarioDaRequisicao(req);
  if (!usuario) return null;
  const db = cliente();

  const { data: perfil } = await db.from("clientes").select("nome, whatsapp").eq("id", usuario.id).maybeSingle();
  const meta = usuario.user_metadata ?? {};
  const nome = String(perfil?.nome ?? meta.nome ?? meta.full_name ?? usuario.email?.split("@")[0] ?? "Cliente").slice(0, 40);
  const whatsapp = (perfil?.whatsapp as string | null) ?? null;

  const { data: existente } = await db
    .from("participantes")
    .select("id, nome, bloqueado")
    .eq("usuario_id", usuario.id)
    .maybeSingle();

  if (existente) {
    if (existente.nome !== nome) await db.from("participantes").update({ nome }).eq("id", existente.id);
    return { id: existente.id, nome, usuarioId: usuario.id, whatsapp, bloqueado: existente.bloqueado };
  }

  // O participante antigo exigia WhatsApp único; conta sem WhatsApp usa o id.
  const { data: novo, error } = await db
    .from("participantes")
    .insert({ nome, whatsapp: whatsapp ?? `conta-${usuario.id}`, usuario_id: usuario.id })
    .select("id, bloqueado")
    .single();
  if (error || !novo) {
    // Mesmo WhatsApp de um cadastro antigo, sem conta: adota esse participante.
    if (whatsapp) {
      const { data: antigo } = await db
        .from("participantes")
        .update({ usuario_id: usuario.id, nome })
        .eq("whatsapp", whatsapp)
        .is("usuario_id", null)
        .select("id, bloqueado")
        .maybeSingle();
      if (antigo) return { id: antigo.id, nome, usuarioId: usuario.id, whatsapp, bloqueado: antigo.bloqueado };
    }
    return null;
  }
  return { id: novo.id, nome, usuarioId: usuario.id, whatsapp, bloqueado: novo.bloqueado };
}
