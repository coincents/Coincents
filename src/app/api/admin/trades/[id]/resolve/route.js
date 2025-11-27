import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// POST - Resolve a trade (admin only)
export async function POST(request, { params }) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { result, priceClose } = await request.json();

    // Validate result
    if (!result || !["WON", "LOST"].includes(result)) {
      return NextResponse.json(
        { success: false, error: "Invalid result. Must be WON or LOST" },
        { status: 400 }
      );
    }

    // Find the trade
    const trade = await prisma.trade.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!trade) {
      return NextResponse.json(
        { success: false, error: "Trade not found" },
        { status: 404 }
      );
    }

    if (trade.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Trade has already been resolved" },
        { status: 400 }
      );
    }

    // Calculate P&L
    // If WON: user gets back their amount + profit (amount * returnPct / 100)
    // If LOST: user loses their amount (already deducted when trade was created)
    const returnAmount = trade.amount * (trade.returnPct / 100);
    const pnl = result === "WON" ? returnAmount : -trade.amount;

    // Calculate balance change
    // When trade was created, amount was already deducted from user balance
    // If WON: return original amount + profit
    // If LOST: nothing to return (already deducted)
    const balanceChange = result === "WON" ? trade.amount + returnAmount : 0;

    // Update trade and user balance in a transaction
    const [updatedTrade] = await prisma.$transaction([
      prisma.trade.update({
        where: { id },
        data: {
          status: result,
          priceClose: priceClose || trade.priceOpen,
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

    return NextResponse.json({
      success: true,
      trade: updatedTrade,
      message: `Trade resolved as ${result}. ${
        result === "WON"
          ? `User balance increased by $${balanceChange.toFixed(2)}`
          : "User lost their stake"
      }`,
    });
  } catch (error) {
    console.error("Error resolving trade:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resolve trade" },
      { status: 500 }
    );
  }
}
