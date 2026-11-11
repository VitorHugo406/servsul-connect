package br.com.ewvon.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import java.util.HashMap;
import java.util.Map;

/** Rings like a phone: the default ringtone loops and the phone vibrates until the call is answered, refused, ended or 60 s pass. */
final class CallRinger {
    private static final Handler H = new Handler(Looper.getMainLooper());
    private static final Map<String, Runnable> TIMEOUTS = new HashMap<>();
    private static Ringtone ringtone;
    private static final Map<String, Long> ENDED = new HashMap<>();   // calls already answered/refused/ended: late duplicate events must not ring again
    private CallRinger() { }

    static synchronized void start(Context c, String callId, String title, String body, String url, String icon) {
        Context app = c.getApplicationContext();
        long now = System.currentTimeMillis();
        for (String k : ENDED.keySet().toArray(new String[0])) if (now - ENDED.get(k) > 180_000) ENDED.remove(k);
        if (ENDED.containsKey(callId) || TIMEOUTS.containsKey(callId)) return;   // already handled / already ringing (poll + Firebase deliver the same call)
        Notifier.showCall(app, callId, title, body, url, icon);
        if (ringtone == null) {
            Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(app, u);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= 28) ringtone.setLooping(true);
                ringtone.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                ringtone.play();
            }
            Vibrator v = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                long[] pat = {0, 900, 500, 900, 500};
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pat, 0)); else v.vibrate(pat, 0);
            }
        }
        Runnable t = () -> stop(app, callId);
        TIMEOUTS.put(callId, t);
        H.postDelayed(t, 62_000);
    }

    static synchronized void stop(Context c, String callId) {
        ENDED.put(callId, System.currentTimeMillis());
        Runnable t = TIMEOUTS.remove(callId); if (t != null) H.removeCallbacks(t);
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(callId.hashCode());
        if (TIMEOUTS.isEmpty()) silence(c);
    }

    static synchronized void stopAll(Context c) {
        for (String id : TIMEOUTS.keySet().toArray(new String[0])) stop(c, id);
        TIMEOUTS.clear();
        silence(c);
    }

    private static void silence(Context c) {
        if (ringtone != null) { try { ringtone.stop(); } catch (Exception ignored) { } ringtone = null; }
        Context app = c.getApplicationContext();
        Vibrator v = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) { try { v.cancel(); } catch (Exception ignored) { } }
        // Some phones keep a repeating waveform alive after cancel(): a very short one-shot replaces it, then cancel again.
        if (v != null && Build.VERSION.SDK_INT >= 26) { try { v.vibrate(VibrationEffect.createOneShot(1, 1)); v.cancel(); } catch (Exception ignored) { } }
    }

    static boolean ringing() { return ringtone != null; }

    /** "Recusar" on the call notification. */
    public static class Receiver extends BroadcastReceiver {
        @Override public void onReceive(Context c, Intent i) {
            String id = i.getStringExtra("callId"); if (id == null) return;
            stop(c, id);
            final Context app = c.getApplicationContext();
            final PendingResult pr = goAsync();
            new Thread(() -> { try { Api.declineCall(app, id); } catch (Exception ignored) { } finally { pr.finish(); } }).start();
        }
    }
}
