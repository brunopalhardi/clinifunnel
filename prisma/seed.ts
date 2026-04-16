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

  console.log("✅ Clinic:", clinic.id, clinic.name);

  // Admin (super admin)
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@clinifunnel.com" },
    update: { passwordHash: adminHash, clinicId: clinic.id },
    create: {
      email: process.env.ADMIN_EMAIL || "admin@clinifunnel.com",
      passwordHash: adminHash,
      name: "Admin",
      clinicId: clinic.id,
    },
  });
  console.log("✅ Admin:", admin.email);

  // Sergio (AD Clínica)
  const sergioHash = await bcrypt.hash("Sucesso@2026", 10);
  const sergio = await prisma.user.upsert({
    where: { email: "sergio@clinicaad.com.br" },
    update: { passwordHash: sergioHash, clinicId: clinic.id },
    create: {
      email: "sergio@clinicaad.com.br",
      passwordHash: sergioHash,
      name: "Sergio",
      clinicId: clinic.id,
    },
  });
  console.log("✅ Sergio:", sergio.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
