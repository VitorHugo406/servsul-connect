package br.com.ewvon.app;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps the app connected to the ewvon server in the background (no Chrome, no Google services): a long poll that returns the
 * instant there is a message, notice or call for this person. Runs as a foreground service so Android keeps it alive.
 */
public class PollService extends Service {
    private static final String ENDPOINT = "https://scslfueixmuolkmgdslk.supabase.co/functions/v1/native-poll";
    private static final String KEY = "sb_publishable_BliZc1EBDW4h3U3eL-4qYQ_b9ivGYkV";
    private volatile boolean running;
    private Thread worker;
    private PowerManager.WakeLock lock;

    static void start(Context c) {
        SharedPreferences p = c.getSharedPreferences("ewvon", Context.MODE_PRIVATE);
        if (p.getString("secret", "").isEmpty()) return;
        Intent i = new Intent(c, PollService.class);
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
    }
    static void stop(Context c) { c.stopService(new Intent(c, PollService.class)); }

    @Override public IBinder onBind(Intent i) { return null; }

    /** The app was swiped away from the recent apps: keep (or immediately restart) the connection. */
    @Override public void onTaskRemoved(Intent rootIntent) {
        try {
            Intent i = new Intent(getApplicationContext(), PollService.class);
            android.app.PendingIntent pi = android.app.PendingIntent.getService(getApplicationContext(), 91, i, android.app.PendingIntent.FLAG_ONE_SHOT | android.app.PendingIntent.FLAG_IMMUTABLE);
            android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) am.set(android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP, android.os.SystemClock.elapsedRealtime() + 1500, pi);
        } catch (Exception ignored) { }
        start(getApplicationContext());
        super.onTaskRemoved(rootIntent);
    }

    @Override public int onStartCommand(Intent i, int flags, int id) {
        Notifier.channels(this);
        if (Build.VERSION.SDK_INT >= 34) startForeground(7, Notifier.foreground(this), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(7, Notifier.foreground(this));
        BootReceiver.arm(this);
        if (!running) {
            running = true;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) { lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ewvon:poll"); lock.acquire(); }
            worker = new Thread(this::loop, "ewvon-poll"); worker.start();
        }
        return START_STICKY;
    }

    @Override public void onDestroy() {
        running = false; if (worker != null) worker.interrupt();
        if (lock != null && lock.isHeld()) lock.release();
        super.onDestroy();
    }

    private void loop() {
        SharedPreferences p = getSharedPreferences("ewvon", MODE_PRIVATE);
        long backoff = 1000;
        while (running) {
            String secret = p.getString("secret", "");
            if (secret.isEmpty()) { stopSelf(); return; }
            BootReceiver.arm(this);
            try {
                JSONObject req = new JSONObject().put("secret", secret).put("after", p.getLong("last", -1));
                HttpURLConnection h = (HttpURLConnection) new URL(ENDPOINT).openConnection();
                h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(10_000); h.setReadTimeout(40_000);
                h.setRequestProperty("Content-Type", "application/json"); h.setRequestProperty("apikey", KEY);
                try (OutputStream o = h.getOutputStream()) { o.write(req.toString().getBytes(StandardCharsets.UTF_8)); }
                int code = h.getResponseCode();
                if (code == 401) { p.edit().remove("secret").remove("last").apply(); stopSelf(); return; }   // this phone was signed out / removed
                if (code != 200) throw new java.io.IOException("http " + code);
                StringBuilder sb = new StringBuilder(); byte[] buf = new byte[4096]; int n;
                try (java.io.InputStream in = h.getInputStream()) { while ((n = in.read(buf)) > 0) sb.append(new String(buf, 0, n, StandardCharsets.UTF_8)); }
                JSONObject res = new JSONObject(sb.toString());
                JSONArray ev = res.optJSONArray("events");
                if (ev != null) for (int k = 0; k < ev.length(); k++) handle(ev.getJSONObject(k));
                p.edit().putLong("last", res.optLong("last", p.getLong("last", -1))).putLong("lastOk", System.currentTimeMillis()).apply();
                backoff = 1000;
            } catch (Exception e) {
                if (!running) return;
                try { Thread.sleep(backoff); } catch (InterruptedException ie) { return; }
                backoff = Math.min(backoff * 2, 30_000);
            }
        }
    }

    private void handle(JSONObject e) { Events.handle(this, e); }
}
