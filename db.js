import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'referrals.db');

export const db = new DatabaseSync(dbPath);

export function parseLocation(html, jobName) {
  if (!html) return 'Remote (Global)';

  const ptMatch = html.match(/Localiza[cç][aã]o\s*:?\s*<\/strong>\s*([^<]+)/i) || html.match(/Localiza[cç][aã]o\s*:\s*([^<]+)/i);
  if (ptMatch && ptMatch[1].trim()) {
    return 'Latin America & Caribbean (Remote)';
  }

  const m1 = html.match(/Location\s*:\s*<\/strong>\s*([^<]+)/i);
  if (m1 && m1[1].trim()) return cleanLoc(m1[1]);

  const m2 = html.match(/Location\s*:\s*([^<]+)/i);
  if (m2 && m2[1].trim()) return cleanLoc(m2[1]);

  const m3 = html.match(/Location\s*<\/strong>\s*:\s*([^<]+)/i);
  if (m3 && m3[1].trim()) return cleanLoc(m3[1]);

  const m4 = html.match(/<strong>\s*Location\s*:\s*([^<]+)<\/strong>/i);
  if (m4 && m4[1].trim()) return cleanLoc(m4[1]);

  const titleMatch = (jobName || '').match(/\(([^)]*(?:based|only|remote|usa|us)[^)]*)\)/i);
  if (titleMatch) return cleanLoc(titleMatch[1].trim());

  const plain = html.replace(/<[^>]+>/g, ' ');
  if (/Remote\s*-\s*US\s*ONLY/i.test(plain)) return 'Remote (US Only)';
  if (/anywhere in the world/i.test(plain)) return 'Remote (Global / Worldwide)';
  if (/remote/i.test(plain)) return 'Remote (Global)';

  return 'Remote (Global)';
}

function cleanLoc(loc) {
  let l = loc.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  l = l.replace(/\s*(?:The Role|Opportunity Snapshot|Job Summary|micro1|Schedule|Time Commitment).*$/i, '');
  l = l.replace(/^[-\s:,.]+|[-\s:,.]+$/g, '');
  if (!l || l.toLowerCase() === 'remote') return 'Remote (Global)';
  if (/^u\.?s\.?\s*based$/i.test(l)) return 'Remote (US Based)';
  if (/^united state(s)?$/i.test(l)) return 'Remote (US Only)';
  return l;
}

// Initialize schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      job_name TEXT NOT NULL,
      referral_reward_amount REAL DEFAULT 0,
      no_of_openings INTEGER DEFAULT 0,
      ideal_hourly_rate_min REAL,
      ideal_hourly_rate_max REAL,
      skills TEXT,
      is_high_demand INTEGER DEFAULT 0,
      referral_url TEXT NOT NULL,
      job_description TEXT,
      location TEXT DEFAULT 'Remote (Global)',
      date_posted TEXT,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candidate_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT,
      job_name TEXT,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT,
      candidate_linkedin TEXT,
      status TEXT DEFAULT 'Contacted',
      reward_amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_reward ON jobs(referral_reward_amount);
    CREATE INDEX IF NOT EXISTS idx_jobs_high_demand ON jobs(is_high_demand);
    CREATE INDEX IF NOT EXISTS idx_referrals_status ON candidate_referrals(status);
  `);

  try {
    db.exec('ALTER TABLE jobs ADD COLUMN location TEXT;');
  } catch (e) {
    // Column already exists
  }
}

// Upsert a job record
export function upsertJob(job) {
  const stmt = db.prepare(`
    INSERT INTO jobs (
      job_id, job_name, referral_reward_amount, no_of_openings,
      ideal_hourly_rate_min, ideal_hourly_rate_max, skills,
      is_high_demand, referral_url, job_description, location, date_posted, synced_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(job_id) DO UPDATE SET
      job_name = excluded.job_name,
      referral_reward_amount = excluded.referral_reward_amount,
      no_of_openings = excluded.no_of_openings,
      ideal_hourly_rate_min = excluded.ideal_hourly_rate_min,
      ideal_hourly_rate_max = excluded.ideal_hourly_rate_max,
      skills = excluded.skills,
      is_high_demand = excluded.is_high_demand,
      referral_url = excluded.referral_url,
      job_description = excluded.job_description,
      location = excluded.location,
      date_posted = excluded.date_posted,
      synced_at = datetime('now')
  `);

  const reward = parseFloat(job.referral_reward_amount || 0);
  const openings = parseInt(job.no_of_openings || 0, 10);
  const minRate = job.ideal_hourly_rate?.min != null ? parseFloat(job.ideal_hourly_rate.min) : null;
  const maxRate = job.ideal_hourly_rate?.max != null ? parseFloat(job.ideal_hourly_rate.max) : null;
  const skillsJson = JSON.stringify(job.skills || []);
  const isHighDemand = (job.is_high_demand_job === '1' || job.high_demand === true) ? 1 : 0;
  const location = parseLocation(job.job_description, job.job_name);

  stmt.run(
    job.job_id,
    job.job_name,
    reward,
    openings,
    minRate,
    maxRate,
    skillsJson,
    isHighDemand,
    job.referral_url,
    job.job_description || '',
    location,
    job.date_posted || null
  );
}

// Fetch all jobs from micro1 API and store in DB
export async function syncAllJobs() {
  const apiKey = process.env.MICRO1_API_KEY;
  if (!apiKey) {
    throw new Error('MICRO1_API_KEY is not defined in .env');
  }

  const baseUrl = process.env.MICRO1_API_BASE_URL || 'https://public.api.micro1.ai';
  console.log('🔄 Starting sync from micro1 API...');

  let page = 1;
  const limit = 100;
  let totalJobs = 0;
  let totalSynced = 0;

  initDb();

  while (true) {
    console.log(`📡 Fetching page ${page}...`);
    const res = await fetch(`${baseUrl}/referral/jobs?page=${page}&limit=${limit}`, {
      headers: { 'x-api-key': apiKey }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error HTTP ${res.status}: ${errText}`);
    }

    const payload = await res.json();
    totalJobs = payload.total || 0;
    const jobs = payload.data || [];

    if (jobs.length === 0) break;

    for (const job of jobs) {
      upsertJob(job);
      totalSynced++;
    }

    console.log(`✅ Synced ${totalSynced}/${totalJobs} jobs.`);

    if (totalSynced >= totalJobs || jobs.length < limit) {
      break;
    }
    page++;
  }

  console.log(`🎉 Sync complete! Total ${totalSynced} jobs stored in SQLite database.`);
  return { totalSynced, totalJobs };
}

// Query jobs with filters, search, sorting
export function getJobs({ q, minReward, highDemand, location, sort = 'reward_desc', limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (q && q.trim()) {
    const term = `%${q.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(job_name) LIKE ? OR LOWER(skills) LIKE ? OR LOWER(location) LIKE ?)';
    params.push(term, term, term);
  }

  if (minReward && !isNaN(minReward)) {
    sql += ' AND referral_reward_amount >= ?';
    params.push(parseFloat(minReward));
  }

  if (highDemand === 'true' || highDemand === '1' || highDemand === true) {
    sql += ' AND is_high_demand = 1';
  }

  if (location && location.trim()) {
    if (location === 'US') {
      sql += " AND (location LIKE '%US%' OR location LIKE '%United States%')";
    } else if (location === 'Global') {
      sql += " AND (location LIKE '%Global%' OR location LIKE '%Worldwide%' OR location = 'Remote (Global)')";
    } else {
      sql += ' AND location LIKE ?';
      params.push(`%${location.trim()}%`);
    }
  }

  // Sorting
  switch (sort) {
    case 'reward_desc':
      sql += ' ORDER BY referral_reward_amount DESC, no_of_openings DESC';
      break;
    case 'reward_asc':
      sql += ' ORDER BY referral_reward_amount ASC';
      break;
    case 'openings_desc':
      sql += ' ORDER BY no_of_openings DESC, referral_reward_amount DESC';
      break;
    case 'newest':
      sql += ' ORDER BY date_posted DESC';
      break;
    default:
      sql += ' ORDER BY referral_reward_amount DESC';
  }

  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);

  return rows.map(r => ({
    ...r,
    skills: r.skills ? JSON.parse(r.skills) : []
  }));
}

// Get metrics
export function getStats() {
  initDb();
  const jobsStats = db.prepare(`
    SELECT
      COUNT(*) AS total_jobs,
      SUM(no_of_openings) AS total_openings,
      MAX(referral_reward_amount) AS max_reward,
      AVG(referral_reward_amount) AS avg_reward,
      SUM(CASE WHEN is_high_demand = 1 THEN 1 ELSE 0 END) AS high_demand_count,
      SUM(referral_reward_amount * no_of_openings) AS total_reward_pool
    FROM jobs
  `).get();

  const refStats = db.prepare(`
    SELECT
      COUNT(*) AS total_referrals,
      SUM(CASE WHEN status = 'Contacted' THEN 1 ELSE 0 END) AS contacted_count,
      SUM(CASE WHEN status = 'Applied' THEN 1 ELSE 0 END) AS applied_count,
      SUM(CASE WHEN status = 'Interviewing' THEN 1 ELSE 0 END) AS interviewing_count,
      SUM(CASE WHEN status = 'Hired & Paid' THEN 1 ELSE 0 END) AS hired_count,
      SUM(CASE WHEN status = 'Hired & Paid' THEN reward_amount ELSE 0 END) AS earned_amount,
      SUM(CASE WHEN status != 'Rejected' AND status != 'Hired & Paid' THEN reward_amount ELSE 0 END) AS pending_potential
    FROM candidate_referrals
  `).get();

  const lastSync = db.prepare('SELECT MAX(synced_at) AS last_synced_at FROM jobs').get();

  const locations = db.prepare(`
    SELECT location, COUNT(*) as count
    FROM jobs
    GROUP BY location
    ORDER BY count DESC
  `).all();

  return {
    jobs: {
      total: jobsStats.total_jobs || 0,
      totalOpenings: jobsStats.total_openings || 0,
      maxReward: jobsStats.max_reward || 0,
      avgReward: Math.round(jobsStats.avg_reward || 0),
      highDemandCount: jobsStats.high_demand_count || 0,
      totalRewardPool: jobsStats.total_reward_pool || 0,
      lastSyncedAt: lastSync?.last_synced_at || null,
      locations
    },
    referrals: {
      total: refStats.total_referrals || 0,
      contacted: refStats.contacted_count || 0,
      applied: refStats.applied_count || 0,
      interviewing: refStats.interviewing_count || 0,
      hired: refStats.hired_count || 0,
      earned: refStats.earned_amount || 0,
      pendingPotential: refStats.pending_potential || 0
    }
  };
}

// Candidate Referral CRUD
export function getCandidateReferrals() {
  initDb();
  return db.prepare('SELECT * FROM candidate_referrals ORDER BY created_at DESC').all();
}

export function addCandidateReferral({ jobId, jobName, candidateName, candidateEmail, candidateLinkedin, notes, status = 'Contacted', rewardAmount = 0 }) {
  initDb();
  const stmt = db.prepare(`
    INSERT INTO candidate_referrals (
      job_id, job_name, candidate_name, candidate_email,
      candidate_linkedin, status, reward_amount, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    jobId || '',
    jobName || '',
    candidateName,
    candidateEmail || '',
    candidateLinkedin || '',
    status,
    parseFloat(rewardAmount) || 0,
    notes || ''
  );
  return { id: info.lastInsertRowid };
}

export function updateCandidateReferral(id, { status, notes }) {
  initDb();
  const stmt = db.prepare(`
    UPDATE candidate_referrals
    SET status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(status ?? null, notes ?? null, id);
  return { success: true };
}

export function deleteCandidateReferral(id) {
  initDb();
  db.prepare('DELETE FROM candidate_referrals WHERE id = ?').run(id);
  return { success: true };
}

// Connections & Job Matching
export function getConnections({ q, minEarnings, topMatchOnly = true, limit = 50, offset = 0 } = {}) {
  initDb();
  let sql = 'SELECT * FROM connections WHERE 1=1';
  const params = [];

  if (topMatchOnly === true || topMatchOnly === 'true') {
    sql += ' AND match_count > 0';
  }

  if (q && q.trim()) {
    const term = `%${q.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(full_name) LIKE ? OR LOWER(position) LIKE ? OR LOWER(company) LIKE ?)';
    params.push(term, term, term);
  }

  if (minEarnings && !isNaN(minEarnings)) {
    sql += ' AND max_potential_earnings >= ?';
    params.push(parseFloat(minEarnings));
  }

  sql += ' ORDER BY max_potential_earnings DESC, match_count DESC, id ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));

  const rows = db.prepare(sql).all(...params);

  const rateMap = new Map();
  try {
    db.prepare('SELECT job_id, ideal_hourly_rate_min, ideal_hourly_rate_max FROM jobs').all().forEach(j => {
      rateMap.set(j.job_id, { min: j.ideal_hourly_rate_min, max: j.ideal_hourly_rate_max });
    });
  } catch (e) {}

  return rows.map(r => {
    const jobs = r.matched_jobs ? JSON.parse(r.matched_jobs) : [];
    return {
      ...r,
      matched_jobs: jobs.map(j => {
        const rates = rateMap.get(j.id);
        return {
          ...j,
          rate_min: rates?.min || null,
          rate_max: rates?.max || null
        };
      })
    };
  });
}

export function getConnectionStats() {
  initDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_connections,
      SUM(CASE WHEN match_count > 0 THEN 1 ELSE 0 END) AS matched_connections,
      SUM(max_potential_earnings) AS total_potential_earnings,
      MAX(max_potential_earnings) AS max_single_earning,
      SUM(CASE WHEN status = 'Intro Sent' THEN 1 ELSE 0 END) AS intros_sent,
      SUM(CASE WHEN status = 'Vouched' THEN 1 ELSE 0 END) AS vouched_count
    FROM connections
  `).get();

  return {
    total: stats.total_connections || 0,
    matched: stats.matched_connections || 0,
    totalPotential: stats.total_potential_earnings || 0,
    maxSingle: stats.max_single_earning || 0,
    introsSent: stats.intros_sent || 0,
    vouched: stats.vouched_count || 0
  };
}

export function updateConnection(id, { status, notes }) {
  initDb();
  const stmt = db.prepare(`
    UPDATE connections
    SET status = COALESCE(?, status),
        notes = COALESCE(?, notes)
    WHERE id = ?
  `);
  stmt.run(status ?? null, notes ?? null, id);
  return { success: true };
}

export function deleteConnection(id) {
  initDb();
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  return { success: true };
}
