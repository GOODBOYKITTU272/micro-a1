-- Supabase Schema for micro1 Referral Hub
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  referral_reward_amount NUMERIC DEFAULT 0,
  no_of_openings INTEGER DEFAULT 0,
  ideal_hourly_rate_min NUMERIC,
  ideal_hourly_rate_max NUMERIC,
  skills JSONB DEFAULT '[]'::jsonb,
  is_high_demand INTEGER DEFAULT 0,
  referral_url TEXT NOT NULL,
  job_description TEXT,
  location TEXT DEFAULT 'Remote (Global)',
  date_posted TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_referrals (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT,
  job_name TEXT,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_linkedin TEXT,
  status TEXT DEFAULT 'Contacted',
  reward_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connections (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  linkedin_url TEXT,
  email TEXT,
  company TEXT,
  position TEXT,
  connected_on TEXT,
  matched_jobs JSONB DEFAULT '[]'::jsonb,
  match_count INTEGER DEFAULT 0,
  max_potential_earnings NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'New',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_reward ON jobs(referral_reward_amount);
CREATE INDEX IF NOT EXISTS idx_jobs_high_demand ON jobs(is_high_demand);
CREATE INDEX IF NOT EXISTS idx_conn_earnings ON connections(max_potential_earnings);
CREATE INDEX IF NOT EXISTS idx_conn_matches ON connections(match_count);
CREATE INDEX IF NOT EXISTS idx_conn_status ON connections(status);

-- Enable Row Level Security (RLS) but allow public read/write with anon key for this hub
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Allow service role all jobs" ON jobs FOR ALL USING (true);

CREATE POLICY "Allow public read candidate_referrals" ON candidate_referrals FOR SELECT USING (true);
CREATE POLICY "Allow public insert candidate_referrals" ON candidate_referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update candidate_referrals" ON candidate_referrals FOR UPDATE USING (true);
CREATE POLICY "Allow public delete candidate_referrals" ON candidate_referrals FOR DELETE USING (true);

CREATE POLICY "Allow public read connections" ON connections FOR SELECT USING (true);
CREATE POLICY "Allow public insert connections" ON connections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update connections" ON connections FOR UPDATE USING (true);
CREATE POLICY "Allow public delete connections" ON connections FOR DELETE USING (true);
