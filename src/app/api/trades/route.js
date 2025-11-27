import { NextResponse } from 'next/server';
import prismaPromise from "@/lib/prisma";

// GET - Fetch all trades
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const completed = searchParams.get('completed');

    // Build where clause based on query parameters
    const where = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (type) where.type = type;
    // Support filtering for completed trades (WON, LOST, CLOSED)
    if (completed === 'true') {
      where.status = { in: ['WON', 'LOST', 'CLOSED'] };
    }
    
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    
    return NextResponse.json({
      success: true,
      trades: trades,
      count: trades.length
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}

// POST - Create new trade
export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const body = await request.json();
    const { userId, coin, type, amount, price, status = 'PENDING' } = body;
    
    // Validate required fields
    if (!userId || !coin || !type || !amount || !price) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: userId, coin, type, amount, price' 
        },
        { status: 400 }
      );
    }
    
    // Validate enum values
    if (!['BUY', 'SELL'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid trade type. Must be BUY or SELL' },
        { status: 400 }
      );
    }
    
    if (!['PENDING', 'EXECUTED', 'FAILED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be PENDING, EXECUTED, or FAILED' },
        { status: 400 }
      );
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // For BUY trades, check if user has sufficient balance
    const totalCost = parseFloat(amount) * parseFloat(price);
    if (type === 'BUY' && user.balance < totalCost) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance for this trade' },
        { status: 400 }
      );
    }
    
    // Create new trade
    const newTrade = await prisma.trade.create({
      data: {
        userId,
        coin: coin.toUpperCase(),
        type,
        amount: parseFloat(amount),
        status
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
    
    // If trade is executed, update user balance
    if (status === 'EXECUTED') {
      if (type === 'BUY') {
        await prisma.user.update({
          where: { id: userId },
          data: { balance: user.balance - totalCost }
        });
      } else if (type === 'SELL') {
        await prisma.user.update({
          where: { id: userId },
          data: { balance: user.balance + totalCost }
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      trade: newTrade,
      message: 'Trade created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating trade:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create trade' },
      { status: 500 }
    );
  }
}
