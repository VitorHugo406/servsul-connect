-- "Duplicar todos os cards" inteligente: each template card remembers the column its real card belongs to (e.g. in the
-- onboarding model, "Avaliação de experiência — 45 dias" goes to "Experiência (45/90 dias)"). Murals created from a
-- model fill it automatically; anyone can change it in the template card ("Prazo no processo" › Coluna).
alter table public.tasks add column if not exists template_target_column uuid references public.task_board_columns(id) on delete set null;
