
-- Add weekdays and month_day columns to task_auto_duplications
ALTER TABLE public.task_auto_duplications 
ADD COLUMN weekdays integer[] DEFAULT NULL,
ADD COLUMN month_day integer DEFAULT NULL;
