-- ============================================================================
-- Migration: Add Production Triggers for Automations
-- ============================================================================

-- 1. Config Validation Trigger
DROP TRIGGER IF EXISTS check_automation_rule_config ON automation_rules;
CREATE TRIGGER check_automation_rule_config
  BEFORE INSERT OR UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION validate_automation_rule_config();

-- 2. Auto-Seed Trigger Function
CREATE OR REPLACE FUNCTION on_business_created_seed_automation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_automation_rules(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Auto-Seed Trigger
DROP TRIGGER IF EXISTS seed_automation_rules_on_business ON businesses;
CREATE TRIGGER seed_automation_rules_on_business
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION on_business_created_seed_automation();

-- 4. Backfill existing businesses without rules
DO $$
DECLARE
  v_business RECORD;
BEGIN
  FOR v_business IN 
    SELECT id FROM businesses 
    WHERE id NOT IN (SELECT DISTINCT business_id FROM automation_rules)
  LOOP
    PERFORM seed_default_automation_rules(v_business.id);
  END LOOP;
END;
$$;