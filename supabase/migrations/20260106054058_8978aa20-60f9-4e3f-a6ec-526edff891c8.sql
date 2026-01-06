-- Create triggers for auto-enrollment in email sequences

-- Trigger for new customers
CREATE TRIGGER trigger_enrollment_on_customer_created
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sequence_enrollment();

-- Trigger for quote status changes (sent, accepted)
CREATE TRIGGER trigger_enrollment_on_quote_status
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_sequence_enrollment();

-- Trigger for job completion
CREATE TRIGGER trigger_enrollment_on_job_completed
  AFTER UPDATE ON jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION trigger_sequence_enrollment();

-- Trigger for invoice payment
CREATE TRIGGER trigger_enrollment_on_invoice_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid')
  EXECUTE FUNCTION trigger_sequence_enrollment();