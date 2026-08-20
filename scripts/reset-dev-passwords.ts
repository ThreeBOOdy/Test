import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/server/password";

const connectionString =
  process.env.DATABASE_URL ?? "mysql://practice:practice@127.0.0.1:3306/practice_dev";
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

const DEV_TEST_USERNAMES = ["student", "teacher", "admin"] as const;

async function main() {
  const seedPassword = process.env.APP_SEED_PASSWORD ?? "123456";
  const passwordHash = hashPassword(seedPassword);

  for (const username of DEV_TEST_USERNAMES) {
    const result = await prisma.user.updateMany({
      where: { username },
      data: { passwordHash },
    });
    if (result.count > 0) {
      console.log(`重置账号: ${username}`);
    } else {
      console.warn(`未找到账号: ${username}，跳过重置`);
    }
  }
}

main().finally(() => prisma.$disconnect());
