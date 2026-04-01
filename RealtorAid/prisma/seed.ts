import { ensureSeedData } from "../lib/store";
import { prisma } from "../lib/db";

async function main() {
  await ensureSeedData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
