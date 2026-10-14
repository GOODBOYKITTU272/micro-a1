const SUPABASE_URL = 'https://wajjvsbkgbuyjkdsnhmc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhamp2c2JrZ2J1eWprZHNuaG1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTk3ODMyMSwiZXhwIjoyMTA3NTU0MzIxfQ.jqzV2bWyqOwPlMk7x1RneX-Noi9ap1huC5YDuGRhY9M';

async function run() {
  console.log('Fetching jobs for rate map...');
  const jRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=job_id,ideal_hourly_rate_min,ideal_hourly_rate_max`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const jobs = await jRes.json();
  const rateMap = new Map();
  jobs.forEach(j => {
    rateMap.set(j.job_id, { min: j.ideal_hourly_rate_min, max: j.ideal_hourly_rate_max });
  });

  console.log('Fetching matched connections...');
  const cRes = await fetch(`${SUPABASE_URL}/rest/v1/connections?match_count=gt.0&select=id,matched_jobs`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });
  const conns = await cRes.json();
  console.log(`Found ${conns.length} matched connections to enrich with hourly rates.`);

  const updates = conns.map(c => {
    const list = Array.isArray(c.matched_jobs) ? c.matched_jobs : [];
    const enriched = list.map(item => {
      const r = rateMap.get(item.id);
      return {
        ...item,
        rate_min: r?.min || null,
        rate_max: r?.max || null
      };
    });
    return {
      id: c.id,
      matched_jobs: enriched
    };
  });

  // Batch update using merge-duplicates
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    const uRes = await fetch(`${SUPABASE_URL}/rest/v1/connections`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(chunk)
    });
    if (!uRes.ok) {
      throw new Error(`Batch update failed: ${await uRes.text()}`);
    }
    console.log(`Enriched ${Math.min(i + 200, updates.length)}/${updates.length} connections.`);
  }
  console.log('Done enriching matched_jobs with pay rates in Supabase!');
}

run().catch(console.error);
