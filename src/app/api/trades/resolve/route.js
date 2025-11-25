import { NextResponse } from 'next/server';
import prismaPromise from "@/lib/prisma";

// POST - Resolve binary trade
export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const body = await request.json();
    const { tradeId, manualResult } = body;
    
    // Validate required fields
    if (!tradeId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: tradeId' },
        { status: 400 }
      );
    }
    
    // Validate manual result if provided
    if (manualResult && !['WON', 'LOST'].includes(manualResult)) {
      return NextResponse.json(
        { success: false, error: 'Invalid manualResult. Must be WON or LOST' },
        { status: 400 }
      );
    }
    
    // Find the trade
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        user: true
      }
    });
    
    if (!trade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }
    
    // Check if trade is already resolved
    if (trade.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Trade is already resolved' },
        { status: 400 }
      );
    }
    
    // Determine trade result
    let result;
    if (manualResult) {
      result = manualResult;
    } else {
      // Random 50/50 result
      result = Math.random() < 0.5 ? 'WON' : 'LOST';
    }
    
    // Calculate payout if won
    let payout = 0;
    if (result === 'WON') {
      payout = trade.amount + (trade.amount * (trade.returnPct / 100));
    }
    
    // Update trade status and resolved time
    const updatedTrade = await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: result,
        resolvedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            balance: true
          }
        }
      }
    });
    
    // Update user balance if trade won
    let updatedUser = trade.user;
    if (result === 'WON') {
      updatedUser = await prisma.user.update({
        where: { id: trade.userId },
        data: {
          balance: trade.user.balance + payout
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      trade: {
        ...updatedTrade,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          balance: updatedUser.balance
        }
      },
      result: result,
      payout: payout,
      message: `Trade resolved: ${result}${result === 'WON' ? ` - Payout: $${payout.toFixed(2)}` : ''}`
    });
    
  } catch (error) {
    console.error('Error resolving binary trade:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to resolve binary trade' },
      { status: 500 }
    );
  }
}
