import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getSpot, getAt } from "@/lib/price-service";

export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }
    const body = await request.json();
    const { tradeId, priceClose, useHistoricalAt } = body;
    if (!tradeId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: tradeId" },
        { status: 400 }
      );
    }

    const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
    if (!trade) {
      return NextResponse.json({ success: false, error: "Trade not found" }, { status: 404 });
    }
    if (trade.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Trade already processed" },
        { status: 400 }
      );
    }

    let closePx = priceClose;
    let closeAt = new Date();
    if (closePx == null) {
      if (useHistoricalAt === "openTime") {
        const hist = await getAt(trade.coin, new Date(trade.priceOpenAt).getTime());
        closePx = hist.usd;
        closeAt = hist.at;
      } else {
        const spot = await getSpot(trade.coin);
        closePx = spot.usd;
        closeAt = spot.at;
      }
    }

    // Compute PnL for binary: win returns amount * returnPct, lose returns -amount
    const isUp = trade.direction === "UP";
    const movedUp = closePx >= trade.priceOpen;
    const win = (isUp && movedUp) || (!isUp && !movedUp);
    const pnl = win ? trade.amount * (trade.returnPct / 100) : -trade.amount;

    const updated = await prisma.$transaction(async (tx) => {
      // Update trade
      const t = await tx.trade.update({
        where: { id: trade.id },
        data: {
          priceClose: closePx,
          priceCloseAt: closeAt,
          pnl,
          status: "CLOSED",
          resolvedAt: new Date(),
        },
      });
      // Update user balance
      const user = await tx.user.findUnique({ where: { id: trade.userId } });
      await tx.user.update({
        where: { id: trade.userId },
        data: { balance: user.balance + trade.amount + pnl },
      });
      // Audit
      await tx.auditLog.create({
        data: {
          actorUserId: auth.session.user.id,
          action: "TRADE_CLOSE",
          entity: "Trade",
          entityId: trade.id,
          metadata: {
            coin: trade.coin,
            direction: trade.direction,
            priceOpen: trade.priceOpen,
            priceClose: closePx,
            pnl,
          },
        },
      });
      return t;
    });

    return NextResponse.json({ success: true, trade: updated });
  } catch (error) {
    console.error("Error closing trade:", error);
    return NextResponse.json({ success: false, error: "Failed to close trade" }, { status: 500 });
  }
}


