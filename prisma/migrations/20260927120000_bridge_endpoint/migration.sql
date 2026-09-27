-- CreateTable
CREATE TABLE "BridgeEndpoint" (
    "role" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeEndpoint_pkey" PRIMARY KEY ("role")
);
