-- CreateTable
CREATE TABLE "AuditTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "totalIssues" INTEGER NOT NULL,
    "criticalIssues" INTEGER NOT NULL,
    "highIssues" INTEGER NOT NULL,
    "mediumIssues" INTEGER NOT NULL,
    "lowIssues" INTEGER NOT NULL,
    "filesScanned" INTEGER NOT NULL,
    "linesOfCode" INTEGER NOT NULL,
    "issues" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "aiInsights" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AuditTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuditTask_userId_idx" ON "AuditTask"("userId");

-- CreateIndex
CREATE INDEX "AuditTask_status_idx" ON "AuditTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_taskId_key" ON "AuditReport"("taskId");
