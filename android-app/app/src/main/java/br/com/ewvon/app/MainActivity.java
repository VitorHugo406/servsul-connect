package br.com.ewvon.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** The ewvon app: the site in a full-screen WebView (no browser involved) + a native background service for notifications and calls. */
public class MainActivity extends Activity {
    static final String HOME = "https://ewvon.vercel.app/";
    static volatile boolean visible = false;
    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest pendingPerm;
    private static final int REQ_FILE = 11, REQ_MEDIA = 12, REQ_NOTIF = 13, REQ_GEO = 14;
    private android.webkit.GeolocationPermissions.Callback geoCb; private String geoOrigin;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        // Edge-to-edge (like Google's apps): the page draws behind transparent status/navigation bars; the site keeps
        // those areas empty using --ew-satop/--ew-sabottom (CSS px) injected below, so the side-menu animation and the
        // rounded corners reach the real screen edges.
        WindowCompat.setDecorFitsSystemWindows(w, false);
        w.setStatusBarColor(0x00000000); w.setNavigationBarColor(0x00000000);
        if (Build.VERSION.SDK_INT >= 29) { w.setStatusBarContrastEnforced(false); w.setNavigationBarContrastEnforced(false); }
        if (Build.VERSION.SDK_INT >= 28) w.getAttributes().layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        setBarIcons(false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF08080A);
        // the WebView starts its own floating text toolbar (Google, Compartilhar...): route it through EmptySelection
        web = new WebView(this) {
            @Override public android.view.ActionMode startActionMode(android.view.ActionMode.Callback cb, int type) {
                return super.startActionMode(type == android.view.ActionMode.TYPE_FLOATING ? new EmptySelection(cb) : cb, type);
            }
            @Override public android.view.ActionMode startActionMode(android.view.ActionMode.Callback cb) {
                return super.startActionMode(new EmptySelection(cb));
            }
        };
        web.setBackgroundColor(0xFF08080A);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, ins) -> {
            Insets bars = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = ins.getInsets(WindowInsetsCompat.Type.ime());
            boolean kb = ins.isVisible(WindowInsetsCompat.Type.ime()) && ime.bottom > bars.bottom;
            v.setPadding(0, 0, 0, kb ? ime.bottom : 0);   // keyboard: shrink the WebView (adjustResize no longer applies)
            float d = getResources().getDisplayMetrics().density;
            insTop = Math.round(bars.top / d); insBottom = kb ? 0 : Math.round(bars.bottom / d);
            pushInsets();
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); s.setAllowFileAccess(false); s.setLoadWithOverviewMode(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setGeolocationEnabled(true);
        s.setUserAgentString(s.getUserAgentString() + " EwvonApp/" + BuildConfigVersion.NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "EwvonNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl(); String h = u.getHost() == null ? "" : u.getHost();
                if ("https".equals(u.getScheme()) && (h.equals("ewvon.vercel.app") || h.endsWith(".supabase.co"))) return false;
                // a shared location (geo:) always offers every map app installed (Maps, Waze, …)
                if ("geo".equals(u.getScheme())) { try { startActivity(Intent.createChooser(new Intent(Intent.ACTION_VIEW, u), "Abrir localização com")); } catch (Exception ignored) { } return true; }
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override public void onPageCommitVisible(WebView v, String url) { pushInsets(); }
            @Override public void onPageFinished(WebView v, String url) { pushInsets(); }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadData("<html><body style='margin:0;background:#08080a;color:#fff;font-family:sans-serif;padding:0 24px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'><div><h2>Sem conexão</h2><p style='opacity:.7'>Verifique a internet e tente de novo.</p><button style='padding:12px 22px;border-radius:12px;border:0;font-size:16px' onclick=\"location.href='" + HOME + "?app=1'\">Tentar de novo</button></div></body></html>", "text/html", "utf-8");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
            // chat "+" › Localização › "Usar minha localização atual" (only when the person taps it)
            @Override public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback cb) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) { cb.invoke(origin, true, false); return; }
                geoCb = cb; geoOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_GEO);
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean cam = false, mic = false;
                    for (String r : request.getResources()) { if (r.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) cam = true; if (r.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) mic = true; }
                    boolean ok = (!cam || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) && (!mic || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED);
                    if (ok) { request.grant(request.getResources()); return; }
                    pendingPerm = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}, REQ_MEDIA);
                });
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            try {
                DownloadManager.Request q = new DownloadManager.Request(Uri.parse(url));
                String name = URLUtil.guessFileName(url, cd, mime);
                q.setMimeType(mime).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED).setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(q);
            } catch (Exception e) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        });

        devHook(getIntent());
        if (b == null) web.loadUrl(urlFrom(getIntent()));
        else web.restoreState(b);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        else askBattery();
        PollService.start(this);
        Fcm.sync(this);
    }

    /** Only in debug builds (used by tests): sets the device secret from an intent extra. */
    private void devHook(Intent i) {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0 || i == null || !i.hasExtra("dev_secret")) return;
        getSharedPreferences("ewvon", MODE_PRIVATE).edit().putString("secret", i.getStringExtra("dev_secret")).putString("profile", "dev").putLong("last", -1).apply();
    }

    private String urlFrom(Intent i) {
        String u = i != null ? i.getStringExtra("url") : null;
        if (u != null && u.startsWith("/")) return HOME + u.substring(1);
        return HOME + "?app=1";
    }

    boolean ignoringBattery() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm == null || pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    /** Without this Android pauses the network of a closed app while the phone sleeps (Doze) and notifications stop arriving. Asked again until granted. */
    private void askBattery() {
        SharedPreferences p = getSharedPreferences("ewvon", MODE_PRIVATE);
        if (ignoringBattery()) return;
        long last = p.getLong("battery_asked_at", 0);
        if (System.currentTimeMillis() - last < 6 * 3600_000L) return;
        p.edit().putLong("battery_asked_at", System.currentTimeMillis()).apply();
        requestBatteryWhitelist();
    }

    void requestBatteryWhitelist() {
        try { startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName()))); }
        catch (Exception e) { try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception ignored) { } }
    }

    /** Opens the manufacturer's "auto-start / background" screen when it exists (Xiaomi, Oppo, Vivo, Huawei, Samsung...), else the app settings. */
    void openBackgroundSettings() {
        String[][] oem = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"},
        };
        for (String[] c : oem) {
            try { startActivity(new Intent().setComponent(new android.content.ComponentName(c[0], c[1]))); return; } catch (Exception ignored) { }
        }
        try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
    }

    private static boolean aggressiveMaker() {
        String m = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
        return m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") || m.contains("huawei") || m.contains("honor") || m.contains("oppo") || m.contains("realme") || m.contains("vivo") || m.contains("oneplus") || m.contains("samsung") || m.contains("asus") || m.contains("tecno") || m.contains("infinix");
    }

    /** Xiaomi/HyperOS: the "no restrictions" battery screen for this app. */
    void openMakerBattery() {
        try { startActivity(new Intent().setComponent(new android.content.ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")).putExtra("package_name", getPackageName()).putExtra("package_label", "ewvon")); return; } catch (Exception ignored) { }
        try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
    }

    /** Phones from makers that close apps swiped from the recents list need these settings, or notifications stop with the app closed. Shown until confirmed. */
    private void makerGuide() {
        SharedPreferences p = getSharedPreferences("ewvon", MODE_PRIVATE);
        if (!aggressiveMaker() || p.getBoolean("maker_done", false) || !p.getBoolean("battery_step_done", false) && !ignoringBattery()) return;
        if (isFinishing() || System.currentTimeMillis() - p.getLong("maker_asked_at", 0) < 4 * 3600_000L) return;
        p.edit().putLong("maker_asked_at", System.currentTimeMillis()).apply();
        boolean xiaomi = Build.MANUFACTURER != null && Build.MANUFACTURER.toLowerCase().matches(".*(xiaomi|redmi|poco).*");
        String msg = "Para receber mensagens e ligações com o app FECHADO, este celular precisa de 3 ajustes:\n\n"
                + "1. Início automático: ligue o ewvon.\n"
                + (xiaomi ? "2. Economia de bateria: escolha \"Sem restrições\".\n" : "2. Bateria: permita o uso em segundo plano / sem restrições.\n")
                + "3. Na lista de apps recentes, segure o card do ewvon e toque no cadeado (fixar), para o sistema não fechar o app.\n\nToque em cada botão, faça o ajuste e volte.";
        android.app.AlertDialog.Builder b = new android.app.AlertDialog.Builder(this).setTitle("Ajustes para as notificações").setMessage(msg).setCancelable(false)
                .setPositiveButton("1. Início automático", (d, w) -> openBackgroundSettings())
                .setNeutralButton(xiaomi ? "2. Bateria" : "2. Bateria", (d, w) -> { if (xiaomi) openMakerBattery(); else requestBatteryWhitelist(); })
                .setNegativeButton("Já fiz tudo", (d, w) -> p.edit().putBoolean("maker_done", true).apply());
        b.show();
    }

    /** Android 14+: full-screen incoming-call screen must be allowed by the user. */
    private void askFullScreen() {
        if (Build.VERSION.SDK_INT < 34) return;
        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        SharedPreferences p = getSharedPreferences("ewvon", MODE_PRIVATE);
        if (nm == null || nm.canUseFullScreenIntent() || p.getBoolean("fsi_asked", false)) return;
        p.edit().putBoolean("fsi_asked", true).apply();
        try { startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getPackageName()))); } catch (Exception ignored) { }
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i); setIntent(i); devHook(i);
        if (i.hasExtra("url")) web.loadUrl(urlFrom(i));
        CallRinger.stopAll(this);
    }
    @Override protected void onResume() { super.onResume(); visible = true; Icons.apply(this); CallRinger.stopAll(this); web.onResume(); PollService.start(this); BootReceiver.arm(this); askBattery(); askFullScreen(); web.postDelayed(this::makerGuide, 4000); }
    @Override protected void onPause() { visible = false; web.onPause(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
    private static final class EmptySelection extends android.view.ActionMode.Callback2 {
        private final android.view.ActionMode.Callback base;
        EmptySelection(android.view.ActionMode.Callback b) { base = b; }
        @Override public boolean onCreateActionMode(android.view.ActionMode m, android.view.Menu menu) { boolean r = base.onCreateActionMode(m, menu); trim(menu); return r; }
        @Override public boolean onPrepareActionMode(android.view.ActionMode m, android.view.Menu menu) { boolean r = base.onPrepareActionMode(m, menu); trim(menu); return r; }
        /** Text in a message: nothing (the site shows its own Copiar / Selecionar tudo bar). Text being typed (the menu
         *  has Recortar/Colar): only Recortar, Copiar, Colar and Selecionar tudo — never the Google/assistant items. */
        private static void trim(android.view.Menu menu) {
            boolean editable = menu.findItem(android.R.id.paste) != null || menu.findItem(android.R.id.cut) != null;
            if (!editable) { menu.clear(); return; }
            for (int i = menu.size() - 1; i >= 0; i--) {
                int id = menu.getItem(i).getItemId();
                if (id != android.R.id.cut && id != android.R.id.copy && id != android.R.id.paste && id != android.R.id.selectAll) menu.removeItem(id);
            }
        }
        @Override public boolean onActionItemClicked(android.view.ActionMode m, android.view.MenuItem item) { return base.onActionItemClicked(m, item); }
        @Override public void onDestroyActionMode(android.view.ActionMode m) { base.onDestroyActionMode(m); }
        @Override public void onGetContentRect(android.view.ActionMode m, View v, android.graphics.Rect out) {
            if (base instanceof android.view.ActionMode.Callback2) ((android.view.ActionMode.Callback2) base).onGetContentRect(m, v, out); else super.onGetContentRect(m, v, out);
        }
    }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE && fileCb != null) { fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); fileCb = null; }
        else super.onActivityResult(req, res, data);
    }
    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        if (req == REQ_MEDIA && pendingPerm != null) {
            boolean any = false; for (int r : results) if (r == PackageManager.PERMISSION_GRANTED) any = true;
            if (any) pendingPerm.grant(pendingPerm.getResources()); else pendingPerm.deny();
            pendingPerm = null;
        } else if (req == REQ_GEO && geoCb != null) {
            boolean any = false; for (int r : results) if (r == PackageManager.PERMISSION_GRANTED) any = true;
            geoCb.invoke(geoOrigin, any, false); geoCb = null;
        } else if (req == REQ_NOTIF) askBattery();
    }

    /** What the web app calls (window.EwvonNative) to tie this phone to the signed-in person. */
    private int insTop = 0, insBottom = 0;
    private void pushInsets() {
        if (web == null) return;
        web.evaluateJavascript("(function(){var s=document.documentElement.style;s.setProperty('--ew-satop','" + insTop + "px');s.setProperty('--ew-sabottom','" + insBottom + "px');document.documentElement.classList.add('ew-e2e')})()", null);
    }
    /** Dark icons on a light page, light icons on a dark page; the bars themselves stay transparent. */
    private void setBarIcons(boolean lightPage) {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setAppearanceLightStatusBars(lightPage); c.setAppearanceLightNavigationBars(lightPage);
    }

    private class Bridge {
        @JavascriptInterface public void setBarStyle(String mode) { runOnUiThread(() -> setBarIcons("light".equals(mode))); }
        @JavascriptInterface public String getInsets() { return insTop + "," + insBottom; }
        private SharedPreferences p() { return getSharedPreferences("ewvon", MODE_PRIVATE); }
        @JavascriptInterface public boolean isNative() { return true; }
        @JavascriptInterface public String getDevice() { return p().getString("secret", ""); }
        @JavascriptInterface public void setBirthday(String mmdd) { Icons.setBirthday(getApplicationContext(), mmdd); }
        @JavascriptInterface public void setBirthdayInfo(String mmdd, String firstName) { Icons.setBirthday(getApplicationContext(), mmdd, firstName); }
        @JavascriptInterface public String getDeviceProfile() { return p().getString("profile", ""); }
        @JavascriptInterface public void setDevice(String secret, String profileId) {
            p().edit().putString("secret", secret).putString("profile", profileId).putLong("last", -1).apply();
            PollService.start(getApplicationContext());
            Fcm.sync(getApplicationContext());
        }
        /** JSON for the Settings screen: is the background connection alive and unrestricted? */
        @JavascriptInterface public String status() {
            long ok = p().getLong("lastOk", 0);
            boolean fsi = Build.VERSION.SDK_INT < 34 || ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).canUseFullScreenIntent();
            return "{\"registered\":" + (!p().getString("secret", "").isEmpty()) + ",\"battery\":" + ignoringBattery() + ",\"lastOkSecondsAgo\":" + (ok == 0 ? -1 : (System.currentTimeMillis() - ok) / 1000) + ",\"fullScreen\":" + fsi + "}";
        }
        @JavascriptInterface public void markMakerDone() { p().edit().putBoolean("maker_done", true).apply(); }
        @JavascriptInterface public void openMakerBattery() { runOnUiThread(MainActivity.this::openMakerBattery); }
        @JavascriptInterface public void fixBattery() { runOnUiThread(MainActivity.this::requestBatteryWhitelist); }
        @JavascriptInterface public void openBackgroundSettings() { runOnUiThread(MainActivity.this::openBackgroundSettings); }
        @JavascriptInterface public void clearDevice() {
            p().edit().remove("secret").remove("profile").remove("last").apply();
            PollService.stop(getApplicationContext());
        }
    }
}
