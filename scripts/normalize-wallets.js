#!/usr/bin/env node
/**
 * Normalizes user wallet addresses by ensuring:
 * 1. ethereumAddress is always populated (lowercase) for wallet users.
 * 2. Placeholder emails always use the wallet.local domain.
 * 3. Duplicate rows created for the same wallet are merged so only one user remains.
 *
 * This script is idempotent and can be re-run safely.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const EMAIL_HEX_REGEX = /^(0x[0-9a-fA-F]{40})/;

const placeholderEmail = (address) => `${address}@wallet.local`;

async function migrateRelations(fromId, toId) {
  const tasks = [
    prisma.trade.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.withdrawRequest.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.transaction.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.deposit.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.walletAddress.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.session.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.account.updateMany({ where: { userId: fromId }, data: { userId: toId } }),
    prisma.auditLog.updateMany({
      where: { actorUserId: fromId },
      data: { actorUserId: toId },
    }),
  ];
  await Promise.all(tasks);
}

function extractAddress(user) {
  if (user.ethereumAddress && HEX_ADDRESS_REGEX.test(user.ethereumAddress)) {
    return user.ethereumAddress.toLowerCase();
  }
  if (user.email) {
    const match = EMAIL_HEX_REGEX.exec(user.email);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

function needsPlaceholderEmail(user) {
  if (!user.email) return false;
  return EMAIL_HEX_REGEX.test(user.email);
}

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      ethereumAddress: true,
      balance: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const addressMap = new Map();
  for (const user of users) {
    const normalized = extractAddress(user);
    if (!normalized) continue;
    if (!addressMap.has(normalized)) {
      addressMap.set(normalized, []);
    }
    addressMap.get(normalized).push(user);
  }

  let deduped = 0;
  let updated = 0;

  for (const [address, userList] of addressMap.entries()) {
    if (userList.length > 1) {
      // Prefer the user with the highest balance (fallback to earliest creation).
      userList.sort((a, b) => {
        const balanceDiff = (b.balance ?? 0) - (a.balance ?? 0);
        if (balanceDiff !== 0) return balanceDiff;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    }

    const primary = userList[0];
    const duplicates = userList.slice(1);

    for (const dup of duplicates) {
      if (dup.id === primary.id) continue;
      // Transfer balance if duplicate somehow has funds.
      if ((dup.balance ?? 0) !== 0) {
        await prisma.user.update({
          where: { id: primary.id },
          data: { balance: { increment: dup.balance ?? 0 } },
        });
      }
      await migrateRelations(dup.id, primary.id);
      await prisma.user.delete({ where: { id: dup.id } });
      deduped += 1;
    }

    const updates = {};
    if (primary.ethereumAddress?.toLowerCase() !== address) {
      updates.ethereumAddress = address;
    }

    if (needsPlaceholderEmail(primary)) {
      updates.email = placeholderEmail(address);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: primary.id }, data: updates });
      updated += 1;
    }
  }

  console.log(
    `Wallet normalization complete. Deduped ${deduped} duplicate users, updated ${updated} records.`
  );
}

main()
  .catch((err) => {
    console.error("Normalization failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

