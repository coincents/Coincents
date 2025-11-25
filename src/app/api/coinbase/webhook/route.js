import { NextResponse } from "next/server";
import crypto from "crypto";
import prismaPromise from "@/lib/prisma";

function verifySignature(secret, rawBody, signature) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody, "utf8");
  const digest = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature || "", "utf8"));
}

export async function POST(request) {
  const prisma = await prismaPromise;
  try {
    const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: "Webhook secret not configured" }, { status: 500 });
    }
    const signature = request.headers.get("X-CC-Webhook-Signature");
    const raw = await request.text();
    if (!verifySignature(secret, raw, signature)) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }
    const event = JSON.parse(raw);
    const type = event?.type;
    const data = event?.data;
    const metadata = data?.metadata || {};
    const userId = metadata.userId;
    const token = (metadata.token || "USDC").toUpperCase();
    const amount = parseFloat(metadata.amount || 0);
    const txHash = data?.payments?.[0]?.transaction_id || null;

    if (type === "charge:confirmed" && userId && amount > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.deposit.create({
          data: {
            userId,
            token,
            amount,
            transactionHash: txHash,
            status: "CONFIRMED",
          },
        });
        const user = await tx.user.findUnique({ where: { id: userId } });
        await tx.user.update({
          where: { id: userId },
          data: { balance: user.balance + amount },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: null,
            action: "DEPOSIT_CONFIRMED",
            entity: "Deposit",
            entityId: userId,
            metadata: { token, amount, txHash },
          },
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Coinbase webhook error:", error);
    return NextResponse.json({ success: false, error: "Webhook processing failed" }, { status: 500 });
  }
}


