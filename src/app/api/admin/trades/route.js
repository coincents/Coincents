import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// GET - List all trades (admin only)
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = {};
    if (status) where.status = status;

    const trades = await prisma.trade.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate stats
    const stats = {
      total: trades.length,
      pending: trades.filter((t) => t.status === "PENDING").length,
      won: trades.filter((t) => t.status === "WON").length,
      lost: trades.filter((t) => t.status === "LOST").length,
      closed: trades.filter((t) => t.status === "CLOSED").length,
    };

    return NextResponse.json({
      success: true,
      trades,
      stats,
    });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
