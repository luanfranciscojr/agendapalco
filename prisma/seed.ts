import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  const louvor = await prisma.ministry.upsert({
    where: { name: "Louvor" },
    update: {},
    create: { name: "Louvor" },
  });

  const teatro = await prisma.ministry.upsert({
    where: { name: "Teatro" },
    update: {},
    create: { name: "Teatro" },
  });

  await prisma.systemConfig.upsert({
    where: { key: "max_requests_per_ministry_per_week" },
    update: { value: "1" },
    create: {
      key: "max_requests_per_ministry_per_week",
      value: "1",
    },
  });

  await prisma.user.upsert({
    where: { id: "seed-admin-user" },
    update: {
      name: "Coordenação do Palco",
      username: "admin",
      passwordHash: hashPassword("admin123"),
      whatsappPhone: null,
      role: "admin",
      ministryId: null,
    },
    create: {
      id: "seed-admin-user",
      name: "Coordenação do Palco",
      username: "admin",
      passwordHash: hashPassword("admin123"),
      whatsappPhone: null,
      role: "admin",
    },
  });

  await prisma.user.upsert({
    where: { id: "seed-ministry-user-louvor" },
    update: {
      name: "Líder Louvor",
      username: "louvor",
      passwordHash: hashPassword("louvor123"),
      whatsappPhone: null,
      role: "ministry",
      ministryId: louvor.id,
    },
    create: {
      id: "seed-ministry-user-louvor",
      name: "Líder Louvor",
      username: "louvor",
      passwordHash: hashPassword("louvor123"),
      whatsappPhone: null,
      role: "ministry",
      ministryId: louvor.id,
    },
  });

  await prisma.user.upsert({
    where: { id: "seed-ministry-user-teatro" },
    update: {
      name: "Líder Teatro",
      username: "teatro",
      passwordHash: hashPassword("teatro123"),
      whatsappPhone: null,
      role: "ministry",
      ministryId: teatro.id,
    },
    create: {
      id: "seed-ministry-user-teatro",
      name: "Líder Teatro",
      username: "teatro",
      passwordHash: hashPassword("teatro123"),
      whatsappPhone: null,
      role: "ministry",
      ministryId: teatro.id,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
