# ewvon · app Android (Trusted Web Activity)

Abre `https://ewvon.vercel.app` em tela cheia, sem barra de endereço, usando o Chrome do aparelho. Por isso as
notificações (Web Push) e as ligações chegam como no app instalado pelo Chrome, inclusive com o app fechado.

- `public/.well-known/assetlinks.json` liga o site a este app (impressão digital da chave de assinatura).
- Gerar: `ANDROID_HOME=<sdk> EWVON_KEYSTORE=<arquivo.keystore> EWVON_KS_PASS=<senha> gradle assembleRelease`
  → `app/build/outputs/apk/release/app-release.apk`; copie para `public/downloads/ewvon.apk`.
- **Guarde a chave (`.keystore`) e a senha em local seguro**: sem elas não dá para publicar atualizações do mesmo app.
  A chave NÃO fica no repositório. Se trocar de chave, atualize a impressão digital em `assetlinks.json`.
