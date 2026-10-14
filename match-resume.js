// match-resume.js
// Next-Gen Resume Matching Engine for micro1 Hub
import { DatabaseSync } from 'node:sqlite';
import { getJobAccurateRate, requiresSpecificLanguage } from './matching-engine-v2.js';

const db = new DatabaseSync('referrals.db');
const allJobs = db.prepare('SELECT * FROM jobs').all();

const rateMap = new Map();
allJobs.forEach(j => {
  rateMap.set(j.job_id, getJobAccurateRate(j));
});

export function parseResume(resumeText) {
  const text = (resumeText || '').toLowerCase();

  // Extract titles / roles
  const commonTitles = [
    'software engineer', 'senior software engineer', 'frontend developer', 'backend developer',
    'full stack developer', 'fullstack engineer', 'systems engineer', 'devops engineer',
    'sre', 'cloud architect', 'machine learning engineer', 'ml engineer', 'data scientist',
    'data analyst', 'product manager', 'project manager', 'scrum master', 'qa engineer',
    'security engineer', 'open source maintainer', 'research scientist', 'applied scientist',
    'attorney', 'lawyer', 'legal counsel', 'paralegal', 'physician', 'doctor', 'hospitalist',
    'psychiatrist', 'accountant', 'financial analyst', 'investment banker', 'investor',
    'recruiter', 'technical writer', 'marketing manager', 'ui/ux designer'
  ];

  const detectedRoles = [];
  for (const t of commonTitles) {
    if (text.includes(t)) {
      detectedRoles.push(t);
    }
  }

  // Extract programming languages & technologies
  const techStack = [
    'python', 'javascript', 'typescript', 'c++', 'c#', 'golang', 'go', 'rust', 'java',
    'ruby', 'php', 'swift', 'kotlin', 'react', 'node', 'vue', 'angular', 'django', 'fastapi',
    'flask', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'linux', 'git', 'github',
    'pytorch', 'tensorflow', 'llm', 'nlp', 'sql', 'postgres', 'mongodb', 'graphql',
    'html', 'css', 'tailwind'
  ];

  const detectedSkills = [];
  for (const s of techStack) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
    if (regex.test(text)) {
      detectedSkills.push(s);
    }
  }

  // Detect seniority
  let seniority = 'Mid-Level';
  let seniorityLevel = 3;
  if (/\b(principal|staff|lead|architect|head of|vp|director|founder|co-founder|chief|partner)\b/i.test(text)) {
    seniority = 'Senior / Principal';
    seniorityLevel = 5;
  } else if (/\b(senior|sr\.?|manager)\b/i.test(text)) {
    seniority = 'Senior';
    seniorityLevel = 4;
  } else if (/\b(junior|jr\.?|intern|graduate|entry)\b/i.test(text)) {
    seniority = 'Junior / Entry';
    seniorityLevel = 2;
  }

  return {
    raw: resumeText,
    detectedRoles,
    detectedSkills,
    seniority,
    seniorityLevel
  };
}

export function matchResumeToJobs(resumeText, topN = 5) {
  const parsed = parseResume(resumeText);
  const textLower = (resumeText || '').toLowerCase();

  const scoredJobs = [];

  for (const job of allJobs) {
    const jobName = (job.job_name || '').toLowerCase();
    const jobSkills = (job.skills ? JSON.parse(job.skills) : []).map(s => s.toLowerCase());
    const reward = Number(job.referral_reward_amount || 0);
    const openings = Number(job.no_of_openings || 0);
    const rates = rateMap.get(job.job_id) || getJobAccurateRate(job);

    // Language guard
    const reqLang = requiresSpecificLanguage(jobName);
    if (reqLang && !textLower.includes(reqLang)) {
      continue;
    }

    // Domain barriers
    const isLegalJob = /lawyer|attorney|litigat|counsel|legal/i.test(jobName);
    if (isLegalJob && !/\b(lawyer|attorney|counsel|legal|jd|juris doctor|litigat|paralegal)\b/i.test(textLower)) {
      continue;
    }

    const isClinicalJob = /physician|hospitalist|doctor of medicine|primary care physician/i.test(jobName);
    if (isClinicalJob && (!/\b(physician|hospitalist|md|mbbs|medical doctor)\b/i.test(textLower) || /\b(veterinar|animal|poultry)\b/i.test(textLower))) {
      continue;
    }

    // Calculate match score
    // 1. Title / Role Match (40%)
    let titleScore = 20;
    const jobWords = jobName.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    let matchedTitleWords = 0;
    for (const w of jobWords) {
      if (textLower.includes(w)) matchedTitleWords++;
    }
    if (jobWords.length > 0) {
      titleScore = Math.min(100, Math.round((matchedTitleWords / jobWords.length) * 100));
    }

    // Role booster
    for (const r of parsed.detectedRoles) {
      if (jobName.includes(r) || (r.includes('developer') && jobName.includes('engineer'))) {
        titleScore = Math.max(titleScore, 90);
      }
    }

    // Open source maintainer booster
    if (textLower.includes('github') || textLower.includes('open source') || textLower.includes('maintainer')) {
      if (jobName.includes('open source') || jobName.includes('maintainer')) {
        titleScore = 100;
      }
    }

    // 2. Skill Overlap (35%)
    let skillScore = 30;
    if (jobSkills.length > 0) {
      let matchedSkills = 0;
      for (const js of jobSkills) {
        if (textLower.includes(js)) matchedSkills++;
      }
      skillScore = Math.round((matchedSkills / jobSkills.length) * 100);
    } else {
      // If job has no listed skills, check detected skills against text
      skillScore = Math.min(80, parsed.detectedSkills.length * 10);
    }

    // 3. Seniority Fit (15%)
    let seniorityScore = 80;
    if (jobName.includes('senior') || jobName.includes('lead') || jobName.includes('principal')) {
      if (parsed.seniorityLevel >= 4) seniorityScore = 100;
      else if (parsed.seniorityLevel <= 2) seniorityScore = 40;
    } else if (jobName.includes('junior') || jobName.includes('entry') || jobName.includes('evaluator')) {
      if (parsed.seniorityLevel <= 3) seniorityScore = 100;
      else seniorityScore = 60;
    }

    // 4. Bounty (10%)
    const bountyScore = Math.min(100, (reward / 3000) * 100);

    const compositeScore = Math.round(
      (titleScore * 0.40) + (skillScore * 0.35) + (seniorityScore * 0.15) + (bountyScore * 0.10)
    );

    if (compositeScore >= 45) {
      scoredJobs.push({
        id: job.job_id,
        name: job.job_name,
        reward: reward,
        openings: openings,
        url: job.referral_url,
        rate_min: rates.min,
        rate_max: rates.max,
        pay_display: `$${rates.min} – $${rates.max}/hr USD (depending on experience)`,
        match_score: compositeScore,
        title_score: titleScore,
        skill_score: skillScore,
        rationale: `Role Fit: ${titleScore}% · Skills Overlap: ${skillScore}% · Seniority: ${seniorityScore}%`
      });
    }
  }

  scoredJobs.sort((a, b) => (b.match_score - a.match_score) || (b.reward - a.reward) || (b.openings - a.openings));

  return {
    parsedProfile: parsed,
    totalMatchingJobs: scoredJobs.length,
    topMatches: scoredJobs.slice(0, topN)
  };
}
