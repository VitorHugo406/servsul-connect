package br.com.ewvon.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

/** Restarts the background connection after a reboot / update, and every few minutes (watchdog) in case the system or the maker's cleaner stopped it. */
public class BootReceiver extends BroadcastReceiver {
    static final String WATCHDOG = "br.com.ewvon.app.WATCHDOG";

    @Override public void onReceive(Context c, Intent i) { PollService.start(c); arm(c); }

    /** Exact alarm that survives Doze; each run re-arms the next one. */
    static void arm(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = PendingIntent.getBroadcast(c, 77, new Intent(c, BootReceiver.class).setAction(WATCHDOG), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            long at = SystemClock.elapsedRealtime() + 4 * 60_000L;
            try { am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi); }
            catch (SecurityException e) { am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi); }
        } catch (Exception ignored) { }
    }
}
