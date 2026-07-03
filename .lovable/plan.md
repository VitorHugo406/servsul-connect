# Transformação Multi-Empresa do ServChat

Vou reestruturar o sistema em torno de "empresas" (tenants), criar um super-admin global e redesenhar a versão mobile. Mudança grande, mas sem apagar nada — todos os dados atuais vão para "Grupo ServSul".

## 1. Modelo de Empresas

Nova tabela `companies`:
- `name`, `slug`, `logo_url`, `primary_color`, `secondary_color`, `is_active`, `is_system` (marca a empresa "Admin")

Duas empresas criadas na migração:
- **Admin** (`is_system=true`) — casa do super-admin global
- **Grupo ServSul** — azul (#0066CC) / laranja (#FF6B00), recebe TODOS os dados atuais

Coluna `company_id` adicionada em: `profiles`, `sectors`, `task_boards`, `tasks`, `announcements`, `important_announcements`, `messages`, `direct_messages`, `private_groups`, `notes`, `calendar_events`, `war_rooms`, `evaluations`, `teams`, `api_integrations`, etc. Backfill = ServSul para tudo existente.

## 2. Papéis e acesso

Nova role `super_admin` na enum `app_role`. Vinculada ao usuário `vitor.santospess@gmail.com` (empresa "Admin").

- **super_admin**: enxerga/gerencia tudo, cria empresas, cria admins de empresa, define logo/cores.
- **admin** (ex.: adminservchat da ServSul): admin só da sua empresa. Não cria outras empresas.
- Demais usuários: escopo estrito à `company_id` do seu perfil.

Todas as RLS policies existentes ganham filtro `company_id = current_company_id()` (função SECURITY DEFINER que lê do profile). Super-admin bypassa via `is_super_admin()`.

## 3. Branding dinâmico

- Logo padrão do site (pré-login): nova arte neutra "ServChat".
- Após login: `AuthContext` carrega a empresa e injeta `--primary` / `--secondary` / logo via CSS vars no `<html>`. Header e sidebar passam a usar a logo da empresa.
- ServSul entra pré-configurada com logo atual e cores azul/laranja. Novas empresas começam com defaults editáveis pelo super-admin.

## 4. Nova aba "Empresas" (só super-admin)

Seção `CompaniesManagementSection`:
- Listar / criar / desativar empresas
- Upload de logo (bucket `company-logos`, público)
- Pickers de cor primária/secundária
- Criar primeiro admin da empresa (edge function `create-company-admin` que faz signUp + role admin + vincula company)

Aba "Gestão" existente continua para admins de empresa (só usuários da própria empresa).

## 5. Mobile redesenhado (baseado no HTML anexado)

Nova estrutura mobile em `src/components/layout/MobileShell.tsx` seguindo o visual do arquivo:
- Fundo claro com gradientes suaves, cards `rounded-3xl`, tipografia Sora + Inter
- Bottom nav com apenas 3 abas: **Início**, **Chat**, **Avisos**
- Header compacto com logo da empresa + avatar (menu → status/logout/perfil)
- Todas as outras seções (tarefas, gestão, calendário, war room, etc.) ficam desktop-only. Se um usuário mobile tentar acessar via URL, é redirecionado para /início.
- Aplica-se a TODOS os usuários no mobile, inclusive admins (conforme sua resposta).

Desktop permanece com a UI e navegação atuais (só ganha o branding dinâmico e o filtro por empresa).

## 6. Migração de dados (não destrutiva)

Migração única:
1. Cria `companies` + colunas `company_id`
2. Insere "Admin" e "Grupo ServSul"
3. Backfill: `UPDATE ... SET company_id = servsul_id` em todas as tabelas
4. Torna `company_id` NOT NULL
5. Cria/atualiza role `super_admin` para `vitor.santospess@gmail.com` (se ainda não existe no auth, é criado via edge function no primeiro deploy usando a senha informada)
6. Recria RLS policies com filtro por empresa

## Detalhes técnicos

- `current_company_id()` SECURITY DEFINER retorna `profiles.company_id` do `auth.uid()`
- `is_super_admin()` SECURITY DEFINER verifica role
- Storage: novo bucket público `company-logos`
- Edge function `create-company` (super-admin only) e `create-company-admin`
- Types Supabase regerados após migration
- Senha do super-admin (`Hugo4062006*`) usada apenas no seed inicial via edge function com service role; não fica em código-fonte

## Riscos

- Migração toca muitas tabelas e políticas — vou empacotar tudo numa migração revisável antes de rodar
- Mobile perde acesso a várias telas — usuários atuais precisarão do desktop pra tarefas/gestão

Quer que eu prossiga exatamente assim, ou ajusto algo (ex.: manter alguma outra aba no mobile, mudar defaults de cor da ServSul, permitir admin de empresa criar sub-admins, etc.)?
