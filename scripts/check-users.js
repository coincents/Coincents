const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, ethereumAddress: true, balance: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  console.table(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      ethereumAddress: u.ethereumAddress,
      balance: u.balance,
      createdAt: u.createdAt,
    }))
  );
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
