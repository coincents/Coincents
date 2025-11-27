import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET - List user's own deposits
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }
    const { user } = auth.session;
    const deposits = await prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      deposits,
      count: deposits.length,
    });
  } catch (error) {
    console.error("Error fetching user deposits:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch deposits" },
      { status: 500 }
    );
  }
}
