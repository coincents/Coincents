import { NextResponse } from 'next/server';
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// GET - Fetch all withdraw requests for admin
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }
    const withdrawRequests = await prisma.withdrawRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            balance: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      withdrawRequests
    });

  } catch (error) {
    console.error('Error fetching withdraw requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdraw requests' },
      { status: 500 }
    );
  }
}
