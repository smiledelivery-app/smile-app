// Truncate all application records in the public schema while preserving tables and _prisma_migrations.
import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function main() {
  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    throw new Error(
      'Refused: pass --confirm to delete all records from the database (e.g. pnpm db:clear -- --confirm).',
    );
  }

  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
    throw new Error(
      'Refused in production: pass --allow-production alongside --confirm if you intentionally want to wipe a production database.',
    );
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename ASC
  `;

  if (tables.length === 0) {
    console.log('No application tables found in public schema.');
    return;
  }

  const qualifiedTables = tables
    .map(({ tablename }) => `"public".${quoteIdentifier(tablename)}`)
    .join(', ');

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`);

  console.log(`Cleared all records from ${tables.length} tables (preserved _prisma_migrations).`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : 'Database clear failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
