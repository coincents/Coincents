import { NextResponse } from 'next/server';
import prismaPromise from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// GET - List all withdraw requests (latest first)
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireUser(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    const { user } = auth.session;
    const withdrawRequests = await prisma.withdrawRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      success: true,
      withdrawRequests,
      count: withdrawRequests.length
    });
    
  } catch (error) {
    console.error('Error fetching withdraw requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdraw requests' },
      { status: 500 }
    );
  }
}
