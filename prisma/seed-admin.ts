import dotenv from 'dotenv';
dotenv.config();
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, 64, (error, derived) => error ? reject(error) : resolve(derived)),
  );
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function main() {
  const productionBootstrap = process.argv.includes('--production-bootstrap');
  if (process.env.NODE_ENV === 'production') {
    if (!productionBootstrap || process.env.ALLOW_PRODUCTION_ADMIN_BOOTSTRAP !== 'true') {
      throw new Error('Production bootstrap refused. Use the explicit db:bootstrap:admin command with its one-time confirmation.');
    }
  } else if (productionBootstrap || process.env.ALLOW_ADMIN_SEED !== 'true') {
    throw new Error('Development admin seed refused. Set ALLOW_ADMIN_SEED=true only for a verified non-production database.');
  }
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const confirmation = process.env.ADMIN_SEED_CONFIRMATION?.trim().toLowerCase();
  const name = process.env.ADMIN_SEED_NAME?.trim() || 'Platform Administrator';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_SEED_EMAIL to the administrator email.');
  if (!password || password.length < 12) throw new Error('Set ADMIN_SEED_PASSWORD to a password with at least 12 characters.');
  if (confirmation !== email) throw new Error('Set ADMIN_SEED_CONFIRMATION to the same email to confirm the bootstrap account.');

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, roles: true } });
  if (existing) {
    if (existing.roles.includes(Role.SUPER_ADMIN) || existing.roles.includes(Role.ADMIN)) {
      console.log(`Administrator ${email} already exists; no credentials or roles were changed.`);
      return;
    }
    throw new Error('That email already belongs to a non-administrator account. No account was changed.');
  }

  const passwordHash = await hashPassword(password);
  try {
    const admin = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { email, name, passwordHash, roles: [Role.SUPER_ADMIN], isDemo: false } });
      await tx.auditLog.create({
        data: {
          actorId: created.id,
          action: 'ADMIN_ACCOUNT_BOOTSTRAPPED',
          targetType: 'User',
          targetId: created.id,
          metadata: { roles: [Role.SUPER_ADMIN], reason: 'Initial administrator bootstrap' },
          isDemo: false,
        },
      });
      return created;
    });
    console.log(`Super administrator ${admin.email} created. Sign in through the admin application.`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('An account with that email was created concurrently. No existing account was changed.');
    }
    throw error;
  }
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Admin seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
