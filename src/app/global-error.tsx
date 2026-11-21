"use client";

/** Dernier filet : erreur dans la mise en page racine elle-même (styles minimaux, sans dépendances). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Un problème est survenu</h1>
          <p style={{ color: "#64748B", maxWidth: 360 }}>Le site est momentanément indisponible. Réessayez dans un instant.</p>
          {error.digest ? <p style={{ color: "#94A3B8", fontSize: 12 }}>Référence : {error.digest}</p> : null}
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 10, border: 0, background: "#1D4ED8", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
