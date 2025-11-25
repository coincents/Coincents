import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateDefaultUsername } from "@/lib/username";

export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    const { user } = auth.session;
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    if (dbUser.username && dbUser.displayUsername) {
      return NextResponse.json({ success: true, user: dbUser, updated: false });
    }
    // Generate and ensure uniqueness
    let candidate = generateDefaultUsername(dbUser.ethereumAddress || "");
    // loop a few tries to avoid collisions
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.user.findFirst({ where: { username: candidate } });
      if (!exists) break;
      candidate = generateDefaultUsername(dbUser.ethereumAddress || "");
    }
    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: { username: candidate, displayUsername: candidate },
    });
    return NextResponse.json({ success: true, user: updated, updated: true });
  } catch (error) {
    console.error("ensure-username error:", error);
    return NextResponse.json({ success: false, error: "Failed to ensure username" }, { status: 500 });
  }
}


