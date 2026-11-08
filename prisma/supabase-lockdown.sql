-- À exécuter UNE FOIS dans Supabase (SQL Editor) après « npm run db:deploy », puis après chaque nouvelle migration
-- qui ajoute une table.
--
-- Pourquoi : Supabase expose automatiquement le schéma « public » via son API REST (clé anon).
-- L'application n'utilise PAS cette API : elle se connecte directement à PostgreSQL côté serveur.
-- On active donc la Row Level Security sur toutes les tables SANS aucune politique : l'API REST
-- ne peut plus rien lire ni écrire, tandis que la connexion serveur (rôle propriétaire) continue de fonctionner.
-- On retire aussi les droits des rôles « anon » et « authenticated ».

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.tablename);
  END LOOP;
END $$;

-- Vérification : toutes les lignes doivent afficher rowsecurity = true.
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
