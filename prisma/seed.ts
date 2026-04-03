import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const clinic = await prisma.clinic.upsert({
    where: { kommoSubdomain: "clinicaalexiaduarte" },
    update: {
      name: "AD Clínica",
      kommoToken: process.env.KOMMO_TOKEN!,
      clinicorpUser: process.env.CLINICORP_USER!,
      clinicorpToken: process.env.CLINICORP_TOKEN!,
      clinicorpBusinessId: process.env.CLINICORP_BUSINESS_ID!,
      pipelineId: "10755863",
      stageAgendamento: "82505867",
    },
    create: {
      name: "AD Clínica",
      kommoSubdomain: "clinicaalexiaduarte",
      kommoToken: process.env.KOMMO_TOKEN!,
      clinicorpUser: process.env.CLINICORP_USER!,
      clinicorpToken: process.env.CLINICORP_TOKEN!,
      clinicorpBusinessId: process.env.CLINICORP_BUSINESS_ID!,
      pipelineId: "10755863",
      stageAgendamento: "82505867",
    },
  });

  console.log("✅ Clinic seeded:", clinic.id, clinic.name);

  // Seed admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@clinifunnel.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, clinicId: clinic.id },
    create: {
      email: adminEmail,
      passwordHash,
      name: "Admin",
      clinicId: clinic.id,
    },
  });

  console.log("✅ Admin user seeded:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
