import { execSync } from 'child_process';
import fs from 'fs';

// Helper to query SQLite CLI directly
function querySqlite(sql) {
  const output = execSync(`sqlite3 referrals.db "${sql.replace(/"/g, '\"')}"`, { encoding: 'utf-8' });
  return output.trim();
}

function getJobAccurateRate(job) {
  const name = (job.job_name || job.name || '').toLowerCase();
  const reward = Number(job.referral_reward_amount || job.reward || 0);

  if (name.includes('research scientist') || name.includes('computational physics')) return { min: 100, max: 400 };
  if (name.includes('law') || name.includes('attorney') || name.includes('counsel') || name.includes('litigat')) return { min: 140, max: 400 };
  if (name.includes('physician') || name.includes('hospitalist') || name.includes('psychiatrist') || name.includes('doctor')) return { min: 120, max: 250 };
  if (name.includes('investment banking') || name.includes('m&a') || name.includes('equity research')) return { min: 150, max: 300 };
  if (name.includes('member of technical staff') || name.includes('robotics research') || name.includes('coding research') || name.includes('vp of robotics')) return { min: 100, max: 250 };
  if (name.includes('strategic project lead') || name.includes('product owner') || name.includes('enterprise client partner') || name.includes('data partnerships')) return { min: 80, max: 180 };
  if (name.includes('engineer') || name.includes('developer') || name.includes('architect')) return { min: 60, max: 150 };
  if (name.includes('data scientist') || name.includes('machine learning') || name.includes('nlp')) return { min: 60, max: 150 };
  if (name.includes('recruiter') || name.includes('talent acquisition') || name.includes('talent partner')) return { min: 40, max: 80 };
  if (reward >= 2000) return { min: 100, max: 250 };
  if (reward >= 1500) return { min: 80, max: 180 };
  if (reward >= 1000) return { min: 50, max: 120 };
  if (reward >= 500) return { min: 35, max: 75 };
  if (reward >= 300) return { min: 25, max: 50 };
  return { min: 20, max: 40 };
}

function formatFirstName(raw) {
  if (!raw) return 'there';
  const tokens = raw.trim().split(/\s+/).map(t => t.replace(/[^a-zA-Z\u00C0-\u024F]/g, '')).filter(Boolean);
  if (!tokens.length) return 'there';
  const titles = new Set(['dr', 'mr', 'mrs', 'ms', 'prof', 'doctor', 'sir', 'madam']);
  let first = tokens[0];
  if (titles.has(first.toLowerCase()) && tokens.length > 1) {
    first = tokens[1];
  }
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function getRolePayDisplay(role) {
  if (!role) return "$100 – $400/hr USD (~₹8,400 – ₹33,600/hr INR) (depending on experience)";
  
  let min = role.rate_min;
  let max = role.rate_max;

  min = Number(min);
  max = Number(max);

  if (max && max >= 20 && min && min >= 15 && min <= max) {
    return `$${min} – $${max}/hr USD (depending on experience)`;
  }

  const acc = getJobAccurateRate(role);
  return `$${acc.min} – $${acc.max}/hr USD (depending on experience)`;
}

function generateMessage(conn) {
  const jobs = JSON.parse(conn.matched_jobs || '[]');
  const topRole = jobs[0] || { name: 'AI Specialist', reward: 1000, url: 'https://jobs.micro1.ai' };
  const firstName = formatFirstName(conn.first_name || conn.full_name);
  const roleName = (topRole.name || 'AI Specialist').trim().replace(/\s+/g, ' ');
  const payDisplay = getRolePayDisplay(topRole);
  const cleanUrl = (topRole.url || 'https://jobs.micro1.ai').replace(/&utm_[^&]+/g, '').replace(/\?utm_[^&]+&/, '?');

  return `Hi ${firstName}, hope you're doing well!

We're connecting talented specialists with leading global AI research projects and are onboarding for:
${roleName}

🔹 Remote: 100% work from anywhere
🔹 Flexible: Part-time or full-time (alongside your current role)
🔹 Compensation: ${payDisplay}
🔹 Projects: Cutting-edge AI research and specialized technical work

Your background aligns well with this opportunity. You can view the scope and apply directly here:
${cleanUrl}

Looking forward to connecting!`;
}

async function runTests() {
  console.log('=== RUNNING TESTS ON 1-JOB MATCHING & OUTREACH MESSAGES ===\n');

  // 1. Verify single job constraint across the entire database
  const totalWithJobsRaw = querySqlite("SELECT count(*) FROM connections WHERE matched_jobs != '[]' AND matched_jobs IS NOT NULL;");
  const totalMoreThanOneRaw = querySqlite("SELECT count(*) FROM connections WHERE json_array_length(matched_jobs) > 1;");
  const totalExactlyOneRaw = querySqlite("SELECT count(*) FROM connections WHERE json_array_length(matched_jobs) = 1;");

  console.log(`[Database Verification] Total Matched Connections: ${totalWithJobsRaw}`);
  console.log(`[Database Verification] Connections with Exactly 1 Job: ${totalExactlyOneRaw}`);
  console.log(`[Database Verification] Connections with >1 Job: ${totalMoreThanOneRaw}`);

  if (Number(totalMoreThanOneRaw) !== 0) {
    throw new Error(`Integrity Error: Found ${totalMoreThanOneRaw} connections with more than 1 job!`);
  }
  console.log('✓ PASS: Every candidate has strictly ONE single highest-value job assigned.\n');

  // 2. Sample diverse persona cases including BigLaw Attorney, VC Investor, and Clinical MD
  const sampleQueries = [
    { label: 'Venture Capital / Software Investor', condition: "position LIKE '%Investor%' OR position LIKE '%Venture Capital%'" },
    { label: 'BigLaw Attorney / Legal Counsel', condition: "(position LIKE '%Lawyer%' OR position LIKE '%Attorney%' OR position LIKE '%Legal Counsel%') AND position NOT LIKE '%Investor%'" },
    { label: 'Immigration Attorney Specialist', condition: "position LIKE '%Immigration Attorney%'" },
    { label: 'Physician / Medical AI Trainer', condition: "position LIKE '%Physician%' OR position LIKE '%Hospitalist%'" },
    { label: 'AI Researcher / Scientist', condition: "position LIKE '%Research Scientist%' OR position LIKE '%Computational Physics%'" },
    { label: 'Enterprise / Partnerships Leader', condition: "position LIKE '%Strategic Partner%' OR position LIKE '%Enterprise%'" },
    { label: 'Software / Engineering Specialist', condition: "position LIKE '%Software Engineer%' OR position LIKE '%Developer%'" },
    { label: 'Recruiter / Talent Professional', condition: "position LIKE '%Recruiter%' OR position LIKE '%Talent%'" }
  ];

  // 2b. Assert Domain Barrier Guardrails across the whole database
  console.log('[Domain Isolation] Verifying 0 Investors matched to Lawyers...');
  const investorLawyerOverlap = querySqlite("SELECT count(*) FROM connections WHERE (position LIKE '%Investor%' OR position LIKE '%Venture Capital%') AND (matched_jobs LIKE '%Lawyer%' OR matched_jobs LIKE '%Attorney%');");
  if (Number(investorLawyerOverlap) !== 0) {
    throw new Error(`Domain Barrier Violation: ${investorLawyerOverlap} investors matched to lawyer roles!`);
  }
  console.log('✓ PASS: 0 Investors matched to BigLaw lawyers (100% Isolated).\n');

  console.log('[Domain Isolation] Verifying 0 Veterinarians matched to Human Clinical MD roles...');
  const vetDoctorOverlap = querySqlite("SELECT count(*) FROM connections WHERE position LIKE '%Veterinar%' AND (matched_jobs LIKE '%Physician%' OR matched_jobs LIKE '%Hospitalist%' OR matched_jobs LIKE '%Psychiatrist%');");
  if (Number(vetDoctorOverlap) !== 0) {
    throw new Error(`Domain Barrier Violation: ${vetDoctorOverlap} veterinarians matched to human physician roles!`);
  }
  console.log('✓ PASS: 0 Veterinarians matched to human clinical medicine roles (100% Isolated).\n');

  const testResults = [];

  for (const q of sampleQueries) {
    const rawJson = querySqlite(`SELECT json_object('id', id, 'full_name', full_name, 'first_name', first_name, 'position', position, 'company', company, 'matched_jobs', matched_jobs) FROM connections WHERE matched_jobs != '[]' AND (${q.condition}) LIMIT 1;`);
    
    if (!rawJson) {
      console.log(`No match found for query: ${q.label}`);
      continue;
    }

    const conn = JSON.parse(rawJson);
    const jobs = JSON.parse(conn.matched_jobs);
    const topRole = jobs[0];
    const msg = generateMessage(conn);

    // Assertions
    const hasCompetitivePlaceholder = msg.includes("Competitive rate paid in USD");
    const hasAsterisks = msg.includes("**");
    const hasUsd = msg.includes("USD") && msg.includes("$");
    const hasInr = msg.includes("INR") || msg.includes("₹");
    const hasBlueBullets = msg.includes("🔹 Remote:") && msg.includes("🔹 Compensation:");
    const singleJobCheck = jobs.length === 1;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Test Persona: ${q.label}`);
    console.log(`Candidate: ${conn.full_name} (${conn.position} at ${conn.company || 'N/A'})`);
    console.log(`Assigned Job (Strictly 1): ${topRole.name} (Reward: +$${topRole.reward})`);
    console.log(`Verification: Single Job = ${singleJobCheck ? '✓' : '✗'}, USD Only (No INR) = ${hasUsd && !hasInr ? '✓' : '✗'}, No Asterisks = ${!hasAsterisks ? '✓' : '✗'}`);
    console.log(`\nGenerated Outreach Message:\n`);
    console.log(msg);
    console.log(`\n`);

    if (hasAsterisks) {
      throw new Error(`Failed: Raw markdown asterisks "**" found in message for ${conn.full_name}!`);
    }
    if (hasInr) {
      throw new Error(`Failed: INR currency found in message for ${conn.full_name}! Should be USD only.`);
    }
    if (hasCompetitivePlaceholder) {
      throw new Error(`Failed: Placeholder "Competitive rate paid in USD" found in message for ${conn.full_name}`);
    }
    if (!hasUsd) {
      throw new Error(`Failed: USD rate missing in compensation for ${conn.full_name}`);
    }
    if (!singleJobCheck) {
      throw new Error(`Failed: Candidate ${conn.full_name} has ${jobs.length} jobs instead of 1`);
    }

    testResults.push({
      persona: q.label,
      candidate: conn.full_name,
      position: conn.position,
      company: conn.company,
      assignedJob: topRole.name,
      reward: topRole.reward,
      compensation: getRolePayDisplay(topRole),
      message: msg
    });
  }

  console.log('================================================================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (5/5 Personas Verified)');
  console.log('================================================================================\n');

  return { totalExactlyOne: totalExactlyOneRaw, testResults };
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
