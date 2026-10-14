import fs from 'node:fs';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchCandidate, getJobAccurateRate } from './matching-engine-v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'referrals.db');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wajjvsbkgbuyjkdsnhmc.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamp2c2JrZ2J1eWprZHNuaG1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk3ODMyMSwiZXhwIjoyMTA3NTU0MzIxfQ.jqzV2bWyqOwPlMk7x1RneX-Noi9ap1huC5YDuGRhY9M';

const db = new DatabaseSync(dbPath);

async function run() {
  console.log('🔄 Loading all jobs from SQLite...');
  const jobs = db.prepare('SELECT job_id, job_name, referral_reward_amount, no_of_openings, location, ideal_hourly_rate_min, ideal_hourly_rate_max, referral_url FROM jobs').all();
  console.log(`Loaded ${jobs.length} jobs.`);

  // Build rateMap with accurate USD rates
  const rateMap = new Map();
  jobs.forEach(j => {
    rateMap.set(j.job_id, getJobAccurateRate(j));
  });

  // Preserve any existing contacted/vouched connections
  console.log('🔍 Checking existing connections for contacted/vouched statuses...');
  const existingStatuses = new Map();
  try {
    const rows = db.prepare('SELECT linkedin_url, full_name, status, notes, matched_jobs FROM connections WHERE status LIKE "%Intro Sent%" OR status LIKE "%Vouched%"').all();
    for (const r of rows) {
      const key = r.linkedin_url || r.full_name;
      existingStatuses.set(key, r);
    }
    console.log(`Found ${existingStatuses.size} preserved connections with active outreach/vouch.`);
  } catch (e) {
    console.log('No prior preserved statuses found.');
  }

  console.log('📖 Reading Connections.csv with Matching Engine v2.0...');
  const fileStream = fs.createReadStream('Connections.csv');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headerPassed = false;
  let count = 0;
  let matchedCount = 0;

  const processedConnections = [];

  for await (const line of rl) {
    if (line.includes('First Name,Last Name')) {
      headerPassed = true;
      continue;
    }
    if (!headerPassed || !line.trim()) continue;

    count++;

    const matches = line.match(/(?:^|,)(?:\"([^\"]*)\"|([^,]*))/g);
    if (!matches || matches.length < 6) continue;

    const clean = matches.map(m => m.replace(/^,/, '').replace(/^\"|\"$/g, '').trim());
    const firstName = clean[0] || '';
    const lastName = clean[1] || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const url = clean[2] || '';
    const email = clean[3] || '';
    const company = clean[4] || '';
    const position = clean[5] || '';
    const connectedOn = clean[6] || '';

    // Check if this connection was already contacted/vouched
    const key = url || fullName;
    const preserved = existingStatuses.get(key);

    let matchedJobsList = [];
    let maxReward = 0;
    let status = 'New';
    let notes = null;

    if (preserved) {
      status = preserved.status;
      notes = preserved.notes;
      try {
        matchedJobsList = JSON.parse(preserved.matched_jobs || '[]');
        maxReward = matchedJobsList.length > 0 ? (matchedJobsList[0].reward || 0) : 0;
      } catch (e) {
        matchedJobsList = [];
      }
    } else {
      // Run Matching Engine v2.0
      const candidateObj = { position, company, first_name: firstName, last_name: lastName, full_name: fullName };
      const matchResult = matchCandidate(candidateObj, jobs, rateMap);

      if (matchResult.topMatch) {
        // Embed runner-ups inside topMatch so json_array_length(matched_jobs) is strictly 1
        const top = {
          ...matchResult.topMatch,
          runner_ups: matchResult.runnerUps || []
        };
        matchedJobsList = [top];
        maxReward = top.reward || 0;
      }
    }

    if (matchedJobsList.length > 0) matchedCount++;

    processedConnections.push({
      id: count,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      linkedin_url: url,
      email: email,
      company: company,
      position: position,
      connected_on: connectedOn,
      matched_jobs: matchedJobsList,
      match_count: matchedJobsList.length,
      max_potential_earnings: maxReward,
      status: status,
      notes: notes,
      created_at: new Date().toISOString()
    });
  }

  console.log(`✅ Processed ${count} total connections from CSV.`);
  console.log(`🎯 Matched Connections (v2.0): ${matchedCount} (${((matchedCount / count) * 100).toFixed(1)}%)!`);

  // Update SQLite
  console.log('💾 Updating SQLite database referrals.db with v2.0 matches...');
  db.exec('BEGIN TRANSACTION;');
  db.exec('DELETE FROM connections;');
  const stmt = db.prepare(`
    INSERT INTO connections (
      id, first_name, last_name, full_name, linkedin_url, email,
      company, position, connected_on, matched_jobs, match_count, max_potential_earnings, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of processedConnections) {
    stmt.run(
      c.id,
      c.first_name,
      c.last_name,
      c.full_name,
      c.linkedin_url,
      c.email,
      c.company,
      c.position,
      c.connected_on,
      JSON.stringify(c.matched_jobs),
      c.match_count,
      c.max_potential_earnings,
      c.status,
      c.notes
    );
  }
  db.exec('COMMIT;');
  console.log('✅ SQLite updated successfully with v2.0 engine!');

  return { total: count, matched: matchedCount };
}

run().catch(console.error);
