-- AlterTable
ALTER TABLE "Mahasiswa" ADD COLUMN     "address" TEXT,
ADD COLUMN     "birth" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "province" TEXT;
