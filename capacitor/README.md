# Ewwon · app Android (Capacitor)

Empacota o mesmo build web do projeto (`npm run build` na raiz → `dist/`) como app Android.
No celular, o projeto já abre a experiência mobile Ewwon (`src/components/ewwon`); dentro do app
Android ela usa os plugins nativos (notificações locais/push, vibração, botão voltar, barra de status).

## Primeira vez
```bash
cd capacitor
npm run setup
```
Instala o Capacitor, gera o build web, cria `android/`, gera ícones/splash a partir de `assets/`
e copia sons e ícones de notificação (`resources/android`) com `scripts/prepare-android.js`.

## Gerar o APK
```bash
npm run build:debug
```
APK em `android/app/build/outputs/apk/debug/app-debug.apk`. Versão: campo `version` deste `package.json`.

## Notificações
Canais: `mensagens`, `avisos`, `reunioes`, `aniversarios`, `silencioso` (criados pelo app).
Regras aplicadas no app (`src/components/ewwon/notify.ts`): conversa silenciada, preferências do usuário,
status *Não incomodar* (só avisos) e *Silenciar fora do expediente*.

### Push com o app fechado (Firebase)
1. Crie o app Android `com.ewwon.app` no Firebase e coloque `google-services.json` em `android/app/`.
2. `npm run sync` e gere o APK. O app grava o token na tabela `push_devices` (Supabase).
3. O envio pelo FCM ainda precisa de um job no servidor que leia `push_devices` e respeite
   `chat_member_prefs` (silenciadas) e `user_preferences` — veja `API-original.md`, seção
   “Regras que o servidor deve aplicar”.
