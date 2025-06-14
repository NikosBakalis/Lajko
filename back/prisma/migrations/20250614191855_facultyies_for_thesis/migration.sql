-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "studentId" TEXT,
    "postalAddress" TEXT,
    "mobilePhone" TEXT,
    "landlinePhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Thesis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "facultyId" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Thesis_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Thesis_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_SupervisingFaculty" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_SupervisingFaculty_A_fkey" FOREIGN KEY ("A") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_SupervisingFaculty_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_StudentSelections" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_StudentSelections_A_fkey" FOREIGN KEY ("A") REFERENCES "Thesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_StudentSelections_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Thesis_assignedToId_key" ON "Thesis"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "_SupervisingFaculty_AB_unique" ON "_SupervisingFaculty"("A", "B");

-- CreateIndex
CREATE INDEX "_SupervisingFaculty_B_index" ON "_SupervisingFaculty"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_StudentSelections_AB_unique" ON "_StudentSelections"("A", "B");

-- CreateIndex
CREATE INDEX "_StudentSelections_B_index" ON "_StudentSelections"("B");
