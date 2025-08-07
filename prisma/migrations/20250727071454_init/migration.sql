-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "primaryDomain" TEXT
);

-- CreateTable
CREATE TABLE "ApiKeyPair" (
    "kid" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PixelNonce" (
    "nonce" TEXT NOT NULL PRIMARY KEY,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "YahooConversion" (
    "yclid" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER,
    "visitedAt" DATETIME,
    "conversionedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "YahooAdApplication" (
    "clientId" TEXT NOT NULL PRIMARY KEY,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "code" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenCreatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "YahooAdAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "childAccountId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "conversionTitle" TEXT NOT NULL
);
