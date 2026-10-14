// matching-engine-v2.js
// Next-Gen Intelligent Candidate-to-Job Matching Engine (v2.0)
// Implements Domain Isolation Guardrails (Stage 1) and Multi-Factor Weighted Scoring (Stage 2)

export function getJobAccurateRate(job) {
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

// Language requirement detector
const LANGUAGE_LIST = [
  'vietnamese', 'cantonese', 'japanese', 'georgian', 'german',
  'spanish', 'mandarin', 'french', 'korean', 'russian', 'arabic',
  'danish', 'dutch', 'finnish', 'gujarati', 'punjabi', 'tamil',
  'telugu', 'urdu', 'bengali', 'norwegian', 'swiss german', 'portuguese', 'gravador'
];

export function requiresSpecificLanguage(jobName) {
  const lower = (jobName || '').toLowerCase();
  for (const lang of LANGUAGE_LIST) {
    if (lower.includes(lang)) return lang;
  }
  return null;
}

// Seniority Detection (Levels 1 to 5)
export function detectSeniority(text) {
  const t = (text || '').toLowerCase();
  if (/\b(partner|founder|co-founder|managing director|c-level|ceo|cto|cfo|cpo|chief|vp|vice president|head of|principal|fellow|staff engineer|director|associate director)\b/.test(t)) {
    return { level: 5, label: 'Executive / Principal' };
  }
  if (/\b(senior|sr\.?|lead|manager|tech lead|architect|team lead)\b/.test(t)) {
    return { level: 4, label: 'Senior / Lead' };
  }
  if (/\b(associate|specialist|consultant|analyst|practitioner|researcher|mid|coordinator)\b/.test(t)) {
    return { level: 3, label: 'Mid / Specialist' };
  }
  if (/\b(junior|jr\.?|entry|assistant|apprentice|trainee|clerk|evaluator|annotator)\b/.test(t)) {
    return { level: 2, label: 'Junior / Associate' };
  }
  if (/\b(intern|internship|student|fellow)\b/.test(t)) {
    return { level: 1, label: 'Intern / Student' };
  }
  return { level: 3, label: 'Mid-Level' };
}

// Domain Classification & Isolation (Stage 1)
export function classifyCandidateDomain(position, company) {
  const pos = (position || '').trim().toLowerCase();
  const comp = (company || '').trim().toLowerCase();
  const full = `${pos} ${comp}`.trim();

  const allowedDomains = new Set();
  const excludedDomains = new Set();

  // 1. Legal Domain Gatekeeper
  const isLegalCandidate = /\b(lawyer|attorney|counsel|general counsel|litigat|legal|barrister|solicitor|juris doctor|\bjd\b|paralegal|law firm|associate attorney|partner at .*law|partner .* legal)\b/i.test(pos);
  const isExcludedFromLegal = /\b(investor|investment|venture capital|private equity|portfolio|banker|banking|trader|software|engineer|developer|veterinar|doctor|physician|nurse|sales|recruiter)\b/i.test(pos);

  if (isLegalCandidate && !isExcludedFromLegal) {
    allowedDomains.add('LEGAL');
  } else {
    excludedDomains.add('LEGAL');
  }

  // 2. Clinical Healthcare / MD Gatekeeper
  const isClinicalMD = /\b(physician|hospitalist|cardiologist|neurologist|psychiatrist|radiologist|surgeon|internal medicine|family medicine|doctor of medicine|\bmd\b|\bmbbs\b|\bdo\b|clinical doctor|practicing doctor|residency|medical doctor)\b/i.test(pos);
  const isNonHumanOrVet = /\b(veterinar|vet\b|veterinary|animal|poultry|pet\b|livestock|dog|cat|tutor|teacher)\b/i.test(pos);

  if (isClinicalMD && !isNonHumanOrVet) {
    allowedDomains.add('CLINICAL_MD');
  } else {
    excludedDomains.add('CLINICAL_MD');
  }

  // 2b. Allied Healthcare / Medical Writing / Coding / Nutrition
  if (/\b(dietitian|nutritionist|medical coder|medical writer|clinical research|pharmacist|health informatics)\b/i.test(pos) && !isNonHumanOrVet) {
    allowedDomains.add('ALLIED_HEALTHCARE');
  }

  // 3. Finance, Investment & Banking Gatekeeper
  const isFinance = /\b(investor|investment|venture capital|\bvc\b|private equity|\bpe\b|m&a|mergers|banking|investment banker|investment banking|equity research|portfolio manager|cfa|wealth manager|financial analyst|finance director|finance manager|hedge fund|asset management|rates trader|quantitative finance|risk manager|\bcfo\b|chief financial)\b/i.test(pos);
  const isExcludedFromFinance = /\b(lawyer|attorney|counsel|litigat|physician|doctor|veterinar)\b/i.test(pos);

  if (isFinance && !isExcludedFromFinance) {
    allowedDomains.add('FINANCE');
  }

  // 4. AI, Advanced Science & Deep Research Gatekeeper
  const isDeepScience = /\b(research scientist|applied scientist|postdoc|phd researcher|computational physics|ai researcher|machine learning researcher|deep learning researcher|physicist|mathematician|quantum|staff scientist|principal scientist)\b/i.test(pos);
  const isEducationOrTutor = /\b(tutor|elementary|high school|teacher|instructor|trainer|recruiter|sales)\b/i.test(pos);

  if (isDeepScience && !isEducationOrTutor) {
    allowedDomains.add('ADVANCED_SCIENCE');
  }

  // 5. Software & Technical Engineering Gatekeeper
  const isSoftwareEng = /\b(software|developer|engineer|fullstack|frontend|backend|devops|sre|systems engineer|cloud architect|coder|programmer|tech lead|technical lead|cto|chief technology|member of technical staff|\bmts\b|architect|python|java|golang|rust|c\+\+|node|react|android|ios|web3|blockchain|robotics|ml engineer|machine learning engineer)\b/i.test(pos);
  const isExcludedFromEng = /\b(lawyer|attorney|counsel|physician|doctor|veterinar|investor)\b/i.test(pos);

  if (isSoftwareEng && !isExcludedFromEng) {
    allowedDomains.add('ENGINEERING');
  }

  // 6. Data & Analytics Gatekeeper
  if (/\b(data analyst|data scientist|bi analyst|business intelligence|analytics|big data|data engineer|database|tableau|power bi|looker)\b/i.test(pos)) {
    allowedDomains.add('ANALYTICS');
  }

  // 7. Product Management & Strategy / Consulting
  if (/\b(product manager|product owner|product lead|head of product|group product manager|\bcpo\b|product management|management consultant|strategy consultant|mckinsey|bcg|bain|deloitte|strategy director)\b/i.test(pos)) {
    allowedDomains.add('PRODUCT_CONSULTING');
  }

  // 8. Executive Leadership (Founders, C-Level, Partners, VPs, Directors)
  if (/\b(founder|co-founder|ceo|chief executive|managing director|partner|general manager|vp|vice president|director|chief of staff|\bcoo\b|\bcbo\b|president|owner)\b/i.test(pos)) {
    allowedDomains.add('EXECUTIVE');
  }

  // 9. Sales, GTM & Revenue Operations
  if (/\b(sales|account executive|business development|\bbdr\b|\bsdr\b|sales director|sales manager|client partner|key account|revenue operations|revops|crm|salesforce|hubspot|growth lead)\b/i.test(pos)) {
    allowedDomains.add('SALES_REVOPS');
  }

  // 10. Creative, Content, Brand & Media
  if (/\b(marketing|brand|creative|graphic designer|video editor|writer|journalist|editor|copywriter|social media|content|animator|art director|video production|illustrator|voice actor)\b/i.test(pos)) {
    allowedDomains.add('CREATIVE_MARKETING');
  }

  // 11. People, Talent & HR
  if (/\b(recruiter|talent acquisition|talent partner|headhunter|sourcer|human resources|\bhr\b|people ops|hrbp|hr director|recruitment)\b/i.test(pos)) {
    allowedDomains.add('PEOPLE_TALENT');
  }

  // 12. Education & Teaching (Strictly Non-Clinical)
  if (/\b(teacher|professor|instructor|educator|lecturer|tutor|faculty|dean|pedagogy|academic)\b/i.test(pos) && !isClinicalMD) {
    allowedDomains.add('EDUCATION');
  }

  // 13. Operations & Project Management
  if (/\b(operations|program manager|project manager|scrum master|pmp|delivery manager|operations manager)\b/i.test(pos)) {
    allowedDomains.add('OPERATIONS');
  }

  // 14. QA, Testing, Evaluation & General AI Tasks
  if (/\b(qa|quality assurance|tester|test engineer|sdet|evaluator|annotator|transcription|data entry|virtual assistant|support specialist|customer support)\b/i.test(pos)) {
    allowedDomains.add('QA_GENERAL');
  }

  return { allowedDomains, excludedDomains, isLegalCandidate, isClinicalMD, isFinance };
}

// Stage 2: Job Domain Mapping & Eligibility Check
export function isJobEligibleForCandidate(job, candidateClassification, candidateText) {
  const jobName = (job.job_name || '').toLowerCase();
  const { allowedDomains, excludedDomains } = candidateClassification;

  // Language Requirement Check
  const requiredLang = requiresSpecificLanguage(jobName);
  if (requiredLang) {
    const textLower = (candidateText || '').toLowerCase();
    if (!textLower.includes(requiredLang)) {
      return false; // Hard block: doesn't speak required language
    }
  }

  // Check Category Fences:

  // Legal Jobs Fence
  const isLegalJob = /lawyer|attorney|litigat|counsel|legal/i.test(jobName);
  if (isLegalJob) {
    if (excludedDomains.has('LEGAL') || !allowedDomains.has('LEGAL')) {
      return false; // Strictly blocked for non-lawyers
    }
    return true;
  }

  // Clinical MD Healthcare Fence
  const isClinicalMDJob = /physician|hospitalist|doctor of medicine|family medicine physician|pediatric hospitalist|internal medicine hospitalist|primary care physician/i.test(jobName);
  if (isClinicalMDJob) {
    if (excludedDomains.has('CLINICAL_MD') || !allowedDomains.has('CLINICAL_MD')) {
      return false; // Strictly blocked for non-MDs (e.g. Vets, Tutors, Tech)
    }
    return true;
  }

  // Allied Healthcare (Dietitian, Medical Writer, Medical Coder)
  const isAlliedHealthJob = /dietitian|medical writer|medical coder|clinical reviewer/i.test(jobName);
  if (isAlliedHealthJob) {
    if (allowedDomains.has('ALLIED_HEALTHCARE') || allowedDomains.has('CLINICAL_MD')) {
      return true;
    }
    return false;
  }

  // Finance & Banking Jobs
  const isFinanceJob = /investment|m&a|financial|equity research|rates trader|finance specialist|wealth manager|banking/i.test(jobName);
  if (isFinanceJob) {
    if (allowedDomains.has('FINANCE')) return true;
    if (allowedDomains.has('EXECUTIVE')) return true; // Founders/CEOs can match investment/finance
    return false;
  }

  // Advanced Science / Research Jobs
  const isScienceJob = /research scientist|physics expert|computational physics/i.test(jobName);
  if (isScienceJob) {
    if (allowedDomains.has('ADVANCED_SCIENCE')) return true;
    return false;
  }

  // Software / Engineering Jobs
  const isEngJob = /software|developer|engineer|coder|coding|ml engineer|robotics|solutions architect/i.test(jobName);
  if (isEngJob) {
    if (allowedDomains.has('ENGINEERING')) return true;
    return false;
  }

  // Analytics Jobs
  const isAnalyticsJob = /data analyst|data scientist|big data|database|analytics/i.test(jobName);
  if (isAnalyticsJob) {
    if (allowedDomains.has('ANALYTICS') || allowedDomains.has('ENGINEERING') || allowedDomains.has('ADVANCED_SCIENCE')) return true;
    return false;
  }

  // Product & Strategy / Consulting Jobs
  const isConsultingJob = /management consultant|strategic project lead|product owner|enterprise client partner/i.test(jobName);
  if (isConsultingJob) {
    if (allowedDomains.has('PRODUCT_CONSULTING') || allowedDomains.has('EXECUTIVE') || allowedDomains.has('FINANCE')) return true;
    return false;
  }

  // Sales / RevOps Jobs
  const isSalesJob = /sales|revenue operations|revenue systems|enterprise client partner|data partnerships/i.test(jobName);
  if (isSalesJob) {
    if (allowedDomains.has('SALES_REVOPS') || allowedDomains.has('EXECUTIVE')) return true;
    return false;
  }

  // Creative & Marketing Jobs
  const isCreativeJob = /brand|creative|graphic designer|video editor|journalist|writer|editor|video content|visual/i.test(jobName);
  if (isCreativeJob) {
    if (allowedDomains.has('CREATIVE_MARKETING')) return true;
    return false;
  }

  // People & Talent Jobs
  const isTalentJob = /recruiter|recruitment|community manager|human data/i.test(jobName);
  if (isTalentJob) {
    if (allowedDomains.has('PEOPLE_TALENT') || allowedDomains.has('OPERATIONS')) return true;
    return false;
  }

  // Education Jobs
  const isEduJob = /educator|english teacher|assessor writer|trainer/i.test(jobName);
  if (isEduJob) {
    if (allowedDomains.has('EDUCATION')) return true;
    return false;
  }

  // QA, Testing & General Evaluation
  const isQaJob = /qa engineer|usability tester|ai agent evaluator|tester|evaluator|annotation|reviewer/i.test(jobName);
  if (isQaJob) {
    if (allowedDomains.has('QA_GENERAL') || allowedDomains.has('ENGINEERING') || allowedDomains.has('EDUCATION')) return true;
    return false;
  }

  return false;
}

// Stage 2: Multi-Factor Scoring Engine
export function calculateJobMatchScore(job, candidate, candidateClassification) {
  const pos = (candidate.position || '').toLowerCase();
  const jobTitle = (job.job_name || '').toLowerCase();
  const reward = Number(job.referral_reward_amount || job.reward || 0);
  const openings = Number(job.no_of_openings || 0);

  // 1. Title Similarity Score (S_title, 55% weight)
  const stopWords = new Set(['the', 'and', 'of', 'in', 'for', 'at', 'a', 'to', 'or', 'firm', 'firms', 'llp', 'inc', 'corp', 'ltd']);
  const posWords = pos.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const jobWords = jobTitle.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  const posSet = new Set(posWords);
  const jobSet = new Set(jobWords);

  let matchCount = 0;
  for (const pw of posSet) {
    if (jobSet.has(pw)) matchCount++;
  }

  const minLen = Math.min(posSet.size, jobSet.size);
  const matchRatio = minLen > 0 ? matchCount / minLen : 0;

  let sTitle = 40; // baseline
  if (matchRatio >= 0.75 && matchCount >= 2) {
    sTitle = 100; // Perfect full title match
  } else if (matchRatio >= 0.5 && matchCount >= 2) {
    sTitle = 92;
  } else if (matchCount >= 2) {
    sTitle = 85;
  } else if (matchCount === 1) {
    sTitle = 75;
  }

  // Specific specialization keywords (e.g., immigration, litigation, m&a, tax, robotics)
  const specializations = [
    'immigration', 'litigat', 'corporate', 'patent', 'bankruptcy', 'tax', 'audit',
    'robotics', 'frontend', 'backend', 'fullstack', 'machine learning', 'devops',
    'pediatric', 'internal medicine', 'family medicine', 'hospitalist', 'psychiatrist'
  ];

  let candSpecialization = null;
  for (const spec of specializations) {
    if (pos.includes(spec)) {
      candSpecialization = spec;
      break;
    }
  }

  if (candSpecialization) {
    if (jobTitle.includes(candSpecialization)) {
      // Direct specialization match
      sTitle = Math.max(sTitle, 98);
    } else {
      // Specialization mismatch (e.g. candidate is Immigration, job is Litigation)
      sTitle = Math.min(sTitle, 75);
    }
  }

  // Key Domain Synonyms (when within same broad domain)
  if ((pos.includes('investor') || pos.includes('venture capital') || pos.includes('private equity')) &&
      (jobTitle.includes('investment') || jobTitle.includes('m&a') || jobTitle.includes('finance'))) {
    sTitle = Math.max(sTitle, 90);
  }
  if ((pos.includes('attorney') || pos.includes('lawyer') || pos.includes('counsel')) &&
      (jobTitle.includes('attorney') || jobTitle.includes('lawyer') || jobTitle.includes('biglaw'))) {
    sTitle = Math.max(sTitle, 80);
  }
  if ((pos.includes('physician') || pos.includes('hospitalist') || pos.includes('doctor')) &&
      (jobTitle.includes('physician') || jobTitle.includes('hospitalist') || jobTitle.includes('medical doctor'))) {
    sTitle = Math.max(sTitle, 90);
  }
  if ((pos.includes('software engineer') || pos.includes('developer') || pos.includes('coder')) &&
      (jobTitle.includes('software engineer') || jobTitle.includes('developer'))) {
    sTitle = Math.max(sTitle, 90);
  }
  if ((pos.includes('data scientist') || pos.includes('machine learning')) &&
      (jobTitle.includes('data scientist') || jobTitle.includes('ml engineer'))) {
    sTitle = Math.max(sTitle, 90);
  }
  if ((pos.includes('recruiter') || pos.includes('talent')) &&
      (jobTitle.includes('recruiter') || jobTitle.includes('talent') || jobTitle.includes('community manager'))) {
    sTitle = Math.max(sTitle, 85);
  }

  // 2. Seniority Alignment Score (S_seniority, 20% weight)
  const candSeniority = detectSeniority(pos);
  const jobSeniority = detectSeniority(jobTitle);
  const seniorityDiff = Math.abs(candSeniority.level - jobSeniority.level);

  let sSeniority = 100;
  if (seniorityDiff === 1) sSeniority = 80;
  else if (seniorityDiff === 2) sSeniority = 50;
  else if (seniorityDiff >= 3) sSeniority = 20;

  // 3. Bounty Tier Score (S_bounty, 15% weight)
  let sBounty = 15;
  if (reward >= 3000) sBounty = 100;
  else if (reward >= 2000) sBounty = 80;
  else if (reward >= 1500) sBounty = 65;
  else if (reward >= 1000) sBounty = 50;
  else if (reward >= 500) sBounty = 35;
  else if (reward >= 300) sBounty = 25;

  // 4. Openings / Liquidity Score (S_openings, 10% weight)
  let sOpenings = 25;
  if (openings >= 50) sOpenings = 100;
  else if (openings >= 20) sOpenings = 80;
  else if (openings >= 10) sOpenings = 60;
  else if (openings >= 2) sOpenings = 40;

  // Composite Weighted Score
  const finalScore = (sTitle * 0.55) + (sSeniority * 0.20) + (sBounty * 0.15) + (sOpenings * 0.10);

  return {
    finalScore: Math.round(finalScore * 10) / 10,
    sTitle,
    sSeniority,
    sBounty,
    sOpenings,
    seniorityLabel: candSeniority.label
  };
}

// Master Matcher for a Candidate
export function matchCandidate(candidate, allJobs, rateMap = new Map()) {
  const pos = candidate.position || '';
  const comp = candidate.company || '';
  const candidateText = `${pos} ${comp}`.trim();

  if (!candidateText || pos.trim().length === 0) {
    return { topMatch: null, runnerUps: [], allEligible: [] };
  }

  const classification = classifyCandidateDomain(pos, comp);
  if (classification.allowedDomains.size === 0) {
    return { topMatch: null, runnerUps: [], allEligible: [] };
  }

  const eligibleScoredJobs = [];

  for (const job of allJobs) {
    if (!isJobEligibleForCandidate(job, classification, candidateText)) {
      continue;
    }

    const rates = rateMap.get(job.job_id) || getJobAccurateRate(job);
    const scoreObj = calculateJobMatchScore(job, candidate, classification);

    // Build human-readable rationale
    const rationale = `Fit: ${scoreObj.finalScore}% (${scoreObj.seniorityLabel}) · $${job.referral_reward_amount} Bounty`;

    eligibleScoredJobs.push({
      id: job.job_id,
      name: job.job_name,
      reward: Number(job.referral_reward_amount || 0),
      openings: Number(job.no_of_openings || 0),
      url: job.referral_url,
      rate_min: rates.min,
      rate_max: rates.max,
      rate_inr_min: Math.round(rates.min * 84),
      rate_inr_max: Math.round(rates.max * 84),
      match_score: scoreObj.finalScore,
      match_rationale: rationale
    });
  }

  // Sort strictly by Final Composite Score DESC, then reward DESC, then openings DESC
  eligibleScoredJobs.sort((a, b) => (b.match_score - a.match_score) || (b.reward - a.reward) || (b.openings - a.openings));

  const topMatch = eligibleScoredJobs.length > 0 ? eligibleScoredJobs[0] : null;
  const runnerUps = eligibleScoredJobs.slice(1, 4); // Next top 3 alternatives

  return {
    topMatch,
    runnerUps,
    allEligible: eligibleScoredJobs
  };
}
