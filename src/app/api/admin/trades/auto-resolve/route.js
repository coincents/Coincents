import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const isAuthorized = async (request) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("x-cron-secret");
    if (provided !== secret) {
      return { ok: false, error: "Unauthorized cron request", status: 401 };
    }
    return { ok: true };
  }

  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return { ok: false, error: auth.error, status: 403 };
  }
  return { ok: true };
};

// POST - Resolve scheduled admin trades that have expired
export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await isAuthorized(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 403 }
      );
    }

    const now = new Date();
    const pendingTrades = await prisma.trade.findMany({
      where: {
        status: "PENDING",
        adminResult: { not: null },
      },
      include: { user: true },
    });

    const dueTrades = pendingTrades.filter((trade) => {
      const openAt = trade.priceOpenAt || trade.createdAt;
      const expiresAt = new Date(openAt.getTime() + trade.timeframe * 1000);
      return expiresAt <= now;
    });

    const resolved = [];
    const errors = [];

    for (const trade of dueTrades) {
      if (!["WON", "LOST"].includes(trade.adminResult)) {
        errors.push({
          tradeId: trade.id,
          error: `Invalid adminResult: ${trade.adminResult}`,
        });
        continue;
      }
      try {
        const returnAmount = trade.amount * (trade.returnPct / 100);
        const pnl = trade.adminResult === "WON" ? returnAmount : -trade.amount;
        const balanceChange =
          trade.adminResult === "WON" ? trade.amount + returnAmount : 0;

        const [updatedTrade] = await prisma.$transaction([
          prisma.trade.update({
            where: { id: trade.id },
            data: {
              status: trade.adminResult,
              priceClose: trade.priceOpen,
              pnl,
              resolvedAt: new Date(),
            },
          }),
          prisma.user.update({
            where: { id: trade.userId },
            data: {
              balance: { increment: balanceChange },
            },
          }),
        ]);
        resolved.push(updatedTrade.id);
      } catch (error) {
        errors.push({
          tradeId: trade.id,
          error: error.message || "Failed to resolve trade",
        });
      }
    }

    return NextResponse.json({
      success: true,
      resolvedCount: resolved.length,
      resolved,
      errors,
    });
  } catch (error) {
    console.error("Error auto-resolving trades:", error);
    return NextResponse.json(
      { success: false, error: "Failed to auto-resolve trades" },
      { status: 500 }
    );
  }
}
