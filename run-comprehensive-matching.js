import fs from 'node:fs';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'referrals.db');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wajjvsbkgbuyjkdsnhmc.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamp2c2JrZ2J1eWprZHNuaG1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk3ODMyMSwiZXhwIjoyMTA3NTU0MzIxfQ.jqzV2bWyqOwPlMk7x1RneX-Noi9ap1huC5YDuGRhY9M';

const db = new DatabaseSync(dbPath);

async function run() {
  console.log('🔄 Loading all jobs from SQLite...');
  const jobs = db.prepare('SELECT job_id, job_name, referral_reward_amount, no_of_openings, location, ideal_hourly_rate_min, ideal_hourly_rate_max, referral_url FROM jobs').all();
  
function getJobAccurateRate(job) {
  const name = (job.job_name || job.name || '').toLowerCase();
  const reward = Number(job.referral_reward_amount || job.reward || 0);
  let min = job.ideal_hourly_rate_min != null ? Number(job.ideal_hourly_rate_min) : null;
  let max = job.ideal_hourly_rate_max != null ? Number(job.ideal_hourly_rate_max) : null;

  if (max && max >= 20 && min && min >= 15 && min <= max) {
    return { min, max };
  }

  if (name.includes('research scientist') || name.includes('computational physics')) {
    return { min: 100, max: 400 };
  }
  if (name.includes('lawyer') || name.includes('attorney') || name.includes('counsel') || name.includes('biglaw') || name.includes('litigat')) {
    return { min: 140, max: 400 };
  }
  if (name.includes('physician') || name.includes('hospitalist') || name.includes('psychiatrist') || name.includes('doctor')) {
    return { min: 120, max: 250 };
  }
  if (name.includes('investment banking') || name.includes('m&a') || name.includes('equity research') || name.includes('rates trader')) {
    return { min: 150, max: 300 };
  }
  if (name.includes('member of technical staff') || name.includes('robotics research') || name.includes('coding research') || name.includes('vp of robotics')) {
    return { min: 100, max: 250 };
  }
  if (name.includes('strategic project lead') || name.includes('product owner') || name.includes('enterprise client partner') || name.includes('data partnerships')) {
    return { min: 90, max: 180 };
  }
  if (name.includes('domain researcher')) {
    return { min: 75, max: 150 };
  }
  if (name.includes('senior software') || name.includes('tech lead') || name.includes('architect') || name.includes('principal')) {
    return { min: 80, max: 160 };
  }
  if (name.includes('ml engineer') || name.includes('machine learning') || name.includes('data scientist')) {
    return { min: 70, max: 150 };
  }
  if (name.includes('software engineer') || name.includes('developer') || name.includes('full-stack') || name.includes('backend') || name.includes('frontend')) {
    return { min: 50, max: 120 };
  }
  if (name.includes('accountant') || name.includes('auditor') || name.includes('tax') || name.includes('cpa')) {
    return { min: 50, max: 100 };
  }
  if (name.includes('salesops') || name.includes('crm') || name.includes('revenue systems') || name.includes('salesforce') || name.includes('hubspot')) {
    return { min: 60, max: 120 };
  }
  if (name.includes('brand') || name.includes('creative') || name.includes('video content lead') || name.includes('journalist') || name.includes('editor')) {
    return { min: 45, max: 90 };
  }
  if (name.includes('recruiter') || name.includes('recruitment') || name.includes('talent')) {
    return { min: 40, max: 80 };
  }
  if (name.includes('data analyst') || name.includes('privacy analyst') || name.includes('analytics')) {
    return { min: 35, max: 70 };
  }
  if (name.includes('virtual assistant') || name.includes('community manager')) {
    return { min: 25, max: 50 };
  }
  if (name.includes('transcription') || name.includes('annotat') || name.includes('evaluator') || name.includes('tester')) {
    return { min: 20, max: 40 };
  }

  if (reward >= 2000) return { min: 100, max: 250 };
  if (reward >= 1500) return { min: 80, max: 180 };
  if (reward >= 1000) return { min: 50, max: 120 };
  if (reward >= 500) return { min: 35, max: 75 };
  if (reward >= 300) return { min: 25, max: 50 };
  return { min: 20, max: 40 };
}

  // Rate map with accurate sensible rates for all jobs
  const rateMap = new Map();
  jobs.forEach(j => {
    rateMap.set(j.job_id, getJobAccurateRate(j));
  });

  const rules = [
    // 1. Legal & Compliance
    {
      category: 'Legal & Corporate',
      pattern: /\b(lawyer|attorney|counsel|litigat|legal|barrister|solicitor|juris doctor|compliance|paralegal|law firm)\b/i,
      roles: jobs.filter(j => /lawyer|attorney|litigat|counsel|legal/i.test(j.job_name))
    },
    // 2. AI, Science & Research
    {
      category: 'AI & Science',
      pattern: /\b(research scientist|physics|computational|ai researcher|scientist|applied scientist|postdoc|phd|physicist|mathematician|stem|aerodynamics|materials science)\b/i,
      roles: jobs.filter(j => /research scientist|physics|computational|stem|materials science|aerodynamics/i.test(j.job_name))
    },
    // 3. Healthcare & Medical
    {
      category: 'Healthcare',
      pattern: /\b(physician|doctor|hospitalist|nurse|surgeon|medical|clinical|psychiatrist|dietitian|healthcare|hospital|specialist.*med)\b/i,
      roles: jobs.filter(j => /physician|hospitalist|medical|nurse|psychiatrist|dietitian/i.test(j.job_name))
    },
    // 4. Finance, Investment & Banking
    {
      category: 'Finance & Advisory',
      pattern: /\b(investment|m&a|financial|wealth manager|private equity|venture capital|equity research|portfolio|cfa|banking|finance|trader|rates trader|investor|angel)\b/i,
      roles: jobs.filter(j => /financial|m&a|investment|equity research|rates trader|finance specialist/i.test(j.job_name))
    },
    // 5. Accounting & Audit
    {
      category: 'Accounting',
      pattern: /\b(accountant|auditor|cpa|controller|bookkeeper|tax|accounting)\b/i,
      roles: jobs.filter(j => /accountant|auditor|tax|accounts payable/i.test(j.job_name))
    },
    // 6. Software, Engineering, Tech Leads, CTOs
    {
      category: 'Engineering',
      pattern: /\b(software|developer|engineer|fullstack|frontend|backend|python|java|rust|c\+\+|golang|devops|architect|sre|programmer|tech lead|technical lead|cto|chief technology|member of technical staff|mts|web dev|ios|android|ml engineer|machine learning|coder|coding|robotics)\b/i,
      roles: jobs.filter(j => /software|developer|engineer|coder|coding|ml engineer|robotics/i.test(j.job_name))
    },
    // 7. Data Science & Analytics
    {
      category: 'Analytics',
      pattern: /\b(data analyst|business analyst|bi analyst|analytics|data scientist|big data|data engineer|database|analyst|senior analyst)\b/i,
      roles: jobs.filter(j => /data analyst|data scientist|big data|database|analytics/i.test(j.job_name))
    },
    // 8. Product Management & Strategy
    {
      category: 'Product & Strategy',
      pattern: /\b(product manager|product owner|product lead|head of product|group product manager|cpo|product management|product designer)\b/i,
      roles: jobs.filter(j => /product owner|strategic project lead/i.test(j.job_name))
    },
    // 9. Consulting & Advisory
    {
      category: 'Consulting',
      pattern: /\b(consultant|senior consultant|lead consultant|management consultant|strategy consultant|advisory|principal consultant|associate consultant)\b/i,
      roles: jobs.filter(j => /consulting specialist|strategic project lead|solutions architect/i.test(j.job_name))
    },
    // 10. Founders, Executives & Leadership
    {
      category: 'Leadership & Strategic',
      pattern: /\b(founder|co-founder|ceo|chief executive|managing director|partner|general manager|vp|vice president|director|associate director|business head|chief of staff|coo|chief operating|cbo|chief business|president|owner)\b/i,
      roles: jobs.filter(j => /strategic project lead|vp of robotics|solutions architect|enterprise client partner/i.test(j.job_name))
    },
    // 11. Sales, BD & Partnerships
    {
      category: 'Sales & Growth',
      pattern: /\b(sales|account executive|business development|partnerships|revenue|growth|sdr|bdr|head of sales|sales manager|client partner|account manager|key account|relationship manager|client manager)\b/i,
      roles: jobs.filter(j => /sales|revenue operations|enterprise client partner|data partnerships/i.test(j.job_name))
    },
    // 12. Marketing, Creative, Content & Design
    {
      category: 'Creative & Marketing',
      pattern: /\b(marketing|brand|creative|graphic designer|video editor|writer|journalist|editor|content|copywriter|social media|animator|ui\/ux|visual)\b/i,
      roles: jobs.filter(j => /brand & creative|graphic designer|video editor|journalist|writer|editor|video content lead|visual creative/i.test(j.job_name))
    },
    // 13. Recruiting & HR
    {
      category: 'People & Talent',
      pattern: /\b(recruiter|talent|headhunter|sourcer|human resources|hr manager|people ops|hr business partner|recruitment specialist)\b/i,
      roles: jobs.filter(j => /recruiter|recruitment|community manager/i.test(j.job_name))
    },
    // 14. Operations & Project Management
    {
      category: 'Operations',
      pattern: /\b(operations|program manager|project manager|scrum master|pmp|delivery manager|operations manager|human data)\b/i,
      roles: jobs.filter(j => /revenue operations|strategic project lead|product owner|human data/i.test(j.job_name))
    },
    // 15. Quality, QA & Testing
    {
      category: 'QA & Testing',
      pattern: /\b(qa|quality assurance|tester|test engineer|automation engineer|sdet|evaluator)\b/i,
      roles: jobs.filter(j => /qa engineer|usability tester|ai agent evaluator/i.test(j.job_name))
    },
    // 16. Customer Success & Support
    {
      category: 'Customer Success',
      pattern: /\b(customer support|customer success|customer service|client servicing|support specialist|virtual assistant)\b/i,
      roles: jobs.filter(j => /customer service|virtual assistant|community manager/i.test(j.job_name))
    },
    // 17. Education & Teaching
    {
      category: 'Education',
      pattern: /\b(teacher|professor|instructor|educator|lecturer|tutor|faculty|dean)\b/i,
      roles: jobs.filter(j => /educator|english teacher|trainer/i.test(j.job_name))
    }
  ];

  console.log('📖 Reading Connections.csv...');
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

    const text = `${position} ${company}`;
    const matchedJobsList = [];
    let maxReward = 0;

    const addedJobIds = new Set();

    for (const r of rules) {
      if (r.pattern.test(text)) {
        // Sort roles in this rule by reward descending
        const sortedRoles = [...r.roles].sort((a, b) => b.referral_reward_amount - a.referral_reward_amount);
        for (const job of sortedRoles) {
          if (addedJobIds.has(job.job_id)) continue;
          addedJobIds.add(job.job_id);

          const rates = rateMap.get(job.job_id) || { min: 60, max: 150 };
          matchedJobsList.push({
            id: job.job_id,
            name: job.job_name,
            reward: job.referral_reward_amount,
            openings: job.no_of_openings,
            url: job.referral_url,
            category: r.category,
            rate_min: rates.min,
            rate_max: rates.max
          });

          if (job.referral_reward_amount > maxReward) {
            maxReward = job.referral_reward_amount;
          }

          if (matchedJobsList.length >= 5) break; // Top 5 best matching roles
        }
      }
      if (matchedJobsList.length >= 5) break;
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
      status: 'New',
      notes: null,
      created_at: new Date().toISOString()
    });
  }

  console.log(`✅ Processed ${count} total connections from CSV.`);
  console.log(`🎯 Matched Connections: ${matchedCount} (${((matchedCount/count)*100).toFixed(1)}%)!`);

  // Update SQLite
  console.log('💾 Updating SQLite database referrals.db...');
  db.exec('BEGIN TRANSACTION;');
  db.exec('DELETE FROM connections;');
  const stmt = db.prepare(`
    INSERT INTO connections (
      id, first_name, last_name, full_name, linkedin_url, email,
      company, position, connected_on, matched_jobs, match_count, max_potential_earnings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      c.max_potential_earnings
    );
  }
  db.exec('COMMIT;');
  console.log('✅ SQLite updated successfully!');

  // Update Supabase
  console.log('☁️ Uploading comprehensive matches to Supabase in batches...');
  for (let i = 0; i < processedConnections.length; i += 500) {
    const chunk = processedConnections.slice(i, i + 500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/connections`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(chunk)
    });
    if (!res.ok) {
      console.error(`Batch ${i} failed:`, await res.text());
    } else {
      console.log(`  Synced ${Math.min(i + 500, processedConnections.length)}/${processedConnections.length} connections to Supabase`);
    }
  }
  console.log('🎉 Full Comprehensive Matching and Rate Enrichment Complete!');
}

run().catch(console.error);
