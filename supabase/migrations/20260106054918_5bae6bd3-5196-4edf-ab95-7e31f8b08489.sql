-- Add missing stats columns to sequence_steps
ALTER TABLE public.sequence_steps 
ADD COLUMN IF NOT EXISTS total_sent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_opened integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_clicked integer DEFAULT 0;