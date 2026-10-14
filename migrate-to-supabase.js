import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'referrals.db');

const SUPABASE_URL = 'https://wajjvsbkgbuyjkdsnhmc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamp2c2JrZ2J1eWprZHNuaG1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk3ODMyMSwiZXhwIjoyMTA3NTU0MzIxfQ.jqzV2bWyqOwPlMk7x1RneX-Noi9ap1huC5YDuGRhY9M';

const db = new DatabaseSync(dbPath);

async function postBatch(endpoint, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to insert batch into ${endpoint} (HTTP ${res.status}): ${text}`);
  }
}

async function run() {
  console.log('🚀 Starting migration from referrals.db to Supabase...');

  // 1. Migrate Jobs
  console.log('📦 Migrating jobs...');
  const jobs = db.prepare('SELECT * FROM jobs').all();
  const formattedJobs = jobs.map(j => ({
    job_id: j.job_id,
    job_name: j.job_name,
    referral_reward_amount: j.referral_reward_amount || 0,
    no_of_openings: j.no_of_openings || 0,
    ideal_hourly_rate_min: j.ideal_hourly_rate_min,
    ideal_hourly_rate_max: j.ideal_hourly_rate_max,
    skills: j.skills ? JSON.parse(j.skills) : [],
    is_high_demand: j.is_high_demand ? 1 : 0,
    referral_url: j.referral_url,
    job_description: j.job_description,
    location: j.location || 'Remote (Global)',
    date_posted: j.date_posted
  }));

  // Insert in batches of 100
  for (let i = 0; i < formattedJobs.length; i += 100) {
    const chunk = formattedJobs.slice(i, i + 100);
    await postBatch('jobs', chunk);
    console.log(`  Synced ${Math.min(i + 100, formattedJobs.length)}/${formattedJobs.length} jobs`);
  }
  console.log('✅ Jobs migrated successfully!');

  // 2. Migrate Connections
  console.log('👥 Migrating connections...');
  const conns = db.prepare('SELECT * FROM connections').all();
  const formattedConns = conns.map(c => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    full_name: c.full_name,
    linkedin_url: c.linkedin_url,
    email: c.email,
    company: c.company,
    position: c.position,
    connected_on: c.connected_on,
    matched_jobs: c.matched_jobs ? JSON.parse(c.matched_jobs) : [],
    match_count: c.match_count || 0,
    max_potential_earnings: c.max_potential_earnings || 0,
    status: c.status || 'New',
    notes: c.notes,
    created_at: c.created_at || new Date().toISOString()
  }));

  // Insert in batches of 500
  for (let i = 0; i < formattedConns.length; i += 500) {
    const chunk = formattedConns.slice(i, i + 500);
    await postBatch('connections', chunk);
    console.log(`  Synced ${Math.min(i + 500, formattedConns.length)}/${formattedConns.length} connections`);
  }
  console.log('✅ Connections migrated successfully!');
  console.log('🎉 Migration to Supabase Complete!');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
