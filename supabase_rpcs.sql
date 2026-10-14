DROP FUNCTION IF EXISTS get_hub_stats();

CREATE OR REPLACE FUNCTION get_hub_stats()
RETURNS jsonb AS $$
DECLARE
  jobs_stat jsonb;
  ref_stat jsonb;
  locations_stat jsonb;
  last_sync timestamptz;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'totalOpenings', COALESCE(SUM(no_of_openings), 0),
    'maxReward', COALESCE(MAX(referral_reward_amount), 0),
    'avgReward', COALESCE(ROUND(AVG(referral_reward_amount)), 0),
    'highDemandCount', COUNT(*) FILTER (WHERE is_high_demand = 1),
    'totalRewardPool', COALESCE(SUM(referral_reward_amount * no_of_openings), 0)
  ) INTO jobs_stat FROM jobs;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'contacted', COUNT(*) FILTER (WHERE status = 'Contacted'),
    'applied', COUNT(*) FILTER (WHERE status = 'Applied'),
    'interviewing', COUNT(*) FILTER (WHERE status = 'Interviewing'),
    'hired', COUNT(*) FILTER (WHERE status = 'Hired & Paid'),
    'earned', COALESCE(SUM(reward_amount) FILTER (WHERE status = 'Hired & Paid'), 0),
    'pendingPotential', COALESCE(SUM(reward_amount) FILTER (WHERE status != 'Rejected' AND status != 'Hired & Paid'), 0)
  ) INTO ref_stat FROM candidate_referrals;

  SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) INTO locations_stat FROM (
    SELECT location, COUNT(*) as count FROM jobs GROUP BY location ORDER BY count DESC
  ) l;

  SELECT MAX(synced_at) INTO last_sync FROM jobs;

  RETURN jsonb_build_object(
    'jobs', jobs_stat || jsonb_build_object('lastSyncedAt', last_sync, 'locations', locations_stat),
    'referrals', ref_stat
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_hub_stats() TO anon, service_role, authenticated;
