-- AlterTable: sinkronisasi kolom keamanan plugin twoFactor Better Auth 1.7.10
ALTER TABLE "twoFactor"
  ADD COLUMN "verified" BOOLEAN DEFAULT true,
  ADD COLUMN "failedVerificationCount" INTEGER DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");
