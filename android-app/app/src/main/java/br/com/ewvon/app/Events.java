package br.com.ewvon.app;

import android.content.Context;
import org.json.JSONObject;

/** One place that turns a server event (from the background connection or from Firebase) into a notification or a ringing call. */
final class Events {
    private Events() { }

    static void handle(Context c, JSONObject e) {
        String kind = e.optString("kind");
        if ("call-end".equals(kind)) { CallRinger.stop(c, e.optString("callId")); return; }
        if (MainActivity.visible) return;   // the app is on screen: the site shows its own banner and ringtone
        String title = e.optString("title", "ewvon"), body = e.optString("body", ""), url = e.optString("url", "/"), icon = e.optString("icon", null);
        if ("call".equals(kind)) CallRinger.start(c, e.optString("callId"), title, body, url, icon);
        else Notifier.show(c, kind, title, body, e.optString("tag", null), url, icon);
    }
}
