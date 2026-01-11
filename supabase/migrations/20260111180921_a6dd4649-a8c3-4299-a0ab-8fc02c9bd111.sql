-- Add missing get_subscription_stats RPC function for dashboard
CREATE OR REPLACE FUNCTION get_subscription_stats(p_business_id uuid)
RETURNS TABLE (
  active_count bigint,
  paused_count bigint,
  monthly_recurring_revenue numeric,
  upcoming_services_count bigint,
  pending_invoices_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM subscriptions WHERE business_id = p_business_id AND status = 'active'),
    (SELECT COUNT(*) FROM subscriptions WHERE business_id = p_business_id AND status = 'paused'),
    (SELECT COALESCE(SUM(price), 0) FROM subscriptions WHERE business_id = p_business_id AND status = 'active'),
    (SELECT COUNT(*) FROM subscription_schedules ss 
     JOIN subscriptions s ON ss.subscription_id = s.id 
     WHERE s.business_id = p_business_id AND ss.status = 'pending' AND ss.scheduled_date <= CURRENT_DATE + 14),
    (SELECT COUNT(*) FROM invoices WHERE business_id = p_business_id AND is_subscription_invoice = true AND status = 'sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_subscription_stats(uuid) TO authenticated;