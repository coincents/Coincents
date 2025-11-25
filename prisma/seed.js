import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding admin user via Better Auth API...");

  const base =
    process.env.SEED_BASE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "http://localhost:3003";
  const email = (process.env.ADMIN_EMAIL || "admin@coincents.co").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "coincents@789";
  const username = process.env.ADMIN_USERNAME || "admin";
  const wallet = (process.env.ADMIN_WALLET || "").toLowerCase();

  // Check if admin already exists by email
  let admin = await prisma.user.findFirst({
    where: { email },
  });

  if (admin) {
    console.log("✅ Admin user already exists:", {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // Ensure they have admin role
    if (admin.role !== "ADMIN") {
      admin = await prisma.user.update({
        where: { id: admin.id },
        data: { role: "ADMIN" },
      });
      console.log("✅ Updated user to ADMIN role");
    }

    console.log("\nYou can sign in with:");
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    // Continue to seed deposit addresses below
  } else {
    // Create user via Better Auth sign-up API
    console.log(
      `Calling Better Auth sign-up API at ${base}/api/auth/sign-up/email...`
    );

    try {
      const res = await fetch(`${base}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: "Administrator",
          username,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Sign-up failed (${res.status}): ${errorText}`);
      }

      const result = await res.json();
      console.log("✅ User created via Better Auth");

      // Now update the user to be an admin
      admin = await prisma.user.findFirst({
        where: { email },
      });

      if (!admin) {
        throw new Error("User not found after sign-up");
      }

      // Update to ADMIN role and add optional wallet
      admin = await prisma.user.update({
        where: { id: admin.id },
        data: {
          role: "ADMIN",
          ethereumAddress: wallet || null,
          emailVerified: true,
        },
      });

      console.log("✅ Admin seeded successfully:", {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        role: admin.role,
      });

      console.log("\nYou can now sign in with:");
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
    } catch (error) {
      console.error(
        "❌ Failed to create admin via Better Auth API:",
        error.message
      );
      console.error(
        "\nMake sure the Next.js dev server is running on port 3003!"
      );
      console.error("Run: npm run dev");
      throw error;
    }
  }

  // Seed deposit addresses from env (runs regardless of admin creation)
  console.log("\n🏦 Seeding deposit addresses...");
  const depositAddresses = [
    {
      token: "BTC",
      address:
        process.env.NEXT_PUBLIC_BTC_ADDRESS ||
        "bc1qmsl2kfv2s0a6feq6qc79490q8qrassu4zjluh2",
      network: "Bitcoin",
    },
    {
      token: "ETH",
      address:
        process.env.NEXT_PUBLIC_ETH_ADDRESS ||
        "0x1525aa330B28bdC171B0096155061E6ba7adA631",
      network: "Ethereum",
    },
    {
      token: "USDT",
      address:
        process.env.NEXT_PUBLIC_USDT_ADDRESS ||
        "0x1525aa330B28bdC171B0096155061E6ba7adA631",
      network: "Ethereum",
    },
    {
      token: "BNB",
      address:
        process.env.NEXT_PUBLIC_BNB_ADDRESS ||
        "0x1525aa330B28bdC171B0096155061E6ba7adA631",
      network: "BSC",
    },
    {
      token: "SOL",
      address:
        process.env.NEXT_PUBLIC_SOL_ADDRESS ||
        "BhiyGMobAbXvghgQmaBLQsPjN9XZhajyr8nxdLtDKyRH",
      network: "Solana",
    },
  ];

  for (const addr of depositAddresses) {
    await prisma.depositAddress.upsert({
      where: { token: addr.token },
      update: { address: addr.address, network: addr.network },
      create: addr,
    });
  }
  console.log("✅ Deposit addresses seeded");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error during seeding:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
