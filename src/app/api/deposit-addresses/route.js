import { NextResponse } from "next/server";
import prismaPromise from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  updateDepositAddressesSchema,
  validateAddressFormat,
  validateNetworkForToken,
} from "@/lib/validation/deposit-addresses";

// GET - Fetch all deposit addresses (public)
export async function GET(request) {
  const prisma = await prismaPromise;
  try {
    const addresses = await prisma.depositAddress.findMany({
      where: { isActive: true },
      orderBy: { token: "asc" },
    });

    // If no addresses in DB, return env fallback
    if (addresses.length === 0) {
      return NextResponse.json({
        success: true,
        addresses: [
          {
            token: "BTC",
            address: process.env.NEXT_PUBLIC_BTC_ADDRESS || "",
            network: "Bitcoin",
          },
          {
            token: "ETH",
            address: process.env.NEXT_PUBLIC_ETH_ADDRESS || "",
            network: "Ethereum",
          },
          {
            token: "USDT",
            address: process.env.NEXT_PUBLIC_USDT_ADDRESS || "",
            network: "Tron",
          },
          {
            token: "USDC",
            address: process.env.NEXT_PUBLIC_ETH_ADDRESS || "",
            network: "Ethereum",
          },
        ],
        source: "env",
      });
    }

    return NextResponse.json({
      success: true,
      addresses,
      source: "database",
    });
  } catch (error) {
    console.error("Error fetching deposit addresses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch deposit addresses" },
      { status: 500 }
    );
  }
}

// PUT - Update deposit addresses (admin only)
export async function PUT(request) {
  const prisma = await prismaPromise;
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = updateDepositAddressesSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { addresses } = validation.data;

    // Validate each address format and network compatibility
    const validationErrors = [];
    for (const addr of addresses) {
      // Validate address format
      const formatValidation = validateAddressFormat(addr.token, addr.address);
      if (!formatValidation.valid) {
        validationErrors.push({
          token: addr.token,
          error: formatValidation.message,
        });
      }

      // Validate network compatibility
      if (addr.network) {
        const networkValidation = validateNetworkForToken(addr.token, addr.network);
        if (!networkValidation.valid) {
          validationErrors.push({
            token: addr.token,
            error: networkValidation.message,
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Address validation failed",
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Update or create each address
    const results = await Promise.all(
      addresses.map(async (addr) => {
        return prisma.depositAddress.upsert({
          where: { token: addr.token },
          update: {
            address: addr.address,
            network: addr.network || null,
            isActive: addr.isActive !== false,
          },
          create: {
            token: addr.token,
            address: addr.address,
            network: addr.network || null,
            isActive: addr.isActive !== false,
          },
        });
      })
    );

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: auth.session.user.id,
        action: "DEPOSIT_ADDRESSES_UPDATE",
        entity: "DepositAddress",
        entityId: "bulk",
        metadata: { addresses },
      },
    });

    return NextResponse.json({
      success: true,
      addresses: results,
      message: "Deposit addresses updated successfully",
    });
  } catch (error) {
    console.error("Error updating deposit addresses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update deposit addresses" },
      { status: 500 }
    );
  }
}

