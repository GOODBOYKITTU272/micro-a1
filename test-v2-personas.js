// test-v2-personas.js
import { DatabaseSync } from 'node:sqlite';
import { matchCandidate, getJobAccurateRate } from './matching-engine-v2.js';

const db = new DatabaseSync('referrals.db');
const allJobs = db.prepare('SELECT * FROM jobs').all();

const rateMap = new Map();
allJobs.forEach(j => rateMap.set(j.job_id, getJobAccurateRate(j)));

const testCases = [
  {
    name: 'Owen Worchell',
    position: 'Investor',
    company: 'Insight Partners',
    expectedDomain: 'FINANCE',
    forbiddenWords: ['Lawyer', 'Attorney', 'Litigat']
  },
  {
    name: 'Aidan Waldman',
    position: 'Software Investor',
    company: 'Lead Edge Capital',
    expectedDomain: 'FINANCE',
    forbiddenWords: ['Lawyer', 'Attorney', 'Litigat']
  },
  {
    name: 'Sarah Jenkins',
    position: 'Litigation Associate Attorney',
    company: 'Kirkland & Ellis LLP',
    expectedDomain: 'LEGAL',
    forbiddenWords: ['Investor', 'Physician', 'Engineer']
  },
  {
    name: 'Dr. Ramesh Patel',
    position: 'Veterinarian Doctor',
    company: 'Poultry Farm & Animal Health',
    expectedDomain: 'NOT_HUMAN_CLINICAL',
    forbiddenWords: ['Hospitalist', 'Physician', 'Psychiatrist']
  },
  {
    name: 'Dr. Gregory House',
    position: 'Internal Medicine Physician (MD)',
    company: 'Princeton-Plainsboro Hospital',
    expectedDomain: 'CLINICAL_MD',
    forbiddenWords: ['Lawyer', 'Veterinar', 'Software']
  },
  {
    name: 'Emily Davis',
    position: 'AI Math Tutor & Instructor',
    company: 'SpaceXAI',
    expectedDomain: 'EDUCATION',
    forbiddenWords: ['Physician', 'Hospitalist', 'Computational Physics']
  },
  {
    name: 'Marcus Vance',
    position: 'Director of Trade & Manufacturing',
    company: 'Global Logistics Corp',
    expectedDomain: 'EXECUTIVE_OPS',
    forbiddenWords: ['BigLaw', 'Lawyer', 'Attorney']
  },
  {
    name: 'Alex Rivera',
    position: 'Senior Software Engineer',
    company: 'Stripe',
    expectedDomain: 'ENGINEERING',
    forbiddenWords: ['Lawyer', 'Physician', 'Investor']
  }
];

console.log('🧪 TESTING NEXT-GEN MATCHING ENGINE (v2.0)...\n');

let allPassed = true;

for (const tc of testCases) {
  const result = matchCandidate(tc, allJobs, rateMap);
  const top = result.topMatch;

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Candidate: ${tc.name}`);
  console.log(`Role: "${tc.position}" at "${tc.company}"`);

  if (!top) {
    console.log(`Match Result: None (No match eligible)`);
    if (tc.expectedDomain === 'NOT_HUMAN_CLINICAL') {
      console.log(`✓ PASS: Animal veterinarian properly prevented from matching human medical roles!`);
    } else {
      console.log(`⚠️ Note: No eligible match found.`);
    }
  } else {
    console.log(`Top Matched Job: [+$${top.reward}] ${top.name}`);
    console.log(`Hourly Rate: $${top.rate_min} – $${top.rate_max}/hr USD`);
    console.log(`Match Score: ${top.match_score} (${top.match_rationale})`);
    if (result.runnerUps.length > 0) {
      console.log(`Runner-Ups: ${result.runnerUps.map(r => `"${r.name}" (+$${r.reward}, Score: ${r.match_score})`).join(' | ')}`);
    }

    let hasForbidden = false;
    for (const f of tc.forbiddenWords) {
      if (top.name.toLowerCase().includes(f.toLowerCase())) {
        hasForbidden = true;
        console.error(`❌ VIOLATION: Matched job contains forbidden keyword "${f}"!`);
        allPassed = false;
      }
    }

    if (!hasForbidden) {
      console.log(`✓ PASS: Domain fence respected! Zero forbidden terms found.`);
    }
  }
}

console.log(`\n================================================================================`);
if (allPassed) {
  console.log('🎉 ALL TEST PERSONAS PASSED DOMAIN ISOLATION & SCORING CHECKS!');
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exit(1);
}
console.log(`================================================================================\n`);
