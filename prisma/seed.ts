import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const ministrySeeds = [
  { name: "Teatro", username: "teatro" },
  { name: "Acroarte", username: "acroarte" },
  { name: "Apoio Técnico", username: "apoio_tecnico" },
  { name: "Balé", username: "bale" },
  { name: "Dança 1", username: "danca_1" },
  { name: "DNA", username: "dna" },
  { name: "Fantoche", username: "fantoche" },
  { name: "Orquestra", username: "orquestra" },
  { name: "Palco Artístico", username: "palco_artistico" },
  { name: "Pantomima", username: "pantomima" },
  { name: "Patins", username: "patins" },
  { name: "Percussão", username: "percussao" },
  { name: "Recepção", username: "recepcao" },
  { name: "Tecnologia", username: "tecnologia" },
  { name: "Banda NJ", username: "banda_nj" },
  { name: "Banda", username: "banda" },
  { name: "Dança 2", username: "danca_2" },
  { name: "Alpha", username: "alpha" },
  { name: "Bravo", username: "bravo" },
  { name: "Charlie", username: "charlie" },
] as const;

async function main() {
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

  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: "seed-ministry-user-louvor" },
        { username: "louvor" },
      ],
    },
  });

  await prisma.ministry.deleteMany({
    where: {
      name: "Louvor",
      users: {
        none: {},
      },
      bookingRequests: {
        none: {},
      },
    },
  });

  for (const ministrySeed of ministrySeeds) {
    const ministry = await prisma.ministry.upsert({
      where: { name: ministrySeed.name },
      update: {},
      create: { name: ministrySeed.name },
    });

    await prisma.user.upsert({
      where: { id: `seed-ministry-user-${ministrySeed.username}` },
      update: {
        name: `Líder ${ministrySeed.name}`,
        username: ministrySeed.username,
        passwordHash: hashPassword(ministrySeed.username),
        whatsappPhone: null,
        role: "ministry",
        ministryId: ministry.id,
      },
      create: {
        id: `seed-ministry-user-${ministrySeed.username}`,
        name: `Líder ${ministrySeed.name}`,
        username: ministrySeed.username,
        passwordHash: hashPassword(ministrySeed.username),
        whatsappPhone: null,
        role: "ministry",
        ministryId: ministry.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
