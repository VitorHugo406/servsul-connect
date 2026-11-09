# Decisões — 07/11/2026: notificações push, e-mail, figurinhas, avaliações

## Notificações do app instalado (Web Push)
- **Problema:** as notificações eram criadas pela própria página. Mensagens da mesma conversa se substituíam em silêncio e, com o app em segundo plano, o Android congelava a página e nada chegava.
- **Decisão:** Web Push real enviado pelo servidor.
  - `web_push_subscriptions` (com `company_id` e RLS: cada pessoa só vê/grava as próprias inscrições).
  - Triggers em `direct_messages`, `messages`, `private_group_messages` e `announcements` chamam a edge function `send-push` via `pg_net`.
  - Autenticação da chamada: segredo `push_secret` no Vault. Chaves VAPID também no Vault (`vapid_private_key`, `vapid_public_key`), lidas só pela função `push_config` (service role). A chave pública VAPID fica no frontend (é pública por definição).
  - Aniversários: `pg_cron` às 12:00 UTC (09:00 de São Paulo) chama `send-push` com `birthday_daily`.
  - Conversas silenciadas (`chat_member_prefs`) não recebem push. Quem enviou não recebe.
- **Visual:** título = pessoa / grupo / setor; corpo = mensagem; ícone grande = foto (ou ícone do tipo: pessoa, grupo, setor, 📢 aviso, 🎂 aniversário); mensagens da mesma conversa empilham numa só notificação.
- **Limitação do Android:** em notificações web o ícone pequeno à esquerda é sempre o "badge" monocromático do app e a foto aparece como ícone grande (à direita). O pop-up na tela (heads-up) depende da configuração de notificação do app no Android.

## E-mail
- Resend exigia domínio próprio. Decisão: SMTP do Gmail (`ewvonsuporte@gmail.com`, porta 465) num módulo compartilhado `supabase/functions/_shared/mailer.ts`, com assinatura em todos os e-mails.
- Credencial: secret `GMAIL_APP_PASSWORD` nas Edge Functions (precisa ser **senha de app** do Google, não a senha normal).
- Avisos por e-mail vão só para a empresa de quem publicou; feedback disparado por admin fica restrito à empresa do admin.
- Limite do Gmail gratuito: ~500 destinatários/dia.

## Figurinhas
- Formato estilo WhatsApp: WebP 512×512 no bucket privado `stickers/<company_id>/<sha256>.webp`, gravado uma vez por empresa (o nome é o hash do conteúdo, então reenviar não duplica). A mensagem guarda só a referência `✨ sticker:<company_id>/<sha256>`.
- Pacote de emoji não usa armazenamento (`✨ sticker:e:<emoji>`).
- "Minhas figurinhas" em `chat_sticker_favorites` (RLS por pessoa).

## Avaliações
- Fluxo simplificado: rascunho → aguardando ciência → concluída (ou revisão pedida → reenviada). Notas de 1 a 5 por critério.
- O avaliado não edita mais a avaliação: responde pela RPC `evaluation_respond`. Rascunhos não aparecem para o avaliado.

## Chamados de suporte
- Chamado encerrado: chat somente leitura e avaliação do atendimento (1–5 + comentário) pela RPC `support_rate_ticket`, uma única vez.

## Áudio criptografado de ponta a ponta (08/11/2026)
- Cada aparelho (celular/PC) gera seu par de chaves ECDH P-256 no navegador; a chave privada é **não exportável** e fica no IndexedDB do aparelho. Só a chave pública vai para `e2e_device_keys`.
- O áudio é cifrado com AES-256-GCM (chave aleatória por mensagem). Essa chave é selada para cada aparelho de cada membro da conversa (ECDH com chave efêmera + AES-GCM) em `e2e_media_keys`, que cada aparelho só consegue ler para si (RLS).
- O servidor guarda apenas o arquivo cifrado (bucket privado `voice`, 7 dias, função `voice-cleanup` de hora em hora) e as chaves seladas: não consegue ouvir o áudio.
- Limitação (igual ao WhatsApp): um aparelho conectado depois do envio não abre áudios antigos; se o app for reinstalado ou os dados do navegador apagados, os áudios antigos ficam indisponíveis naquele aparelho.
- Gravação no app mobile (botão de microfone quando a caixa de texto está vazia); reprodução no celular e no PC.

## Sessão e app instalado (08/11/2026)
- `signOut` agora usa `scope: 'local'`: sair num aparelho não derruba os outros (antes o padrão global revogava todas as sessões e o app deslogava sozinho).
- App instalado (PWA/Android) abre direto no login, pede notificações (obrigatório) e microfone no primeiro acesso; a opção "Baixar aplicativo" aparece só no navegador.

## Avisos e links (08/11/2026)
- Aviso fixado usava prioridade `high`, que o banco não aceita (`normal|important|urgent`): agora usa `important`.
- Avisos temporários no app (24 h, 3, 7 ou 30 dias) via `expire_at`; o PC já tinha a data de expiração.
- Postar avisos: admin (papel), nível admin/gerente ou permissão `can_post_announcements` — mesma regra na tela e na policy de INSERT.
- Prévia de links: edge function `link-preview` (só usuários logados; só http/https em hosts públicos; HTML até 400 KB; 6 s). O app guarda a prévia no aparelho por 7 dias.

## Áudio: aparelhos novos e pacotes de figurinhas (08/11/2026)
- Áudio enviado antes de o aparelho do destinatário existir: o aparelho novo cria um pedido em `e2e_key_requests`; o aparelho de quem enviou (quando online) confere no app que a pessoa é membro daquela conversa (`e2e_media.chat_key`) e sela a chave para o aparelho novo. O servidor continua sem ver áudio nem chave.
- Figurinhas: botão próprio ao lado do "+"; tocar numa figurinha recebida mostra "Salvar nas favoritas".
- Pacotes: `chat_sticker_packs` / `chat_sticker_pack_items` (empresa vê, só o dono altera). Compartilhar no chat envia `✨ pack:<id>` (cartão "Adicionar aos meus pacotes" cria uma cópia). Exportar gera um arquivo `.ewvonpack` (JSON com as imagens), compartilhável pelo menu do celular; Importar recria o pacote.

## Chat mobile, avisos e exclusão de empresa (08/11/2026)
- Vistos: ✓ cinza enviando, ✓✓ branco entregue, ✓✓ azul lido. Conversa individual usa `direct_messages.is_read` (tempo real); grupo usa `group_read_watermark` (até quando TODOS os outros membros leram, sem expor quem leu); setor não tem leitura por pessoa, fica só "entregue".
- Segurar uma conversa abre: ver detalhes, fixar/desafixar, marcar como lida. Reações com "+" para todos os emojis. Datas por dia e data flutuante ao rolar. Menu ⋮ com Pesquisar (busca na conversa carregada) e Configurações.
- Avisos podem ser excluídos por quem publicou ou admins (mesma regra da policy de DELETE).
- Excluir empresa: `super_admin_delete_company` — só super admin, nunca a empresa do sistema, exige digitar o nome, transação única (falhou = nada apagado). Apaga linhas de todas as tabelas com `company_id`, registros ligados às pessoas, e os logins (`auth.users`). Arquivos já enviados ao Storage (fotos/anexos) não são apagados por essa função.

## Estabilidade e relatórios (08/11/2026)
- Abas do PC travando no "carregando": após cada deploy, abas abertas apontavam para arquivos da versão anterior (404) e o `lazy()` simples nunca se recuperava. Agora `lazyWithRetry` (nova tentativa + uma recarga controlada) em todas as telas e `SectionBoundary` com "Atualizar página".
- Início do app: o carregamento inicial rodava 2–3 vezes (dependências recriadas a cada atualização do perfil/setores/permissões) e os números reiniciavam a animação a cada atualização automática. Agora há uma carga por vez, a atualização só redesenha quando os números mudam e os contadores animam do valor atual.
- "Digitando...": o app usa os mesmos canais de broadcast do PC (`typing-sector-*`, `typing-group-*`, `typing-dm-*`), com texto azul escuro (tema claro) / azul claro (tema escuro) e bolha animada.
- Relatórios sem faixas/fundos escuros (impressão): cabeçalho branco com linha fina, cartões e tabelas com contorno, etiquetas coloridas só em contorno. O PDF de aniversariantes ficou branco, com a foto do tema num quadro à direita e o rodapé do QR com contorno.

## Chat mobile: áudio, figurinhas, digitando e ajustes (09/11/2026)
- Áudio como no WhatsApp: segurar o microfone grava, soltar envia, deslizar para a esquerda cancela, deslizar para cima trava (grava sem segurar; lixeira ou enviar finalizam). Toque rápido só mostra a dica.
- Figurinhas seguidas da mesma pessoa aparecem lado a lado (duas por linha).
- "Digitando..." também na lista de conversas: o app escuta os canais de digitação das 40 conversas mais recentes (um canal por conversa, reaproveitado pela conversa aberta).
- Menu ⋮ do chat ficou fora do cabeçalho: com fundo "Pontos"/"Cor" o cabeçalho usa desfoque, que prendia o menu por baixo das mensagens.
- O painel de figurinhas usava a classe `.stk`, a mesma das fotos empilhadas de "Presentes agora", o que deixava essa linha com 300 px de altura; o painel agora usa `.stkp`.
- Reações: o seletor e as reações da mensagem ficam sempre numa linha reta (não encolhem para a largura de mensagens curtas).
- Botão "ir para a última mensagem" (como no WhatsApp): aparece ao subir mais de ~320 px; enquanto a pessoa lê mensagens antigas, mensagens novas de outros não puxam a tela para baixo e viram um contador verde no botão.
- O seletor de reações é empurrado para dentro da tela quando a mensagem (ex.: figurinha lado a lado) fica perto da borda.

## Responder mensagem deslizando (09/11/2026)
- No app, deslizar uma mensagem para a direita (como no WhatsApp) abre "respondendo a" acima da caixa de texto; o que for enviado em seguida (texto, figurinha, áudio, arquivo) leva a referência.
- Banco: `reply_to_id` em `direct_messages` e `private_group_messages` (migration `20261109010000_message_replies.sql`), igual ao `messages.reply_to_id` que o chat de setores já tinha. Mesma tabela, `ON DELETE SET NULL`; sem mudança de RLS.
- A citação aparece acima da mensagem; tocar nela leva até a original. Se a original for mais antiga que as mensagens carregadas, o app busca só o autor e o texto dela.
- No PC, as conversas individuais e de grupo mostram a citação (o setor já mostrava).
- Caixa de texto do chat (e do chat de chamados) virou `textarea`: o teclado/Chrome deixa de oferecer senhas e logins salvos (eles só aparecem em campos `input`, e `autocomplete="off"` é ignorado pelo Chrome). Cresce até ~5 linhas.
- Ao abrir uma conversa, ela fica presa no final enquanto fotos, figurinhas e prévias de link terminam de carregar (para de seguir assim que a pessoa rola para cima).

## Ordem das mensagens (09/11/2026)
- Problema: mensagens fora da ordem de envio. Causas: (1) no app, envios rápidos (texto + figurinha, várias seguidas) saíam em paralelo e podiam chegar ao servidor fora de ordem; (2) mensagens recebidas em tempo real e as que já estavam na tela ao recarregar a conversa eram só "coladas no fim", sem ordenar pelo horário.
- Decisão: o app envia uma mensagem por vez, na ordem em que a pessoa tocou em enviar; a conversa é sempre ordenada pelo horário do servidor (`orderMsgs`, estável para horários iguais), com as mensagens ainda "enviando" por último. No PC, mensagens que chegam em tempo real também entram na posição certa (`src/lib/messageOrder.ts`).

## Remetente "Comunicados" (09/11/2026)
- Automações (resumo diário de grupos/setores, boas-vindas de grupo) e o feedback mensal no chat deixam de sair em nome do admin de cada empresa: saem de um único remetente de sistema, "Comunicados" (perfil fixo `00000000-0000-0000-0000-0000000000c1`, migration `20261109030000_system_sender.sql`).
- É um perfil real (as mensagens apontam para perfis) com login inutilizável: senha aleatória que ninguém conhece e bloqueado para sempre. Fica na empresa Admin, inativo e com `profile_type = 'system'`, por isso não aparece em listas de pessoas.
- Todas as empresas veem o nome/foto dele (policy só para esse perfil). Ninguém consegue mandar mensagem para ele (policy restritiva em `direct_messages`); só o super admin pode editá-lo.
- Boas-vindas agora pela RPC `post_group_welcome` (admin do grupo, mesma empresa, só se a automação estiver ligada).
- O feedback mensal grava a empresa de quem recebe na mensagem (o remetente é global).
- Visual: bolha cósmica animada em CSS (`CosmicBlob`), clara (branco/perolado) no tema claro e azul escura no tema escuro. Nos grupos/setores substitui a foto; no PV aparece grande no centro e a caixa de texto vira "Este canal só envia comunicados".

## Assinaturas: base para pagamento (09/11/2026)
- Migration `20261109050000_subscriptions.sql`: `subscription_plans` (Essencial R$ 89 / 10 usuários / 3 setores / 2 GB; Profissional R$ 219 / 30 / 7 / 10 GB; Empresarial R$ 599 / 100 / 15 / 30 GB, com as funcionalidades da tabela da página inicial), `company_subscriptions` (plano, situação, acessos gratuitos, teste, ids do provedor de pagamento) e `subscription_events` (histórico).
- Só o super admin cria/altera planos e assinaturas (RLS); cada empresa só lê a própria. A empresa Admin (sistema) é sempre "isenta": um trigger força isso mesmo que alguém tente mudar.
- Empresas novas nascem "aguardando" plano; as que já existiam ficaram no Empresarial "gratuita" para não perder nada até o super admin definir o plano.
- Ainda não bloqueia nada: `company_has_feature()` e `company_seat_limit()` (plano + acessos gratuitos) ficam prontos para as telas usarem quando a cobrança começar. O provedor de pagamento ainda não foi escolhido.
- Tela: PC > Empresas > (empresa) > aba "Plano".
- Ajuste: no PV do "Comunicados" a bolha não fica mais no fundo; fica centralizada embaixo, logo acima do aviso "Este canal só envia comunicados", mexendo bastante (animação `talk`, como se estivesse falando).

## Assistente do PC (09/11/2026)
- O botão do assistente no topo virou a bolha cósmica (`AssistantButton`), com um "pop" ao clicar.
- Abre em qualquer aba (antes só na inicial), como painel lateral à direita.
- Aba "Dúvidas": perguntas prontas; ao tocar, a pergunta aparece como mensagem e a bolha "fala" a resposta (respostas fixas, sem IA).
- Ajuste: animação "falando" mais lenta e com mais estica-e-encolhe; a bolha flutua sobre as mensagens ao rolar, e o fim da conversa tem um espaço vazio para a última mensagem ficar acima dela.
- O chat do "Comunicados" não tem configurações: no celular o botão ⋮ vira a lupa (pesquisa direta); no PC o botão de personalizar some nesse chat.

## Ajustes (09/11/2026, tarde)
- Bolha: animação suave e lenta, como no vídeo de referência (sem estica-e-encolhe forte).
- App: estilos de texto iguais ao PC (*negrito*, _itálico_, ~riscado~, `código`, [texto](link)); ao selecionar texto na caixa aparece a barra B / I / S / código. `_` dentro de palavras (snake_case) não vira itálico. A prévia da lista mostra o texto sem os marcadores.
- App: dá para conversar consigo mesmo ("Nome (você)", primeiro da lista em Nova conversa); mensagens próprias não contam como não lidas.
- Assistente do PC: "Novos avisos" usa a mesma regra do sino (lido em `announcement_reads`), então zera ao ver os avisos; "Dúvidas" virou lista suspensa com uma resposta por vez.
- PC: troca de aba sem a pílula animada no topo; enquanto a aba carrega aparece só a logo desenhando no centro da área da página (a tela cheia fica só na abertura do sistema).
- PC: a conversa com o "Comunicados" aparece na lista para todas as empresas (antes a lista escondia quem era de outra empresa); o item da lista não estoura a largura e reserva espaço para o botão "...".
- Cards: numeração por mural (migration `20261109070000_task_number_per_board.sql`): cada mural começa no #1; trigger com trava por mural evita números repetidos; card movido para outro mural ganha o próximo número de lá; os cards existentes foram renumerados por mural na ordem de criação. O número só é exibido (ninguém busca card pelo número).

## Figurinhas animadas, painel do chat, modo operação e tutorial (09/11/2026)
- Figurinhas animadas (como no WhatsApp): GIF, WebP animado ou vídeo curto viram GIF de até 5 s (320 px, 12 quadros/s; diminui até caber em 1,4 MB), com fundo transparente, codificado no navegador (`gifenc`). Ficam na mesma chave das estáticas (`<empresa>/<sha256>.webp`) com o tipo real `image/gif`, então favoritas, pacotes e mensagens não mudaram. Migration `20261109090000_animated_stickers.sql` libera `image/gif` e 1,5 MB no bucket `stickers`. GIF animado no iPhone (sem ImageDecoder) vira figurinha estática; vídeo funciona em todos.
- Aniversariantes: quem já fez aniversário no mês sai de "próximos" e aparece em "Aniversariantes anteriores" (PC) / "Já fizeram aniversário em …" (app).
- PC, chat em tela larga (≥ 1280 px): painel à direita com dados da conversa (mensagens por dia na semana, horário de pico, mídias, links, mais ativos) e, no botão de membros ou na aba "Pessoas", a lista de pessoas do setor/grupo (ou o contato no PV).
- Modo operação: a ordem é calculada uma vez (`lib/operationMode.ts`, com testes): emergências, atrasados, prioridade, prazo. Atrasado sobe para Urgente e prazo em até 48 h para Alta. Coluna de conclusão, modelos, arquivados e cards concluídos não mudam. Mostra prévia antes de aplicar e grava em lote.
- Tutorial do app: o destaque desliza entre os controles (sem piscar), pulso suave, toque com onda; nunca abre o "Comunicados" (só leitura); textos atualizados (responder deslizando, formatação, áudio, menu ⋮).
- Data flutuante do chat do app centralizada sem salto.
- PC: a bolha do "Comunicados" ficava fora da tela (o estilo da bolha anulava o `absolute`); agora fica num contêiner próprio.

## Auditoria de segurança (2026-11-09)

Corrigido:
- Funções públicas de reconhecimento facial (`get-facial-data`, `facial-login`) permitiam ler rostos/e-mails de todos e entrar na conta de qualquer pessoa → desativadas (410) e botão de login facial escondido.
- `seed-super-admin`, `apply-schema`, `create-admin` (senha e token fixos no código) → desativadas; `apply-schema/migrations.ts` removido. A senha do super admin que esteve no histórico do Git deve ser trocada.
- `manage-user`, `update-user-permissions`, `delete-data`: agora só agem dentro da empresa de quem chama; exclusão em massa apenas super admin; super admin e conta "Comunicados" protegidos.
- `send-feedback-email`: execução agendada exige a service key; o PDF não é mais link público assinado (mostrava o endereço do banco) — a mensagem leva `ewvon:file/attachments/...` e o app baixa o arquivo com a sessão do usuário.
- `process-automations`: service key ou membro do quadro informado; `duplicate-scheduled-cards`: apenas service key.
- Chat PC: links markdown só aceitam http(s)/mailto (bloqueia `javascript:`); notas compartilhadas sanitizadas com DOMPurify (XSS armazenado).
- Migração `security_hardening`: CPF, endereço e matrícula deixam de ser legíveis pelos colegas (grant por coluna em `profiles`), funções de trigger sem EXECUTE público, `search_path` fixo, política de download do próprio relatório de feedback.

Pendente do dono: trocar a senha do super admin; ativar "Leaked password protection" em Auth.

## Assinatura com Mercado Pago (2026-11-09)

- Página pública `/assinar` (plano → empresa: nome, logo, cores → administrador → revisão) e `/assinar/retorno`.
- Função `billing` (verify_jwt off; cada rota se autentica): `plans`, `signup`, `status` (token privado), `webhook`, `reconcile` (cron de hora em hora com segredo do Vault ou super admin) e `selftest` (só segredo do Vault).
- Nada é criado antes do pagamento. A senha do administrador fica criptografada (AES-GCM, chave derivada da service role) e é apagada ao criar a empresa ou ao expirar (3 dias).
- O webhook nunca confia no corpo da notificação: consulta a assinatura/pagamento na API do Mercado Pago, confere `external_reference` e valor do plano. Assinatura `x-signature` validada quando `MP_WEBHOOK_SECRET` existe.
- Criação idempotente (empresa, logo, assinatura ativa, admin com papel e permissões); falhas ficam como `failed`, o super admin recebe aviso em Comunicados e a conciliação tenta de novo.
- Cobranças mensais aprovadas renovam `current_period_end`; recusadas marcam `past_due`; cancelamento marca `canceled`.
- Segredos a cadastrar no Supabase: `MP_ACCESS_TOKEN` (obrigatório), `MP_WEBHOOK_SECRET` (recomendado).
