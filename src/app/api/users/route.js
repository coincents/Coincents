import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";

// GET - Fetch users or a single user by query (?address= or ?id=)
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const id = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (address) {
      const user = await prisma.user.findUnique({
        where: { ethereumAddress: address.toLowerCase() },
        select: {
          id: true,
          email: true,
          balance: true,
          ethereumAddress: true,
          btcAddress: true,
          createdAt: true,
        },
      });
      return NextResponse.json({ success: true, user });
    }

    if (id || userId) {
      const user = await prisma.user.findUnique({
        where: { id: id || userId },
        select: {
          id: true,
          email: true,
          balance: true,
          ethereumAddress: true,
          btcAddress: true,
          createdAt: true,
          role: true,
        },
      });
      return NextResponse.json({ success: true, user });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        balance: true,
        ethereumAddress: true,
        btcAddress: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ success: true, users, count: users.length });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const body = await request.json();
    const { userId, email, ethereumAddress, btcAddress } = body;
    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId, email" },
        { status: 400 }
      );
    }
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        email,
        ethereumAddress: ethereumAddress?.toLowerCase() || null,
        btcAddress: btcAddress || null,
      },
      create: {
        id: userId,
        email,
        password: "api-created",
        ethereumAddress: ethereumAddress?.toLowerCase() || null,
        btcAddress: btcAddress || null,
      },
    });
    return NextResponse.json({
      success: true,
      user,
      message: "User upserted successfully",
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// PUT - Update user data (activity, USD balances, etc.)
export async function PUT(request) {
  const prisma = await prismaPromise;
  try {
    const body = await request.json();
    const { userId, ethereumAddress, btcAddress, email, balance } = body;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId" },
        { status: 400 }
      );
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email ?? undefined,
        balance: typeof balance === "number" ? balance : undefined,
        ethereumAddress: ethereumAddress
          ? ethereumAddress.toLowerCase()
          : undefined,
        btcAddress: btcAddress ?? undefined,
      },
    });
    return NextResponse.json({
      success: true,
      user: updated,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}
