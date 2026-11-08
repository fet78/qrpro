import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

/**
 * Lien court envoyé par SMS / WhatsApp / notification : ouvre la demande dans l'espace pro,
 * en passant par la connexion si nécessaire (le lien seul ne donne accès à rien).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = `/espace/demandes/${encodeURIComponent(id)}`;
  const user = await getCurrentUser();
  redirect(user ? target : `/connexion?next=${encodeURIComponent(target)}`);
}
