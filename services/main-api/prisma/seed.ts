import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirrors the admin seeded by auth-service (admin@test.com, userId=1).
// auth-service seeds it first via docker-compose `depends_on`, so userId=1 is stable.
async function main() {
  await prisma.userProfile.upsert({
    where: { userId: 1 },
    update: {},
    create: {
      userId: 1,
      name: "Admin",
      email: "admin@test.com",
    },
  });

  console.log("Seeded UserProfile for admin (userId=1)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
