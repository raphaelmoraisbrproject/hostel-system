import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const client = new Client({
  host: 'aws-0-sa-east-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.endlhaycuxqdixrlzhyc',
  password: '#dslk#$%lj3JN3lkj.m,e',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected!');

    const sqlFile = path.join(__dirname, 'supabase_migration_operations.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by statements and execute one by one for better error handling
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
        // Ignore some common harmless errors
        if (err.message.includes('already exists') ||
            err.message.includes('does not exist') ||
            err.message.includes('duplicate key')) {
          process.stdout.write('s'); // skipped
        } else {
          console.error(`\nError in statement ${i + 1}:`, err.message);
          console.error('Statement:', stmt.substring(0, 100) + '...');
        }
      }
    }

    console.log('\n\nMigration completed!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'role_permissions', 'areas', 'checklist_templates', 'tasks', 'laundry_items', 'laundry_cycles', 'activity_log')
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    result.rows.forEach(row => console.log('  ✓', row.table_name));

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
