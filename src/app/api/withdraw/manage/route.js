import { NextResponse } from 'next/server';
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// PATCH - Admin approves or rejects withdraw request
export async function PATCH(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }
    const body = await request.json();
    const { requestId, status, txHash, adminNotes } = body;
    
    // Validate required fields
    if (!requestId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: requestId, status' },
        { status: 400 }
      );
    }
    
    // Validate status
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }
    
    // Find the withdraw request
    const withdrawRequest = await prisma.withdrawRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        user: true
      }
    });
    
    if (!withdrawRequest) {
      return NextResponse.json(
        { success: false, error: 'Withdraw request not found' },
        { status: 404 }
      );
    }
    
    // Check if request is already processed
    if (withdrawRequest.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Withdraw request is already processed' },
        { status: 400 }
      );
    }
    
    // Process update with optional refund on rejection
    const updatedWithdrawRequest = await prisma.$transaction(async (tx) => {
      const update = await tx.withdrawRequest.update({
        where: { id: parseInt(requestId) },
        data: {
          status: status,
          resolvedAt: new Date(),
          txHash: txHash || withdrawRequest.txHash,
          adminNotes: adminNotes || null,
        }
      });
      if (status === 'REJECTED') {
        // Refund reserved amount
        const user = await tx.user.findUnique({ where: { id: withdrawRequest.userId } });
        await tx.user.update({
          where: { id: withdrawRequest.userId },
          data: { balance: user.balance + withdrawRequest.amount }
        });
      }
      // Audit log
      await tx.auditLog.create({
        data: {
          actorUserId: auth.session.user.id,
          action: "WITHDRAW_" + status,
          entity: "WithdrawRequest",
          entityId: String(requestId),
          metadata: {
            amount: withdrawRequest.amount,
            toAddress: withdrawRequest.toAddress,
            txHash: txHash || null,
            adminNotes: adminNotes || null
          }
        }
      });
      return update;
    });
    
    return NextResponse.json({
      success: true,
      withdrawRequest: updatedWithdrawRequest,
      message: `Withdraw request ${status.toLowerCase()} successfully`
    });
    
  } catch (error) {
    console.error('Error managing withdraw request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to manage withdraw request' },
      { status: 500 }
    );
  }
}
