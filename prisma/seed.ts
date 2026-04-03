import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Clinic
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

  // 2. Admin user
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

  // 3. Dados fictícios para teste
  const existingLeads = await prisma.lead.count({ where: { clinicId: clinic.id } });
  if (existingLeads > 0) {
    console.log(`⏭️  Já existem ${existingLeads} leads, pulando dados fictícios`);
    return;
  }

  console.log("📊 Criando dados fictícios...");

  const campaigns = [
    { source: "facebook", medium: "cpc", campaign: "implantes-2026" },
    { source: "google", medium: "cpc", campaign: "clareamento-abril" },
    { source: "instagram", medium: "social", campaign: "harmonizacao-facial" },
    { source: "facebook", medium: "cpc", campaign: "lentes-contato" },
  ];

  const nomes = [
    "Maria Silva", "João Santos", "Ana Oliveira", "Pedro Costa",
    "Carla Souza", "Lucas Ferreira", "Juliana Lima", "Rafael Almeida",
    "Fernanda Gomes", "Bruno Ribeiro", "Patricia Martins", "Thiago Pereira",
    "Camila Rodrigues", "Diego Nascimento", "Leticia Barbosa", "Marcelo Araujo",
    "Aline Cardoso", "Felipe Mendes", "Vanessa Correia", "Gabriel Rocha",
    "Renata Nunes", "Anderson Vieira", "Bianca Moreira", "Eduardo Teixeira",
    "Larissa Dias", "Roberto Cavalcanti", "Isabela Pinto", "Gustavo Monteiro",
    "Priscila Azevedo", "Daniel Campos",
  ];

  const procedureNames = [
    "Implante dentário", "Clareamento dental", "Harmonização facial",
    "Lente de contato dental", "Canal", "Prótese fixa",
    "Faceta de porcelana", "Ortodontia", "Extração siso",
  ];

  const now = new Date();
  const leads = [];
  const patients = [];

  for (let i = 0; i < 30; i++) {
    const isCampaign = i < 22; // 22 de campanha, 8 orgânicos
    const camp = isCampaign ? campaigns[i % campaigns.length] : null;
    const daysAgo = Math.floor(Math.random() * 60); // últimos 60 dias
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const hasAgendamento = Math.random() < 0.55; // 55% agenda
    const agendamentoAt = hasAgendamento
      ? new Date(createdAt.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000)
      : null;

    const phone = `+5511${String(900000000 + Math.floor(Math.random() * 99999999)).slice(0, 9)}`;

    const lead = await prisma.lead.create({
      data: {
        clinicId: clinic.id,
        kommoLeadId: String(100000 + i),
        name: nomes[i],
        phone,
        email: `${nomes[i].toLowerCase().replace(/ /g, ".")}@email.com`,
        channel: isCampaign ? "campaign" : "organic",
        utmSource: camp?.source ?? null,
        utmMedium: camp?.medium ?? null,
        utmCampaign: camp?.campaign ?? null,
        kommoStatus: hasAgendamento ? "Agendado" : "Novo",
        kommoPipelineId: "10755863",
        kommoCreatedAt: createdAt,
        agendamentoAt,
        createdAt,
      },
    });
    leads.push(lead);

    // Criar paciente para quem agendou
    if (hasAgendamento) {
      const patient = await prisma.patient.create({
        data: {
          clinicId: clinic.id,
          clinicorpPatientId: String(200000 + i),
          name: nomes[i],
          phone,
          utmSource: camp?.source ?? null,
          utmMedium: camp?.medium ?? null,
          utmCampaign: camp?.campaign ?? null,
        },
      });
      patients.push(patient);

      // Vincular lead ao paciente
      await prisma.lead.update({
        where: { id: lead.id },
        data: { patientId: patient.id },
      });

      // Criar procedimento para ~70% dos pacientes
      if (Math.random() < 0.7) {
        const procName = procedureNames[Math.floor(Math.random() * procedureNames.length)];
        const value = Math.floor(1500 + Math.random() * 8500); // R$ 1.500 a R$ 10.000
        const statuses = ["completed", "approved", "pending", "cancelled"];
        const weights = [0.4, 0.25, 0.25, 0.1];
        const rand = Math.random();
        let statusIdx = 0;
        let cumulative = 0;
        for (let j = 0; j < weights.length; j++) {
          cumulative += weights[j];
          if (rand < cumulative) { statusIdx = j; break; }
        }
        const status = statuses[statusIdx];

        await prisma.procedure.create({
          data: {
            clinicId: clinic.id,
            patientId: patient.id,
            clinicorpProcedureId: String(300000 + i),
            name: procName,
            value,
            status,
            completedAt: status === "completed"
              ? new Date(agendamentoAt!.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000)
              : null,
            createdAt: agendamentoAt!,
          },
        });
      }
    }
  }

  // Webhook logs fictícios
  await prisma.webhookLog.createMany({
    data: [
      { source: "kommo", event: "leads[add]", payload: { leads: { add: [{ id: "100000" }] } }, status: "processed" },
      { source: "kommo", event: "leads[status]", payload: { leads: { status: [{ id: "100001", status_id: 82505867 }] } }, status: "processed" },
      { source: "kommo", event: "leads[add]", payload: { leads: { add: [{ id: "100005" }] } }, status: "processed" },
      { source: "clinicorp", event: "procedure.created", payload: { procedureId: "300000", patientId: "200000", name: "Implante dentário", value: 5000 }, status: "processed" },
      { source: "clinicorp", event: "appointment.confirmed", payload: { patientId: "200003", date: "2026-04-10" }, status: "processed" },
      { source: "clinicorp", event: "unknown", payload: { test: true }, status: "error", error: "Webhook processing disabled" },
    ],
  });

  const leadCount = await prisma.lead.count({ where: { clinicId: clinic.id } });
  const patientCount = await prisma.patient.count({ where: { clinicId: clinic.id } });
  const procedureCount = await prisma.procedure.count({ where: { clinicId: clinic.id } });

  console.log(`✅ ${leadCount} leads criados`);
  console.log(`✅ ${patientCount} pacientes criados`);
  console.log(`✅ ${procedureCount} procedimentos criados`);
  console.log(`✅ 6 webhook logs criados`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
