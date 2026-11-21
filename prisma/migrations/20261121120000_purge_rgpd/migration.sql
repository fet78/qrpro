-- Purge automatique des données anciennes (RGPD)
ALTER TABLE "User" ADD COLUMN "inactivityWarnedAt" TIMESTAMP(3);
ALTER TABLE "Setting" ADD COLUMN "lastPurgeAt" TIMESTAMP(3);
