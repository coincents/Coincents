import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSpot } from "@/lib/price-service";
import { createTradeSchema } from "@/lib/validation/trades";
import { rateLimit } from "@/lib/rate-limit";

// POST - Create new binary trade
export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    const { user } = auth.session;
    const body = await request.json();
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = rateLimit(`trades:create:${ip}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
    const parsed = createTradeSchema.safeParse({
      coin: body?.coin,
      type: body?.type,
      amount: Number(body?.amount),
      timeframe: Number(body?.timeframe),
    });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }
    const { coin, type, amount, timeframe } = parsed.data;

    // Validate required fields
    if (!coin || !type || !amount || !timeframe) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: coin, type, amount, timeframe",
        },
        { status: 400 }
      );
    }

    // Validate trade type
    if (!["UP", "DOWN"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid trade type. Must be UP or DOWN" },
        { status: 400 }
      );
    }

    // Validate amount and timeframe
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (timeframe < 30 || timeframe > 3600) {
      return NextResponse.json(
        {
          success: false,
          error: "Timeframe must be between 30 and 3600 seconds",
        },
        { status: 400 }
      );
    }

    // Check if user has sufficient balance
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    if (dbUser.balance < amount) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance for this trade" },
        { status: 400 }
      );
    }

    // Calculate return percentage (mirror the client for consistency)
    const returnPct =
      timeframe <= 60
        ? 20
        : timeframe <= 120
        ? 30
        : timeframe <= 180
        ? 40
        : timeframe <= 360
        ? 50
        : timeframe <= 600
        ? 60
        : timeframe <= 1200
        ? 70
        : 80;

    // Snapshot open price
    const spot = await getSpot(coin);

    // Create trade and debit in a single transaction
    const newTrade = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { balance: dbUser.balance - parseFloat(amount) },
      });
      return tx.trade.create({
        data: {
          userId: user.id,
          coin: coin.toUpperCase(),
          type,
          direction: type,
          amount: parseFloat(amount),
          timeframe: parseInt(timeframe),
          returnPct,
          priceOpen: spot.usd,
          priceOpenAt: new Date(),
          status: "PENDING",
        },
        include: {
          user: {
            select: { id: true, balance: true, ethereumAddress: true },
          },
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        trade: newTrade,
        message: "Binary trade created successfully",
        potentialReturn: amount * (returnPct / 100),
        priceOpen: spot.usd,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating binary trade:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create binary trade" },
      { status: 500 }
    );
  }
}
