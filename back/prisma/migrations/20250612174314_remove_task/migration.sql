/*
  Warnings:

  - You are about to drop the `CommitteeInvite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommitteeNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Grade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ThesisTopic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_CommitteeMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `cancellationReason` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `draftFile` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `facultyDecisionId` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `finalGrade` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `nimertisLink` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `presentationDate` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `presentationLink` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `presentationRoom` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `supportingLinks` on the `Thesis` table. All the data in the column will be lost.
  - You are about to drop the column `topicId` on the `Thesis` table. All the data in the column will be lost.
  - Added the required column `description` to the `Thesis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `facultyId` to the `Thesis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Thesis` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_CommitteeMember_B_index";

-- DropIndex
DROP INDEX "_CommitteeMember_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CommitteeInvite";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CommitteeNote";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Grade";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Task";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ThesisTopic";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_CommitteeMember";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "_StudentSelections" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_StudentSelections_A_fkey" FOREIGN KEY ("A") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_StudentSelections_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Thesis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "facultyId" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Thesis_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Thesis_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Thesis" ("createdAt", "id", "status", "updatedAt") SELECT "createdAt", "id", "status", "updatedAt" FROM "Thesis";
DROP TABLE "Thesis";
ALTER TABLE "new_Thesis" RENAME TO "Thesis";
CREATE UNIQUE INDEX "Thesis_assignedToId_key" ON "Thesis"("assignedToId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "_StudentSelections_AB_unique" ON "_StudentSelections"("A", "B");

-- CreateIndex
CREATE INDEX "_StudentSelections_B_index" ON "_StudentSelections"("B");
