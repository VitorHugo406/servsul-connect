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

/** The ewvon app: the site in a full-screen WebView (no browser involved) + a native background service for notifications and calls. */
public class MainActivity extends Activity {
    static final String HOME = "https://ewvon.vercel.app/";
    static volatile boolean visible = false;
    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest pendingPerm;
    private static final int REQ_FILE = 11, REQ_MEDIA = 12, REQ_NOTIF = 13;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.setStatusBarColor(0xFF08080A); w.setNavigationBarColor(0xFF08080A);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF08080A);
        web = new WebView(this);
        web.setBackgroundColor(0xFF08080A);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); s.setAllowFileAccess(false); s.setLoadWithOverviewMode(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " EwvonApp/" + BuildConfigVersion.NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "EwvonNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl(); String h = u.getHost() == null ? "" : u.getHost();
                if ("https".equals(u.getScheme()) && (h.equals("ewvon.vercel.app") || h.endsWith(".supabase.co"))) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadData("<html><body style='margin:0;background:#08080a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'><div><h2>Sem conexão</h2><p style='opacity:.7'>Verifique a internet e tente de novo.</p><button style='padding:12px 22px;border-radius:12px;border:0;font-size:16px' onclick=\"location.href='" + HOME + "?app=1'\">Tentar de novo</button></div></body></html>", "text/html", "utf-8");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), REQ_FILE); } catch (Exception e) { fileCb = null; return false; }
                return true;
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
    @Override protected void onResume() { super.onResume(); visible = true; CallRinger.stopAll(this); web.onResume(); PollService.start(this); askBattery(); askFullScreen(); }
    @Override protected void onPause() { visible = false; web.onPause(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
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
        } else if (req == REQ_NOTIF) askBattery();
    }

    /** What the web app calls (window.EwvonNative) to tie this phone to the signed-in person. */
    private class Bridge {
        private SharedPreferences p() { return getSharedPreferences("ewvon", MODE_PRIVATE); }
        @JavascriptInterface public boolean isNative() { return true; }
        @JavascriptInterface public String getDevice() { return p().getString("secret", ""); }
        @JavascriptInterface public String getDeviceProfile() { return p().getString("profile", ""); }
        @JavascriptInterface public void setDevice(String secret, String profileId) {
            p().edit().putString("secret", secret).putString("profile", profileId).putLong("last", -1).apply();
            PollService.start(getApplicationContext());
        }
        /** JSON for the Settings screen: is the background connection alive and unrestricted? */
        @JavascriptInterface public String status() {
            long ok = p().getLong("lastOk", 0);
            boolean fsi = Build.VERSION.SDK_INT < 34 || ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).canUseFullScreenIntent();
            return "{\"registered\":" + (!p().getString("secret", "").isEmpty()) + ",\"battery\":" + ignoringBattery() + ",\"lastOkSecondsAgo\":" + (ok == 0 ? -1 : (System.currentTimeMillis() - ok) / 1000) + ",\"fullScreen\":" + fsi + "}";
        }
        @JavascriptInterface public void fixBattery() { runOnUiThread(MainActivity.this::requestBatteryWhitelist); }
        @JavascriptInterface public void openBackgroundSettings() { runOnUiThread(MainActivity.this::openBackgroundSettings); }
        @JavascriptInterface public void clearDevice() {
            p().edit().remove("secret").remove("profile").remove("last").apply();
            PollService.stop(getApplicationContext());
        }
    }
}
