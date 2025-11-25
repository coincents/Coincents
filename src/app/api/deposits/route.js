import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// GET - Fetch all deposits (admin only)
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

    const deposits = await prisma.deposit.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            ethereumAddress: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      deposits,
    });
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch deposits" },
      { status: 500 }
    );
  }
}

