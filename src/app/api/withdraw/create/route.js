import { NextResponse } from 'next/server';
import prismaPromise from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createWithdrawSchema } from "@/lib/validation/withdraw";
import { rateLimit } from "@/lib/rate-limit";

// POST - Create new withdraw request
export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    // Try Better Auth session first
    const auth = await requireUser(request);
    let userId;
    
    if (auth.ok) {
      userId = auth.session.user.id;
    } else {
      // Fallback: Check for userId in body (for wallet-based auth)
      const body = await request.json();
      if (!body.userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      userId = body.userId;
      // Re-parse body for the rest of the function
      request.json = () => Promise.resolve(body);
    }
    
    const body = await request.json();
    const ip = request.headers.get("x-forwarded-for") || "local";
    const rl = rateLimit(`withdraw:create:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
    const parsed = createWithdrawSchema.safeParse({
      amount: Number(body?.amount),
      toAddress: body?.toAddress,
      proofImage: body?.proofImage,
      txHash: body?.txHash,
    });
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }
    const { amount, toAddress, proofImage, txHash } = parsed.data;
    
    // Validate required fields
    if (!amount || !toAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: amount, toAddress' 
        },
        { status: 400 }
      );
    }
    
    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }
    
    // Check user and balance
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (dbUser.balance < amount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance for this withdrawal request' },
        { status: 400 }
      );
    }
    
    // Reserve funds and create request atomically
    const newWithdrawRequest = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: dbUser.balance - parseFloat(amount) }
      });
      return tx.withdrawRequest.create({
        data: {
          userId: userId,
          amount: parseFloat(amount),
          proofImage: proofImage || "",
          txHash: txHash || null,
          toAddress: String(toAddress),
          status: 'PENDING'
        },
        include: {
          user: {
            select: { id: true, balance: true }
          }
        }
      });
    });
    
    return NextResponse.json({
      success: true,
      withdrawRequest: newWithdrawRequest,
      message: 'Withdraw request submitted successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating withdraw request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create withdraw request' },
      { status: 500 }
    );
  }
}
