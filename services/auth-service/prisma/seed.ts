import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const roleNames = ["ADMIN", "SELLER", "BUYER"];

  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Seeded roles: ADMIN, SELLER, BUYER");

  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: { email: "admin@test.com", passwordHash },
  });

  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole!.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole!.id },
  });

  console.log("Seeded admin user: admin@test.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
