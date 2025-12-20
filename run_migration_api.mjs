import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_TOKEN = 'sbp_06d09a27b459a4240445afb1a69aa2b4dd2a33ff';
const PROJECT_REF = 'endlhaycuxqdixrlzhyc';

async function executeSQL(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function runMigration() {
  try {
    console.log('Starting migration...\n');

    const sqlFile = path.join(__dirname, 'supabase_migration_operations.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by major sections (each CREATE TABLE or significant block)
    const sections = sql.split(/-- =+\n-- \d+\./);

    console.log(`Found ${sections.length} sections to execute...\n`);

    // Execute each section
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section || section.length < 10) continue;

      // Get section name from first comment
      const nameMatch = section.match(/^([A-Z_\s]+)\n/);
      const sectionName = nameMatch ? nameMatch[1].trim() : `Section ${i}`;

      try {
        // Split section into individual statements
        const statements = section
          .split(/;\s*\n/)
          .map(s => s.trim())
          .filter(s => s.length > 5 && !s.startsWith('--'));

        for (const stmt of statements) {
          if (stmt.length < 10) continue;

          try {
            await executeSQL(stmt + ';');
            process.stdout.write('.');
          } catch (err) {
            if (err.message.includes('already exists') ||
                err.message.includes('duplicate key') ||
                err.message.includes('does not exist')) {
              process.stdout.write('s');
            } else {
              console.error(`\n  Error: ${err.message.substring(0, 100)}`);
            }
          }
        }
        console.log(` ${sectionName.substring(0, 30)}`);
      } catch (err) {
        console.error(`\nSection ${i} error:`, err.message);
      }
    }

    console.log('\n\nVerifying created tables...');

    const result = await executeSQL(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'role_permissions', 'areas', 'checklist_templates', 'tasks', 'laundry_items', 'laundry_cycles', 'activity_log')
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    result.forEach(row => console.log('  ✓', row.table_name));

    console.log('\n✅ Migration completed!');

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
