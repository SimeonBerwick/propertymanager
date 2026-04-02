import { hash } from "bcryptjs";
import { ensureSeedData } from "../lib/store";
import { prisma } from "../lib/db";
import { seedOrganization, seedUser } from "../lib/seed";

async function main() {
  const passwordHash = await hash(seedUser.password, 10);

  await prisma.organization.upsert({
    where: { slug: seedOrganization.slug },
    update: {},
    create: {
      name: seedOrganization.name,
      slug: seedOrganization.slug,
    },
  });

  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: seedOrganization.slug },
  });

  await prisma.user.upsert({
    where: { email: seedUser.email },
    update: {
      name: seedUser.name,
      role: seedUser.role,
      organizationId: org.id,
      passwordHash,
    },
    create: {
      email: seedUser.email,
      name: seedUser.name,
      role: seedUser.role,
      organizationId: org.id,
      passwordHash,
    },
  });

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
