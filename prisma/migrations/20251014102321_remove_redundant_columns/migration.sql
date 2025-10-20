/*
  Warnings:

  - You are about to drop the column `asal` on the `Mahasiswa` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_birth` on the `Mahasiswa` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Mahasiswa" DROP COLUMN "asal",
DROP COLUMN "date_of_birth";
