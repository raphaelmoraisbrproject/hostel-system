import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://endlhaycuxqdixrlzhyc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZGxoYXljdXhxZGl4cmx6aHljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk0NDAwMiwiZXhwIjoyMDgxNTIwMDAyfQ.2q1acUUq5VuEMCDmVDKlA0mcXb8n0K8PwPsn1z2rLYc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running user_invites migration...\n');

  // 1. Create table
  console.log('1. Creating user_invites table...');
  const { error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS user_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'volunteer')) DEFAULT 'employee',
        token UUID NOT NULL DEFAULT gen_random_uuid(),
        invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
        used_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(email),
        UNIQUE(token)
      )
    `
  });

  if (tableError && !tableError.message?.includes('already exists')) {
    // Try direct SQL via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        sql: `CREATE TABLE IF NOT EXISTS user_invites (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'volunteer')) DEFAULT 'employee',
          token UUID NOT NULL DEFAULT gen_random_uuid(),
          invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
          expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
          used_at TIMESTAMPTZ DEFAULT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(email),
          UNIQUE(token)
        )`
      })
    });

    if (!response.ok) {
      console.log('   Note: Cannot execute DDL via API. Please run the SQL manually in Supabase Dashboard.');
      console.log('   File: supabase_migration_invites.sql');
      console.log('\n   Steps:');
      console.log('   1. Go to https://supabase.com/dashboard/project/endlhaycuxqdixrlzhyc/sql');
      console.log('   2. Copy and paste the contents of supabase_migration_invites.sql');
      console.log('   3. Click "Run"');
      return;
    }
  }

  console.log('   ✓ Table created or already exists');

  // Verify
  const { data, error } = await supabase
    .from('user_invites')
    .select('id')
    .limit(1);

  if (error) {
    console.log('\n❌ Verification failed:', error.message);
    console.log('\nPlease run the migration manually in Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/endlhaycuxqdixrlzhyc/sql');
    console.log('2. Copy and paste the contents of supabase_migration_invites.sql');
    console.log('3. Click "Run"');
  } else {
    console.log('\n✅ Migration verified! Table user_invites is accessible.');
  }
}

runMigration().catch(console.error);
