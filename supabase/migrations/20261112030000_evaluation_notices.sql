-- "Comunicados" tells people when an evaluation is waiting for them, with a step by step (desktop and mobile):
--   status becomes 'sent'      -> the evaluated person: read it and give "ciência" (or ask for a review)
--   status becomes 'contested' -> the evaluator/manager: a review was requested, adjust and resend
CREATE OR REPLACE FUNCTION public.evaluation_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  evaluator_name text; evaluated_name text; period text; msg text; reason text; target uuid;
BEGIN
  IF NEW.status NOT IN ('sent', 'contested') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT coalesce(nullif(display_name, ''), name) INTO evaluator_name FROM public.profiles WHERE id = NEW.evaluator_id;
  SELECT coalesce(nullif(display_name, ''), name) INTO evaluated_name FROM public.profiles WHERE id = NEW.evaluated_id;
  period := coalesce(nullif(NEW.period_label, ''), 'período atual');

  IF NEW.status = 'sent' THEN
    target := NEW.evaluated_id;
    msg := E'📋 Avaliação aguardando a sua ciência\n\n'
      || coalesce(evaluator_name, 'Seu gestor') || E' enviou a sua avaliação de ' || period
      || E'.\n\nONDE ESTÁ AGORA\nEtapa 2 de 3: 1) o gestor envia  →  2) você lê e dá ciência (é aqui que ela está)  →  3) concluída.\n\n'
      || E'COMO DAR CIÊNCIA NO COMPUTADOR\n'
      || E'1) No menu lateral, abra a aba "Avaliações" (ícone de prancheta).\n'
      || E'2) Se você também é gestor, clique em "Minhas" no topo da tela.\n'
      || E'3) Clique na avaliação marcada "Aguardando ciência".\n'
      || E'4) Leia as notas e o feedback.\n'
      || E'5) Clique em "Dar ciência" (o comentário é opcional). Se discordar, clique em "Pedir revisão", explique o motivo e envie.\n\n'
      || E'COMO DAR CIÊNCIA NO CELULAR\n'
      || E'1) Toque no menu ☰ e em "Meu perfil".\n'
      || E'2) Na caixa "Minhas avaliações", em "Em andamento", toque na avaliação marcada "Dar ciência".\n'
      || E'3) Leia até o final da página.\n'
      || E'4) Toque em "Dar ciência". Se discordar, toque em "Pedir revisão" e explique o motivo.';
  ELSE
    target := NEW.evaluator_id;
    reason := left(regexp_replace(coalesce(NEW.evaluated_comment, ''), '\s+', ' ', 'g'), 300);
    msg := E'🔁 Pedido de revisão de avaliação\n\n'
      || coalesce(evaluated_name, 'O colaborador') || E' pediu revisão da avaliação de ' || period || E'.'
      || CASE WHEN reason <> '' THEN E'\nMotivo: "' || reason || E'"' ELSE '' END
      || E'\n\nONDE ESTÁ AGORA\nEtapa 3 de 4: 1) você envia  →  2) o colaborador responde  →  3) revisão pedida (está com você: ajustar e reenviar)  →  4) concluída.\n\n'
      || E'COMO AJUSTAR E REENVIAR NO COMPUTADOR\n'
      || E'1) No menu lateral, abra a aba "Avaliações".\n'
      || E'2) Em "Equipe", escolha o filtro "Revisão pedida".\n'
      || E'3) Abra a avaliação e leia o pedido do colaborador.\n'
      || E'4) Ajuste as notas e o feedback, se concordar.\n'
      || E'5) Clique em "Reenviar". O colaborador recebe uma nova mensagem para dar ciência.\n\n'
      || E'NO CELULAR\nVocê consegue ler o pedido em "Meu perfil" > "Minhas avaliações" (se for sobre você), mas o ajuste e o reenvio são feitos no computador.';
  END IF;

  INSERT INTO public.direct_messages (sender_id, receiver_id, content, company_id, is_read)
  VALUES (public.system_sender_id(), target, msg, NEW.company_id, false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'evaluation_notify: %', SQLERRM;  -- never block the evaluation flow
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.evaluation_notify() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS evaluation_notify_trg ON public.evaluations;
CREATE TRIGGER evaluation_notify_trg AFTER INSERT OR UPDATE OF status ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.evaluation_notify();
