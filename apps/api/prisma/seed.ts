// ============================================
// 🌱 Seed — Construction SaaS demo data
// Idempotent: safe to run multiple times.
//
// Prereq: the two Supabase Auth users must already exist (created via the
// Auth admin API). Their auth ids are referenced below as `supabaseAuthId`.
//   admin@demo.com  -> 10ac109f-10a9-4622-b793-561a4553999f
//   client@demo.com -> de747a5c-b271-4fff-823b-2dc9329da027
// ============================================
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 client engine requires a driver adapter (same as the app's
// PrismaService). Point it at DATABASE_URL loaded above via dotenv.
const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });

// Fixed ids so re-running upserts cleanly instead of duplicating rows.
const COMPANY_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_USER_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_USER_ID = '33333333-3333-3333-3333-333333333333';
const PROJECT_ID = '44444444-4444-4444-4444-444444444444';
const PHASE_ID = '55555555-5555-5555-5555-555555555555';
const UPDATE_ID = '66666666-6666-6666-6666-666666666666';

const ADMIN_AUTH_ID = '10ac109f-10a9-4622-b793-561a4553999f';
const CLIENT_AUTH_ID = 'de747a5c-b271-4fff-823b-2dc9329da027';

async function main() {
  // 1. Company
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      name: 'شركة الإنشاءات المتحدة',
      slug: 'united-construction',
      email: 'info@united-construction.com',
      phone: '+201000000000',
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
    },
  });
  console.log(`✅ Company: ${company.name} (${company.id})`);

  // 2. Users — key off the unique supabaseAuthId.
  const admin = await prisma.user.upsert({
    where: { supabaseAuthId: ADMIN_AUTH_ID },
    update: { role: 'SUPER_ADMIN', isActive: true },
    create: {
      id: ADMIN_USER_ID,
      companyId: company.id,
      supabaseAuthId: ADMIN_AUTH_ID,
      name: 'مدير النظام',
      email: 'admin@demo.com',
      role: 'SUPER_ADMIN',
      preferredLanguage: 'AR',
      isActive: true,
    },
  });
  console.log(`✅ User (SUPER_ADMIN): ${admin.email} (${admin.id})`);

  const client = await prisma.user.upsert({
    where: { supabaseAuthId: CLIENT_AUTH_ID },
    update: { role: 'CLIENT', isActive: true },
    create: {
      id: CLIENT_USER_ID,
      companyId: company.id,
      supabaseAuthId: CLIENT_AUTH_ID,
      name: 'العميل',
      email: 'client@demo.com',
      role: 'CLIENT',
      preferredLanguage: 'AR',
      isActive: true,
    },
  });
  console.log(`✅ User (CLIENT): ${client.email} (${client.id})`);

  // 3. Project
  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: { status: 'IN_PROGRESS' },
    create: {
      id: PROJECT_ID,
      companyId: company.id,
      clientId: client.id,
      name: 'عمارة 4 شقق - القاهرة الجديدة',
      description: 'مشروع إنشاء عمارة سكنية مكوّنة من 4 شقق.',
      location: 'القاهرة الجديدة',
      type: 'CONSTRUCTION',
      status: 'IN_PROGRESS',
      totalBudget: 5_000_000,
      overallProgress: 10,
    },
  });
  console.log(`✅ Project: ${project.name} (${project.id})`);

  // 4. Phase
  const phase = await prisma.phase.upsert({
    where: { id: PHASE_ID },
    update: {},
    create: {
      id: PHASE_ID,
      projectId: project.id,
      name: 'أعمال الهيكل الإنشائي',
      order: 0,
      weight: 1,
      status: 'IN_PROGRESS',
      progress: 10,
      budget: 2_000_000,
    },
  });
  console.log(`✅ Phase: ${phase.name} (${phase.id})`);

  // 5. Approved update
  const now = new Date();
  const update = await prisma.update.upsert({
    where: { id: UPDATE_ID },
    update: { status: 'APPROVED' },
    create: {
      id: UPDATE_ID,
      phaseId: phase.id,
      submittedBy: admin.id,
      reviewedBy: admin.id,
      title: 'خلصنا صب الأساس',
      description: 'تم الانتهاء من صب أساسات المبنى بالكامل.',
      workDone: 'صب الأساس الخرساني للمبنى.',
      progressIncrement: 10,
      cost: 50_000,
      status: 'APPROVED',
      submittedAt: now,
      reviewedAt: now,
    },
  });
  console.log(`✅ Update: ${update.title} (${update.status})`);

  console.log('\n🌱 Seed completed successfully.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
