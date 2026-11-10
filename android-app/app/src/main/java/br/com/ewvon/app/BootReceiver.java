package br.com.ewvon.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restarts the background connection after the phone reboots or the app is updated. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { PollService.start(c); }
}
