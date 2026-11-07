#!/usr/bin/env node
/* Prepara o projeto Android gerado pelo Capacitor (rode depois de `npx cap add android` / `cap sync`):
   - copia sons (res/raw), ícones de notificação e cores
   - adiciona permissões e metadados do Firebase no AndroidManifest
   - define versionName / versionCode a partir do package.json
   É seguro rodar várias vezes. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), and = path.join(root, 'android');
const res = path.join(and, 'app/src/main/res');
if (!fs.existsSync(and)) { console.error('✖ Pasta android/ não existe. Rode primeiro: npx cap add android'); process.exit(1); }

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, f.name), d = path.join(dst, f.name);
    f.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
copyDir(path.join(root, 'resources/android'), res);
console.log('✔ Sons, ícones de notificação e cores copiados para res/');

/* ---- AndroidManifest.xml ---- */
const mf = path.join(and, 'app/src/main/AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE',
 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.SCHEDULE_EXACT_ALARM'].forEach(p => {
  if (!x.includes('"' + p + '"')) x = x.replace('</manifest>', '    <uses-permission android:name="' + p + '" />\n</manifest>');
});
[['com.google.firebase.messaging.default_notification_icon', 'android:resource="@drawable/ic_stat_ewwon"'],
 ['com.google.firebase.messaging.default_notification_color', 'android:resource="@color/ewwon_notification"'],
 ['com.google.firebase.messaging.default_notification_channel_id', 'android:value="mensagens"']].forEach(([n, v]) => {
  if (!x.includes(n)) x = x.replace('</application>', '        <meta-data android:name="' + n + '" ' + v + ' />\n    </application>');
});
fs.writeFileSync(mf, x);
console.log('✔ AndroidManifest.xml atualizado (permissões + canal padrão do FCM)');

/* ---- versão ---- */
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const [M, m, p] = pkg.version.split('.').map(n => parseInt(n, 10) || 0);
const code = process.env.VERSION_CODE ? parseInt(process.env.VERSION_CODE, 10) : M * 10000 + m * 100 + p;
const gf = path.join(and, 'app/build.gradle');
let g = fs.readFileSync(gf, 'utf8');
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + pkg.version + '"');
fs.writeFileSync(gf, g);
console.log('✔ versionName ' + pkg.version + ' · versionCode ' + code);

if (!fs.existsSync(path.join(and, 'app/google-services.json')))
  console.warn('⚠ Falta android/app/google-services.json (Firebase). Sem ele o push com o app fechado não funciona. Veja o README.');
