import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SELECT_FIELDS = {
  id: true,
  email: true,
  ethereumAddress: true,
  balance: true,
};

export async function PATCH(request, { params }) {
  const prisma = await prismaPromise;

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || "Forbidden" },
        { status: 403 }
      );
    }

    const userId = params?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User id is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const mode = body?.mode === "delta" ? "delta" : "set";
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount)) {
      return NextResponse.json(
        { success: false, error: "Amount must be a valid number" },
        { status: 400 }
      );
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const data =
      mode === "delta"
        ? { balance: { increment: amount } }
        : { balance: amount };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: SELECT_FIELDS,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Balance updated successfully",
    });
  } catch (error) {
    console.error("Failed to update user balance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user balance" },
      { status: 500 }
    );
  }
}

