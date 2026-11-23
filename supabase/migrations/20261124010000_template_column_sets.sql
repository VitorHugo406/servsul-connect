-- Coluna de template que duplica TODOS os seus cards de uma vez ("Duplicar todos os cards"), já preenchidos e com
-- prazos calculados a partir de uma data de referência (ex.: "Último dia" no desligamento, "Data de admissão" no
-- onboarding).
--  * tasks.template_offset_days / template_start_offset_days: prazo e início de um card-template, em dias em relação
--    ao PRAZO FINAL do processo (negativo = antes, positivo = depois). Só tem sentido em cards com is_template.
--  * task_board_columns.template_ref_field: o campo de data do mural que serve de referência.
--    template_lead_days: antecedência padrão — prazo final = data de referência − antecedência.
--    template_lead_label: a pergunta mostrada ao duplicar ("Quantos dias antes do último dia o desligamento precisa
--    estar concluído?"). template_title_field: campo cujo valor é acrescentado ao título de cada card criado.
alter table public.tasks add column if not exists template_offset_days integer check (template_offset_days between -3650 and 3650);
alter table public.tasks add column if not exists template_start_offset_days integer check (template_start_offset_days between -3650 and 3650);

alter table public.task_board_columns add column if not exists template_ref_field uuid references public.board_custom_fields(id) on delete set null;
alter table public.task_board_columns add column if not exists template_lead_days integer not null default 0 check (template_lead_days between -3650 and 3650);
alter table public.task_board_columns add column if not exists template_lead_label text check (template_lead_label is null or length(template_lead_label) <= 200);
alter table public.task_board_columns add column if not exists template_title_field uuid references public.board_custom_fields(id) on delete set null;
