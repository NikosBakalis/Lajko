-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupervisingFaculty" (
    "thesisId" INTEGER NOT NULL,
    "facultyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" INTEGER,

    PRIMARY KEY ("thesisId", "facultyId"),
    CONSTRAINT "SupervisingFaculty_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisingFaculty_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisingFaculty_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupervisingFaculty" ("facultyId", "status", "thesisId") SELECT "facultyId", "status", "thesisId" FROM "SupervisingFaculty";
DROP TABLE "SupervisingFaculty";
ALTER TABLE "new_SupervisingFaculty" RENAME TO "SupervisingFaculty";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
