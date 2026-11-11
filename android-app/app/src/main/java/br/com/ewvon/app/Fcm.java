package br.com.ewvon.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Firebase Cloud Messaging: the system wakes the app for each message or call, even when it was closed. */
public class Fcm extends FirebaseMessagingService {
    private static final String RPC = "https://scslfueixmuolkmgdslk.supabase.co/rest/v1/rpc/native_set_fcm";
    private static final String KEY = "sb_publishable_BliZc1EBDW4h3U3eL-4qYQ_b9ivGYkV";

    @Override public void onNewToken(String token) {
        getSharedPreferences("ewvon", MODE_PRIVATE).edit().putString("fcm", token).putBoolean("fcm_sent", false).apply();
        sync(getApplicationContext());
    }

    @Override public void onMessageReceived(RemoteMessage m) {
        try { String p = m.getData().get("p"); if (p != null) Events.handle(getApplicationContext(), new JSONObject(p)); } catch (Exception ignored) { }
    }

    /** Fetches the Firebase token and tells the server which token belongs to this phone's registered device. */
    static void sync(Context c) {
        SharedPreferences p = c.getSharedPreferences("ewvon", Context.MODE_PRIVATE);
        try {
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(t -> { if (t != null) { p.edit().putString("fcm", t).apply(); push(c); } });
        } catch (Exception ignored) { }
    }

    static void push(Context c) {
        SharedPreferences p = c.getSharedPreferences("ewvon", Context.MODE_PRIVATE);
        final String secret = p.getString("secret", ""), token = p.getString("fcm", "");
        if (secret.isEmpty() || token.isEmpty() || (p.getBoolean("fcm_sent", false) && secret.equals(p.getString("fcm_secret", "")))) return;
        new Thread(() -> {
            try {
                HttpURLConnection h = (HttpURLConnection) new URL(RPC).openConnection();
                h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(10_000); h.setReadTimeout(15_000);
                h.setRequestProperty("Content-Type", "application/json"); h.setRequestProperty("apikey", KEY);
                try (OutputStream o = h.getOutputStream()) { o.write(new JSONObject().put("_secret", secret).put("_token", token).toString().getBytes(StandardCharsets.UTF_8)); }
                if (h.getResponseCode() / 100 == 2) p.edit().putBoolean("fcm_sent", true).putString("fcm_secret", secret).apply();
            } catch (Exception ignored) { }
        }, "ewvon-fcm").start();
    }
}
