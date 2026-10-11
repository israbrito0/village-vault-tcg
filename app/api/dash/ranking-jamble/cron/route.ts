import { atualizarRankingJamble } from "@/lib/dash/jamble";
import { db, ok } from "@/lib/dash/servidor";

// Chamado pela Vercel uma vez por dia, perto da meia-noite, para guardar o
// ranking do mês mesmo sem ninguém abrir a tela -- assim o mês que fecha fica
// salvo. Só lê dado público; e não lê de novo se a última leitura é recente.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { data } = await db().from("dash_ranking_jamble_meses").select("atualizado_em").order("atualizado_em", { ascending: false }).limit(1);
  const ultima = data?.[0]?.atualizado_em ? new Date(data[0].atualizado_em as string).getTime() : 0;
  if (Date.now() - ultima < 10 * 60 * 1000) return ok({ ok: true, pulado: "lido há pouco" });
  return ok(await atualizarRankingJamble());
}
