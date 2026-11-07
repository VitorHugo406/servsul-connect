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
