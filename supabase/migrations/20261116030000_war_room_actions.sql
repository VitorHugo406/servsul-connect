-- War Room v2: plano de ação (timeline) com responsável/duração, card emergencial ligado à sala.
--  * A sala manda no card: título, descrição e prazo vêm da sala; as subtarefas do card SÃO as ações da timeline.
--  * Concluir uma subtarefa no card conclui a ação na sala (e o contrário).
--  * Encerrar a sala move o card para a coluna de concluídos do quadro.
--  * Enquanto a sala está ativa o card não pode ser alterado (só dá para concluir as subtarefas).
ALTER TABLE public.war_rooms
  ADD COLUMN IF NOT EXISTS target_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_board_id uuid REFERENCES public.task_boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emergency_column_id uuid REFERENCES public.task_board_columns(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.war_room_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id uuid NOT NULL REFERENCES public.war_rooms(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_min integer NOT NULL DEFAULT 15 CHECK (duration_min BETWEEN 1 AND 10080),
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subtask_id uuid REFERENCES public.task_subtasks(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS war_rooms_task_idx ON public.war_rooms (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS war_room_actions_room_idx ON public.war_room_actions (war_room_id, position);
CREATE INDEX IF NOT EXISTS war_room_actions_subtask_idx ON public.war_room_actions (subtask_id) WHERE subtask_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_company_id_default ON public.war_room_actions;
CREATE TRIGGER set_company_id_default BEFORE INSERT ON public.war_room_actions FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
DROP TRIGGER IF EXISTS update_war_room_actions_updated_at ON public.war_room_actions;
CREATE TRIGGER update_war_room_actions_updated_at BEFORE UPDATE ON public.war_room_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quem manda na sala (criador ou admin da empresa)
CREATE OR REPLACE FUNCTION public.war_room_can_manage(_room uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.war_rooms wr
    WHERE wr.id = _room AND public.same_company(wr.company_id) AND (wr.created_by = auth.uid() OR public.is_admin())
  )
$$;
REVOKE ALL ON FUNCTION public.war_room_can_manage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.war_room_can_manage(uuid) TO authenticated;

ALTER TABLE public.war_room_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.war_room_actions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.war_room_actions TO authenticated;
DROP POLICY IF EXISTS "War room actions visible to the room" ON public.war_room_actions;
CREATE POLICY "War room actions visible to the room" ON public.war_room_actions FOR SELECT TO authenticated
  USING (same_company(company_id) AND (
    public.is_admin() OR public.is_war_room_member(war_room_id)
    OR EXISTS (SELECT 1 FROM public.war_rooms wr WHERE wr.id = war_room_actions.war_room_id AND wr.created_by = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = (SELECT auth.uid()) AND (up.can_create_war_room OR up.can_access_management))
  ));
DROP POLICY IF EXISTS "War room managers add actions" ON public.war_room_actions;
CREATE POLICY "War room managers add actions" ON public.war_room_actions FOR INSERT TO authenticated
  WITH CHECK (same_company(company_id) AND public.war_room_can_manage(war_room_id));
DROP POLICY IF EXISTS "War room managers edit actions" ON public.war_room_actions;
CREATE POLICY "War room managers edit actions" ON public.war_room_actions FOR UPDATE TO authenticated
  USING (same_company(company_id) AND public.war_room_can_manage(war_room_id))
  WITH CHECK (same_company(company_id) AND public.war_room_can_manage(war_room_id));
DROP POLICY IF EXISTS "War room managers delete actions" ON public.war_room_actions;
CREATE POLICY "War room managers delete actions" ON public.war_room_actions FOR DELETE TO authenticated
  USING (same_company(company_id) AND public.war_room_can_manage(war_room_id));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.war_room_actions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nome do card guarda a ligação com a sala: o "grupo" de subtarefas que representa a timeline
CREATE OR REPLACE FUNCTION public.war_room_timeline_group(_task uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g uuid;
BEGIN
  SELECT id INTO g FROM public.subtask_groups WHERE task_id = _task AND title = 'Linha do tempo' ORDER BY position LIMIT 1;
  IF g IS NULL THEN
    INSERT INTO public.subtask_groups (task_id, title, position) VALUES (_task, 'Linha do tempo', 0) RETURNING id INTO g;
  END IF;
  RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.war_room_timeline_group(uuid) FROM PUBLIC, anon, authenticated;

-- Ação criada/alterada/apagada -> espelha na subtarefa do card
CREATE OR REPLACE FUNCTION public.war_room_actions_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.war_rooms%ROWTYPE; sid uuid; prev text := coalesce(current_setting('ewvon.wr_sync', true), '');
BEGIN
  PERFORM set_config('ewvon.wr_sync', '1', true);
  IF TG_OP = 'DELETE' THEN
    -- só espelha a exclusão enquanto a sala está ativa (apagar uma sala encerrada não mexe no card concluído)
    IF OLD.subtask_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.war_rooms WHERE id = OLD.war_room_id AND status = 'active') THEN
      DELETE FROM public.task_subtasks WHERE id = OLD.subtask_id;
    END IF;
    PERFORM set_config('ewvon.wr_sync', prev, true);
    RETURN OLD;
  END IF;
  SELECT * INTO r FROM public.war_rooms WHERE id = NEW.war_room_id;
  IF TG_OP = 'INSERT' THEN
    IF r.task_id IS NOT NULL AND NEW.subtask_id IS NULL THEN
      INSERT INTO public.task_subtasks (task_id, group_id, title, position, is_completed)
      VALUES (r.task_id, public.war_room_timeline_group(r.task_id), NEW.title, NEW.position, NEW.status = 'done')
      RETURNING id INTO sid;
      NEW.subtask_id := sid;
    END IF;
  ELSE
    IF NEW.subtask_id IS NOT NULL THEN
      UPDATE public.task_subtasks SET title = NEW.title, position = NEW.position
        WHERE id = NEW.subtask_id AND (title IS DISTINCT FROM NEW.title OR position IS DISTINCT FROM NEW.position);
      UPDATE public.task_subtasks SET is_completed = (NEW.status = 'done')
        WHERE id = NEW.subtask_id AND is_completed IS DISTINCT FROM (NEW.status = 'done');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
      INSERT INTO public.war_room_timeline (war_room_id, content, created_by, task_id)
      VALUES (NEW.war_room_id, CASE WHEN NEW.status = 'done' THEN 'Ação concluída: ' ELSE 'Ação reaberta: ' END || NEW.title, auth.uid(), r.task_id);
    END IF;
  END IF;
  PERFORM set_config('ewvon.wr_sync', prev, true);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.war_room_actions_sync() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_actions_sync_ins ON public.war_room_actions;
CREATE TRIGGER war_room_actions_sync_ins BEFORE INSERT ON public.war_room_actions FOR EACH ROW EXECUTE FUNCTION public.war_room_actions_sync();
DROP TRIGGER IF EXISTS war_room_actions_sync_upd ON public.war_room_actions;
CREATE TRIGGER war_room_actions_sync_upd AFTER UPDATE ON public.war_room_actions FOR EACH ROW EXECUTE FUNCTION public.war_room_actions_sync();
DROP TRIGGER IF EXISTS war_room_actions_sync_del ON public.war_room_actions;
CREATE TRIGGER war_room_actions_sync_del AFTER DELETE ON public.war_room_actions FOR EACH ROW EXECUTE FUNCTION public.war_room_actions_sync();

-- Subtarefa concluída no card -> ação concluída na sala
CREATE OR REPLACE FUNCTION public.war_room_subtask_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.war_room_actions%ROWTYPE;
BEGIN
  IF NEW.is_completed IS NOT DISTINCT FROM OLD.is_completed THEN RETURN NEW; END IF;
  SELECT * INTO a FROM public.war_room_actions WHERE subtask_id = NEW.id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF (a.status = 'done') IS DISTINCT FROM NEW.is_completed THEN
    UPDATE public.war_room_actions
       SET status = CASE WHEN NEW.is_completed THEN 'done' ELSE 'pending' END,
           completed_at = CASE WHEN NEW.is_completed THEN now() ELSE NULL END,
           completed_by = CASE WHEN NEW.is_completed THEN public.get_current_profile_id() ELSE NULL END,
           started_at = CASE WHEN NEW.is_completed THEN coalesce(a.started_at, a.created_at) ELSE a.started_at END
     WHERE id = a.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.war_room_subtask_sync() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_subtask_sync ON public.task_subtasks;
CREATE TRIGGER war_room_subtask_sync AFTER UPDATE OF is_completed ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION public.war_room_subtask_sync();

-- Concluir/reabrir uma ação pela sala (qualquer convocado ou quem manda na sala)
CREATE OR REPLACE FUNCTION public.war_room_set_action(_action uuid, _done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.war_room_actions%ROWTYPE; r public.war_rooms%ROWTYPE; prev timestamptz;
BEGIN
  SELECT * INTO a FROM public.war_room_actions WHERE id = _action;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ação não encontrada.'; END IF;
  SELECT * INTO r FROM public.war_rooms WHERE id = a.war_room_id;
  IF NOT public.same_company(r.company_id) OR NOT (public.is_war_room_member(r.id) OR public.war_room_can_manage(r.id)) THEN
    RAISE EXCEPTION 'Você não participa desta War Room.' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'A War Room já foi encerrada.'; END IF;
  IF _done THEN
    SELECT max(completed_at) INTO prev FROM public.war_room_actions WHERE war_room_id = r.id AND status = 'done' AND id <> a.id;
    UPDATE public.war_room_actions
       SET status = 'done', completed_at = now(), completed_by = public.get_current_profile_id(),
           started_at = coalesce(started_at, prev, r.created_at)
     WHERE id = a.id;
  ELSE
    UPDATE public.war_room_actions SET status = 'pending', completed_at = NULL, completed_by = NULL WHERE id = a.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.war_room_set_action(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.war_room_set_action(uuid, boolean) TO authenticated;

-- Cria o card emergencial da sala: só quadro e coluna; o resto vem da sala
CREATE OR REPLACE FUNCTION public.war_room_create_card(_room uuid, _board uuid, _column uuid)
RETURNS TABLE (o_task_id uuid, o_task_number integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.war_rooms%ROWTYPE; tid uuid; tnum integer; gid uuid; pos integer; a record; sid uuid; i integer := 0; prev text := coalesce(current_setting('ewvon.wr_sync', true), '');
BEGIN
  SELECT * INTO r FROM public.war_rooms WHERE id = _room FOR UPDATE;
  IF NOT FOUND OR NOT public.war_room_can_manage(_room) THEN RAISE EXCEPTION 'Sem permissão nesta War Room.' USING ERRCODE = '42501'; END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'A War Room já foi encerrada.'; END IF;
  IF r.task_id IS NOT NULL THEN RAISE EXCEPTION 'Esta War Room já tem um card.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.task_boards b WHERE b.id = _board AND b.company_id = r.company_id)
     OR NOT EXISTS (SELECT 1 FROM public.task_board_columns c WHERE c.id = _column AND c.board_id = _board) THEN
    RAISE EXCEPTION 'Quadro ou coluna inválidos.';
  END IF;
  SELECT coalesce(max(t.position), -1) + 1 INTO pos FROM public.tasks t WHERE t.board_id = _board AND t.status = _column::text;
  INSERT INTO public.tasks (board_id, status, title, description, priority, due_date, created_by, position, is_emergency, company_id)
  VALUES (_board, _column::text, r.title, r.description, 'high', r.target_at, public.get_current_profile_id(), pos, true, r.company_id)
  RETURNING id, tasks.task_number INTO tid, tnum;
  gid := public.war_room_timeline_group(tid);
  PERFORM set_config('ewvon.wr_sync', '1', true);
  FOR a IN SELECT * FROM public.war_room_actions WHERE war_room_id = _room ORDER BY position, created_at LOOP
    INSERT INTO public.task_subtasks (task_id, group_id, title, position, is_completed)
    VALUES (tid, gid, a.title, i, a.status = 'done') RETURNING id INTO sid;
    UPDATE public.war_room_actions SET subtask_id = sid WHERE id = a.id;
    i := i + 1;
  END LOOP;
  UPDATE public.war_rooms SET task_id = tid, emergency_board_id = _board, emergency_column_id = _column WHERE id = _room;
  INSERT INTO public.war_room_timeline (war_room_id, content, created_by, task_id)
  VALUES (_room, 'Card emergencial #' || tnum || ' criado: ' || r.title, auth.uid(), tid);
  PERFORM set_config('ewvon.wr_sync', prev, true);
  RETURN QUERY SELECT tid, tnum;
END $$;
REVOKE ALL ON FUNCTION public.war_room_create_card(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.war_room_create_card(uuid, uuid, uuid) TO authenticated;

-- Título/descrição/meta da sala -> card
CREATE OR REPLACE FUNCTION public.war_room_card_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tgt record; done_col uuid; late boolean; prev text := coalesce(current_setting('ewvon.wr_sync', true), '');
BEGIN
  IF NEW.task_id IS NULL THEN RETURN NEW; END IF;
  PERFORM set_config('ewvon.wr_sync', '1', true);
  IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    -- sala encerrada: o card vai para a coluna de concluídos do quadro
    SELECT t.board_id, t.due_date INTO tgt FROM public.tasks t WHERE t.id = NEW.task_id;
    IF tgt.board_id IS NOT NULL THEN
      SELECT c.id INTO done_col FROM public.task_board_columns c WHERE c.board_id = tgt.board_id AND c.is_conclusion ORDER BY c.position LIMIT 1;
      IF done_col IS NULL THEN
        SELECT c.id INTO done_col FROM public.task_board_columns c WHERE c.board_id = tgt.board_id ORDER BY c.position DESC LIMIT 1;
      END IF;
      late := tgt.due_date IS NOT NULL AND now() > tgt.due_date;
      IF done_col IS NOT NULL THEN
        UPDATE public.tasks SET status = done_col::text, completed_at = now(), completed_late = late,
               delay_days = CASE WHEN late THEN greatest(1, ceil(extract(epoch FROM (now() - tgt.due_date)) / 86400)::int) ELSE 0 END
         WHERE id = NEW.task_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.tasks SET title = NEW.title, description = NEW.description, due_date = NEW.target_at
     WHERE id = NEW.task_id AND (title IS DISTINCT FROM NEW.title OR description IS DISTINCT FROM NEW.description OR due_date IS DISTINCT FROM NEW.target_at);
  END IF;
  PERFORM set_config('ewvon.wr_sync', prev, true);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.war_room_card_follow() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_card_follow ON public.war_rooms;
CREATE TRIGGER war_room_card_follow AFTER UPDATE OF status, title, description, target_at ON public.war_rooms FOR EACH ROW EXECUTE FUNCTION public.war_room_card_follow();

-- Card de sala ativa: ninguém altera (só concluir subtarefas)
CREATE OR REPLACE FUNCTION public.war_room_card_locked(_task uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(current_setting('ewvon.wr_sync', true), '') <> '1'
     AND EXISTS (SELECT 1 FROM public.war_rooms wr WHERE wr.task_id = _task AND wr.status = 'active')
$$;
REVOKE ALL ON FUNCTION public.war_room_card_locked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.war_room_card_locked(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.war_room_lock_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.war_room_card_locked(OLD.id) THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - 'updated_at' - 'position') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'position') THEN
    RAISE EXCEPTION 'CARD_WAR_ROOM: este card é controlado por uma War Room ativa e não pode ser alterado.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.war_room_lock_task() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_lock_task ON public.tasks;
CREATE TRIGGER war_room_lock_task BEFORE UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.war_room_lock_task();

CREATE OR REPLACE FUNCTION public.war_room_lock_subtask()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.task_id ELSE OLD.task_id END;
BEGIN
  IF NOT public.war_room_card_locked(tid) THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP = 'UPDATE' AND NEW.title IS NOT DISTINCT FROM OLD.title AND NEW.position IS NOT DISTINCT FROM OLD.position
     AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id AND NEW.task_id IS NOT DISTINCT FROM OLD.task_id THEN
    RETURN NEW;   -- só concluir/reabrir
  END IF;
  RAISE EXCEPTION 'CARD_WAR_ROOM: as subtarefas deste card são a timeline da War Room; só dá para concluí-las.' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.war_room_lock_subtask() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_lock_subtask ON public.task_subtasks;
CREATE TRIGGER war_room_lock_subtask BEFORE INSERT OR UPDATE OR DELETE ON public.task_subtasks FOR EACH ROW EXECUTE FUNCTION public.war_room_lock_subtask();

CREATE OR REPLACE FUNCTION public.war_room_lock_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.task_id ELSE OLD.task_id END;
BEGIN
  IF public.war_room_card_locked(tid) THEN
    RAISE EXCEPTION 'CARD_WAR_ROOM: este card é controlado por uma War Room ativa e não pode ser alterado.' USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.war_room_lock_group() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_lock_group ON public.subtask_groups;
CREATE TRIGGER war_room_lock_group BEFORE INSERT OR UPDATE OR DELETE ON public.subtask_groups FOR EACH ROW EXECUTE FUNCTION public.war_room_lock_group();

-- A tela precisa saber quais cards estão presos a uma sala ativa
CREATE OR REPLACE FUNCTION public.war_room_locked_tasks()
RETURNS TABLE (task_id uuid, war_room_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wr.task_id, wr.id FROM public.war_rooms wr
  WHERE wr.status = 'active' AND wr.task_id IS NOT NULL AND public.same_company(wr.company_id)
$$;
REVOKE ALL ON FUNCTION public.war_room_locked_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.war_room_locked_tasks() TO authenticated;
