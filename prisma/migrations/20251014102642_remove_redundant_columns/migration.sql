/*
  Warnings:

  - You are about to drop the column `address` on the `Mahasiswa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Mahasiswa" DROP COLUMN "address",
ADD COLUMN     "subdistrict" TEXT;
