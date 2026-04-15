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

  // Seed Sergio user
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

  console.log("✅ Sergio user seeded:", sergio.email);

  // Seed leads com UTMs de campanha
  const campaignNames = [
    "implante_sp_maio",
    "clareamento_promo",
    "ortodontia_invisalign",
    "check-up_familia",
    "facetas_premium",
  ];

  const leadData = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const isCampaign = i < 22;
    const campaign = isCampaign
      ? campaignNames[i % campaignNames.length]
      : undefined;
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const hasAgendamento = Math.random() < 0.55;

    leadData.push({
      clinicId: clinic.id,
      kommoLeadId: `seed-${i + 1}`,
      name: `Lead Teste ${i + 1}`,
      phone: `1199${String(i).padStart(7, "0")}`,
      email: `lead${i + 1}@teste.com`,
      channel: isCampaign ? "campaign" : "organic",
      utmSource: isCampaign ? (i % 2 === 0 ? "facebook" : "google") : undefined,
      utmMedium: isCampaign ? "cpc" : undefined,
      utmCampaign: campaign,
      kommoCreatedAt: createdAt,
      agendamentoAt: hasAgendamento
        ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000)
        : undefined,
      createdAt,
    });
  }

  for (const ld of leadData) {
    await prisma.lead.upsert({
      where: {
        clinicId_kommoLeadId: { clinicId: clinic.id, kommoLeadId: ld.kommoLeadId },
      },
      update: {},
      create: ld,
    });
  }

  console.log("✅ 30 leads seeded");

  // Seed patients
  const patients = [];
  for (let i = 0; i < 14; i++) {
    const p = await prisma.patient.upsert({
      where: {
        clinicId_clinicorpPatientId: {
          clinicId: clinic.id,
          clinicorpPatientId: `seed-patient-${i + 1}`,
        },
      },
      update: {},
      create: {
        clinicId: clinic.id,
        clinicorpPatientId: `seed-patient-${i + 1}`,
        name: `Paciente ${i + 1}`,
        phone: `1198${String(i).padStart(7, "0")}`,
        utmSource: i % 2 === 0 ? "facebook" : "google",
        utmCampaign: campaignNames[i % campaignNames.length],
      },
    });
    patients.push(p);
  }

  console.log("✅ 14 patients seeded");

  // Link some leads to patients
  const allLeads = await prisma.lead.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: "asc" },
  });

  for (let i = 0; i < Math.min(patients.length, allLeads.length); i++) {
    await prisma.lead.update({
      where: { id: allLeads[i].id },
      data: { patientId: patients[i].id },
    });
  }

  // Seed procedures
  const procedureNames = [
    "Implante Dentario",
    "Clareamento a Laser",
    "Ortodontia Invisalign",
    "Facetas de Porcelana",
    "Limpeza + Check-up",
    "Extracao de Siso",
    "Protese Fixa",
  ];

  const statuses = ["completed", "completed", "completed", "completed", "approved", "approved", "pending", "pending", "pending", "cancelled"];

  for (let i = 0; i < 11; i++) {
    const patient = patients[i % patients.length];
    const daysAgo = Math.floor(Math.random() * 25);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const status = statuses[i % statuses.length];
    const value = 1500 + Math.floor(Math.random() * 8500);

    await prisma.procedure.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        clinicorpProcedureId: `seed-proc-${i + 1}`,
        name: procedureNames[i % procedureNames.length],
        value,
        status,
        completedAt: status === "completed" ? createdAt : undefined,
        createdAt,
      },
    });
  }

  console.log("✅ 11 procedures seeded");

  // Seed AdCampaignData (dados fictícios de Meta e Google Ads)
  for (const campaignName of campaignNames) {
    const platform = campaignName.includes("implante") || campaignName.includes("facetas")
      ? "meta"
      : "google";

    for (let d = 0; d < 30; d++) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      const impressions = 200 + Math.floor(Math.random() * 800);
      const clicks = Math.floor(impressions * (0.02 + Math.random() * 0.05));
      const spend = 30 + Math.floor(Math.random() * 120);

      await prisma.adCampaignData.upsert({
        where: {
          clinicId_platform_campaignId_date: {
            clinicId: clinic.id,
            platform,
            campaignId: `seed-${campaignName}`,
            date,
          },
        },
        update: { impressions, clicks, spend },
        create: {
          clinicId: clinic.id,
          platform,
          campaignId: `seed-${campaignName}`,
          campaignName: campaignName,
          date,
          impressions,
          clicks,
          spend,
        },
      });
    }
  }

  console.log("✅ AdCampaignData seeded (5 campaigns x 30 days)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
