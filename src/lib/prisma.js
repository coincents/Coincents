import { PrismaClient } from "@prisma/client";

let prisma;

const createPrismaClient = (url) =>
  new PrismaClient({
    datasources: { db: { url } },
  });

async function initPrisma() {
  const poolUrl = process.env.DATABASE_URL;
  const directUrl =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (poolUrl) {
    try {
      prisma = createPrismaClient(poolUrl);
      await prisma.$connect();
      return;
    } catch (e) {
      // Primary URL failed, falling back to direct URL
    }
  }

  if (!directUrl) {
    throw new Error(
      "DATABASE_URL not found. Set DATABASE_URL or DATABASE_URL_UNPOOLED/DATABASE_URL_DIRECT/DIRECT_URL"
    );
  }

  prisma = createPrismaClient(directUrl);
  await prisma.$connect();
}

if (!global.prisma) {
  global.prisma = (async () => {
    await initPrisma();
    return prisma;
  })();
}

export default global.prisma;
