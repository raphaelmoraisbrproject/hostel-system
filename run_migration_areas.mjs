import { readFileSync } from 'fs';

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_ID = 'endlhaycuxqdixrlzhyc';

async function runMigration() {
  const sql = readFileSync('./supabase_migration_areas.sql', 'utf8');

  console.log('Running areas migration...');

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error('Migration failed:', result);
    process.exit(1);
  }

  console.log('Migration completed successfully!');
  console.log('Result:', JSON.stringify(result, null, 2));
}

runMigration().catch(console.error);
