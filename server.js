import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDb,
  syncAllJobs,
  getJobs,
  getStats,
  getCandidateReferrals,
  addCandidateReferral,
  updateCandidateReferral,
  deleteCandidateReferral,
  getConnections,
  getConnectionStats,
  updateConnection
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3333;

// Initialize SQLite database
initDb();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // API: Stats
    if (method === 'GET' && pathname === '/api/stats') {
      const stats = getStats();
      return sendJson(res, 200, stats);
    }

    // API: Jobs Query
    if (method === 'GET' && pathname === '/api/jobs') {
      const q = parsedUrl.searchParams.get('q');
      const minReward = parsedUrl.searchParams.get('min_reward');
      const highDemand = parsedUrl.searchParams.get('high_demand');
      const location = parsedUrl.searchParams.get('location');
      const sort = parsedUrl.searchParams.get('sort') || 'reward_desc';
      const limit = parsedUrl.searchParams.get('limit') || 100;
      const offset = parsedUrl.searchParams.get('offset') || 0;

      const jobs = getJobs({ q, minReward, highDemand, location, sort, limit, offset });
      return sendJson(res, 200, jobs);
    }

    // API: Sync from micro1
    if (method === 'POST' && pathname === '/api/sync') {
      const result = await syncAllJobs();
      return sendJson(res, 200, result);
    }

    // API: Candidate Referrals List
    if (method === 'GET' && pathname === '/api/referrals') {
      const referrals = getCandidateReferrals();
      return sendJson(res, 200, referrals);
    }

    // API: Add Candidate Referral
    if (method === 'POST' && pathname === '/api/referrals') {
      const body = await parseJsonBody(req);
      const result = addCandidateReferral(body);
      return sendJson(res, 201, result);
    }

    // API: Update Candidate Referral
    if (method === 'PATCH' && pathname.startsWith('/api/referrals/')) {
      const id = pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const result = updateCandidateReferral(id, body);
      return sendJson(res, 200, result);
    }

    // API: Delete Candidate Referral
    if (method === 'DELETE' && pathname.startsWith('/api/referrals/')) {
      const id = pathname.split('/').pop();
      const result = deleteCandidateReferral(id);
      return sendJson(res, 200, result);
    }

    // API: Connections Stats
    if (method === 'GET' && pathname === '/api/connections/stats') {
      const stats = getConnectionStats();
      return sendJson(res, 200, stats);
    }

    // API: Connections Query
    if (method === 'GET' && pathname === '/api/connections') {
      const q = parsedUrl.searchParams.get('q');
      const minEarnings = parsedUrl.searchParams.get('min_earnings');
      const topMatchOnly = parsedUrl.searchParams.get('top_match_only') !== 'false';
      const limit = parsedUrl.searchParams.get('limit') || 50;
      const offset = parsedUrl.searchParams.get('offset') || 0;

      const connections = getConnections({ q, minEarnings, topMatchOnly, limit, offset });
      return sendJson(res, 200, connections);
    }

    // API: Update Connection Status
    if (method === 'PATCH' && pathname.startsWith('/api/connections/')) {
      const id = pathname.split('/').pop();
      const body = await parseJsonBody(req);
      const result = updateConnection(id, body);
      return sendJson(res, 200, result);
    }

    // API: URL Shortener
    if (method === 'GET' && pathname === '/api/shorten') {
      const rawUrl = parsedUrl.searchParams.get('url');
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

    // Static Frontend: index.html
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const htmlPath = path.join(__dirname, 'public', 'index.html');
      const content = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(content);
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 micro1 Referral Hub is running locally!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📦 Database: referrals.db (SQLite)`);
  console.log(`🔑 Micro1 API Key: loaded from .env`);
  console.log(`======================================================\n`);
});
