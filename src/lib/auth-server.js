import { betterAuth } from "better-auth";
import { siwe } from "better-auth/plugins";
import { username as usernamePlugin } from "better-auth/plugins";
import { admin as adminPlugin } from "better-auth/plugins";
import { generateRandomString } from "better-auth/crypto";
import { verifyMessage } from "viem";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

// Create a synchronous Prisma client for Better Auth
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  trustedOrigins: [
    process.env.NEXT_PUBLIC_URL || "http://localhost:3003",
    "http://localhost:3003",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production if you want email verification
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER",
        required: false,
      },
    },
  },
  plugins: [
    usernamePlugin(),
    siwe({
      domain: process.env.NEXT_PUBLIC_SIWE_DOMAIN || "localhost",
      anonymous: true,
      getNonce: async () => generateRandomString(32),
      verifyMessage: async ({ message, signature, address }) => {
        try {
          const isValid = await verifyMessage({
            address,
            message,
            signature,
          });
          return Boolean(isValid);
        } catch {
          return false;
        }
      },
      // Hook to sync wallet address to user record
      async onSuccess({ user, walletAddress }) {
        try {
          // Update user's ethereumAddress field
          await prisma.user.update({
            where: { id: user.id },
            data: { ethereumAddress: walletAddress.address },
          });
        } catch (error) {
          console.error("Failed to sync wallet address to user:", error);
        }
      },
    }),
    adminPlugin({
      defaultRole: "USER",
      adminRoles: ["ADMIN"],
    }),
    nextCookies(),
  ],
});


