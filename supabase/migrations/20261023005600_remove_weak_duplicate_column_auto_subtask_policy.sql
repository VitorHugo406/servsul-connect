-- Remove a duplicate permissive INSERT policy whose predicate omitted the explicit tenant join.
DROP POLICY IF EXISTS "Board members can insert column auto subtasks" ON public.column_auto_subtasks;
