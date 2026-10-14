import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3333;

const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wajjvsbkgbuyjkdsnhmc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamp2c2JrZ2J1eWprZHNuaG1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk3ODMyMSwiZXhwIjoyMTA3NTU0MzIxfQ.jqzV2bWyqOwPlMk7x1RneX-Noi9ap1huC5YDuGRhY9M';

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function supabaseFetch(endpoint, options = {}) {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers
  });
}

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

let jobRateCache = null;
let lastCacheTime = 0;

async function getJobRateMap() {
  const now = Date.now();
  if (jobRateCache && (now - lastCacheTime < 300000)) {
    return jobRateCache;
  }
  try {
    const res = await supabaseFetch('jobs?select=job_id,job_name,referral_reward_amount,ideal_hourly_rate_min,ideal_hourly_rate_max');
    const jobs = await res.json();
    const map = new Map();
    if (Array.isArray(jobs)) {
      jobs.forEach(j => {
        map.set(j.job_id, getJobAccurateRate(j));
      });
    }
    jobRateCache = map;
    lastCacheTime = now;
    return map;
  } catch (err) {
    return new Map();
  }
}

// Main Request Handler
export async function appHandler(req, res) {
  const method = req.method;

  // Handle CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  try {
    // 1. Connection Stats
    if (method === 'GET' && pathname === '/api/connections/stats') {
      const r = await supabaseFetch('rpc/get_connection_stats', { method: 'POST' });
      const stats = await r.json();
      return sendJson(res, 200, stats);
    }

    // 2. Hub Stats (Jobs & Referrals)
    if (method === 'GET' && pathname === '/api/stats') {
      const r = await supabaseFetch('rpc/get_hub_stats', { method: 'POST' });
      const stats = await r.json();
      return sendJson(res, 200, stats);
    }

    // 3. Connections List & Filter
    if (method === 'GET' && pathname === '/api/connections') {
      const q = searchParams.get('q');
      const minEarnings = searchParams.get('min_earnings');
      const topMatchOnly = searchParams.get('top_match_only') !== 'false';
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      const params = new URLSearchParams();
      params.set('order', 'max_potential_earnings.desc,match_count.desc,id.asc');
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      if (topMatchOnly) {
        params.set('match_count', 'gt.0');
      }

      if (minEarnings && !isNaN(minEarnings)) {
        params.set('max_potential_earnings', `gte.${minEarnings}`);
      }

      if (q && q.trim()) {
        const term = q.trim();
        params.set('or', `(full_name.ilike.*${term}*,position.ilike.*${term}*,company.ilike.*${term}*)`);
      }

      const r = await supabaseFetch(`connections?${params.toString()}`);
      const data = await r.json();
      const rateMap = await getJobRateMap();
      const enriched = (Array.isArray(data) ? data : []).map(c => {
        const jobs = Array.isArray(c.matched_jobs) ? c.matched_jobs : [];
        return {
          ...c,
          matched_jobs: jobs.map(j => {
            const rates = rateMap.get(j.id);
            return {
              ...j,
              rate_min: j.rate_min || rates?.min || null,
              rate_max: j.rate_max || rates?.max || null
            };
          })
        };
      });
      return sendJson(res, 200, enriched);
    }

    // 4. Update Connection (Status/Notes)
    if (method === 'PATCH' && pathname.startsWith('/api/connections/')) {
      const id = pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const updateData = {};
      if (body.status !== undefined) updateData.status = body.status;
      if (body.notes !== undefined) updateData.notes = body.notes;

      const r = await supabaseFetch(`connections?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      return sendJson(res, 200, { success: r.ok });
    }

    // 5. Delete Connection
    if (method === 'DELETE' && pathname.startsWith('/api/connections/')) {
      const id = pathname.split('/').pop();
      const r = await supabaseFetch(`connections?id=eq.${id}`, {
        method: 'DELETE'
      });
      return sendJson(res, 200, { success: r.ok });
    }

    // 6. Jobs List & Filter
    if (method === 'GET' && pathname === '/api/jobs') {
      const q = searchParams.get('q');
      const minReward = searchParams.get('min_reward');
      const highDemand = searchParams.get('high_demand');
      const location = searchParams.get('location');
      const sort = searchParams.get('sort') || 'reward_desc';
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);

      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      switch (sort) {
        case 'reward_desc':
          params.set('order', 'referral_reward_amount.desc,no_of_openings.desc');
          break;
        case 'reward_asc':
          params.set('order', 'referral_reward_amount.asc');
          break;
        case 'openings_desc':
          params.set('order', 'no_of_openings.desc,referral_reward_amount.desc');
          break;
        case 'newest':
          params.set('order', 'date_posted.desc.nullslast');
          break;
        default:
          params.set('order', 'referral_reward_amount.desc');
      }

      if (q && q.trim()) {
        const term = q.trim();
        params.set('or', `(job_name.ilike.*${term}*,location.ilike.*${term}*)`);
      }

      if (minReward && !isNaN(minReward)) {
        params.set('referral_reward_amount', `gte.${minReward}`);
      }

      if (highDemand === 'true' || highDemand === '1' || highDemand === true) {
        params.set('is_high_demand', 'eq.1');
      }

      if (location && location.trim()) {
        if (location === 'US') {
          params.set('or', '(location.ilike.*US*,location.ilike.*United States*)');
        } else if (location === 'Global') {
          params.set('or', '(location.ilike.*Global*,location.ilike.*Worldwide*,location.eq.Remote (Global))');
        } else {
          params.set('location', `ilike.*${location.trim()}*`);
        }
      }

      const r = await supabaseFetch(`jobs?${params.toString()}`);
      const data = await r.json();
      return sendJson(res, 200, Array.isArray(data) ? data : []);
    }

    // 7. Candidate Referrals List
    if (method === 'GET' && pathname === '/api/referrals') {
      const r = await supabaseFetch('candidate_referrals?order=created_at.desc');
      const data = await r.json();
      return sendJson(res, 200, Array.isArray(data) ? data : []);
    }

    // 8. Add Candidate Referral
    if (method === 'POST' && pathname === '/api/referrals') {
      const body = await parseJsonBody(req);
      const r = await supabaseFetch('candidate_referrals', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          job_id: body.jobId || '',
          job_name: body.jobName || '',
          candidate_name: body.candidateName || '',
          candidate_email: body.candidateEmail || '',
          candidate_linkedin: body.candidateLinkedin || '',
          status: body.status || 'Contacted',
          reward_amount: parseFloat(body.rewardAmount) || 0,
          notes: body.notes || ''
        })
      });
      const data = await r.json();
      return sendJson(res, 201, data[0] || { success: true });
    }

    // 9. Update Candidate Referral
    if (method === 'PATCH' && pathname.startsWith('/api/referrals/')) {
      const id = pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const updateData = {};
      if (body.status !== undefined) updateData.status = body.status;
      if (body.notes !== undefined) updateData.notes = body.notes;
      updateData.updated_at = new Date().toISOString();

      const r = await supabaseFetch(`candidate_referrals?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
      return sendJson(res, 200, { success: r.ok });
    }

    // 10. Delete Candidate Referral
    if (method === 'DELETE' && pathname.startsWith('/api/referrals/')) {
      const id = pathname.split('/').pop();
      const r = await supabaseFetch(`candidate_referrals?id=eq.${id}`, {
        method: 'DELETE'
      });
      return sendJson(res, 200, { success: r.ok });
    }

    // 11. URL Shortener
    if (method === 'GET' && pathname === '/api/shorten') {
      const rawUrl = searchParams.get('url');
      if (!rawUrl) return sendJson(res, 400, { error: 'url parameter is required' });
      const cleanUrl = rawUrl.replace(/&utm_[^&]+/g, '').replace(/\?utm_[^&]+&/, '?');

      try {
        const tRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(cleanUrl)}`);
        if (tRes.ok) {
          const short = (await tRes.text()).trim();
          if (short.startsWith('http')) {
            return sendJson(res, 200, { shortUrl: short });
          }
        }
      } catch (e) {
        // Fallback to cleanUrl
      }
      return sendJson(res, 200, { shortUrl: cleanUrl });
    }

    // 12. Frontend UI
    if ((method === 'GET' || method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(INDEX_HTML)
      });
      if (method === 'HEAD') return res.end();
      return res.end(INDEX_HTML);
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message });
  }
}

// Default export for Vercel Serverless Function
export default appHandler;

// Standalone runner for local development
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  const server = http.createServer(appHandler);
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 micro1 Referral Hub is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`☁️ Supabase: Connected to ${SUPABASE_URL}`);
    console.log(`======================================================\n`);
  });
}
