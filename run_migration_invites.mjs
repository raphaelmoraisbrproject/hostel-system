import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

// Supabase Transaction pooler connection
const client = new Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.endlhaycuxqdixrlzhyc',
  password: '#dslk#$%lj3JN3lkj.m,e',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected!');

    const sqlFile = path.join(__dirname, 'supabase_migration_invites.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by statements and execute one by one
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} statements to execute...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length < 5) continue;

      try {
        await client.query(stmt);
        process.stdout.write('.');
      } catch (err) {
        if (err.message.includes('already exists') ||
            err.message.includes('does not exist') ||
            err.message.includes('duplicate key')) {
          process.stdout.write('s');
        } else {
          console.error(`\nError in statement ${i + 1}:`, err.message);
          console.error('Statement:', stmt.substring(0, 100) + '...');
        }
      }
    }

    console.log('\n\nMigration completed!');

    // Verify
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_invites'
    `);

    if (result.rows.length > 0) {
      console.log('\n✓ Table user_invites created successfully!');
    }

    const funcs = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('validate_invite_token', 'mark_invite_as_used', 'cleanup_expired_invites')
    `);

    console.log('\nCreated functions:');
    funcs.rows.forEach(row => console.log('  ✓', row.routine_name));

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
