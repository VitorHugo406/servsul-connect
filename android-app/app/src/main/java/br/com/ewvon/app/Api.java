package br.com.ewvon.app;

import android.content.Context;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Calls made by the app itself (no web session): proves who it is with the device secret. */
final class Api {
    private static final String KEY = "sb_publishable_BliZc1EBDW4h3U3eL-4qYQ_b9ivGYkV";
    private Api() { }

    /** "Recusar" on the call notification: ends the call as declined and tells the caller. Retries a few times on bad networks. */
    static void declineCall(Context c, String callId) throws Exception {
        String secret = c.getSharedPreferences("ewvon", Context.MODE_PRIVATE).getString("secret", "");
        if (secret.isEmpty()) return;
        for (int i = 0; i < 3; i++) {
            try {
                HttpURLConnection h = (HttpURLConnection) new URL("https://scslfueixmuolkmgdslk.supabase.co/functions/v1/native-call-decline").openConnection();
                h.setRequestMethod("POST"); h.setDoOutput(true); h.setConnectTimeout(8000); h.setReadTimeout(8000);
                h.setRequestProperty("Content-Type", "application/json"); h.setRequestProperty("apikey", KEY);
                try (OutputStream o = h.getOutputStream()) { o.write(new JSONObject().put("secret", secret).put("callId", callId).toString().getBytes(StandardCharsets.UTF_8)); }
                int code = h.getResponseCode();
                if (code == 200 || code == 400 || code == 401) return;
            } catch (Exception ignored) { }
            Thread.sleep(1200);
        }
    }
}
