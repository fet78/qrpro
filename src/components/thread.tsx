import { dateFr } from "@/lib/format";

/** Fil de messages d'une demande de support (vue client et vue administrateur). */
export function Thread({ messages, viewer }: { messages: { id: string; body: string; fromAdmin: boolean; createdAt: Date }[]; viewer: "pro" | "admin" }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = viewer === "admin" ? m.fromAdmin : !m.fromAdmin;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-brand text-white" : "border border-line bg-surface"}`}>
              <div className={`mb-1 text-[12px] ${mine ? "text-white/75" : "text-muted"}`}>
                {m.fromAdmin ? "Support" : viewer === "admin" ? "Client" : "Vous"} · {dateFr(m.createdAt, true)}
              </div>
              <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export const TICKET_STATUS = {
  OUVERT: { label: "En attente du support", tone: "warn" },
  REPONDU: { label: "Répondu", tone: "info" },
  FERME: { label: "Résolu", tone: "success" },
} as const;
