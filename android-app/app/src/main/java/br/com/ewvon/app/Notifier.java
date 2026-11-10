package br.com.ewvon.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.net.HttpURLConnection;
import java.net.URL;

/** Builds the native notifications (messages, notices, birthdays and the incoming-call screen). */
final class Notifier {
    static final String CH_SERVICE = "servico", CH_MSG = "mensagens", CH_NOTICE = "avisos", CH_CALL = "chamadas";
    private Notifier() { }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel s = new NotificationChannel(CH_SERVICE, "Conexão do ewvon", NotificationManager.IMPORTANCE_MIN);
        s.setDescription("Mantém o app conectado para receber mensagens e ligações."); s.setShowBadge(false);
        NotificationChannel m = new NotificationChannel(CH_MSG, "Mensagens", NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel a = new NotificationChannel(CH_NOTICE, "Avisos e aniversários", NotificationManager.IMPORTANCE_HIGH);
        NotificationChannel k = new NotificationChannel(CH_CALL, "Ligações", NotificationManager.IMPORTANCE_HIGH);
        k.setSound(null, null); k.enableVibration(false); k.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);   // the ringer plays the sound itself, non-stop
        nm.createNotificationChannel(s); nm.createNotificationChannel(m); nm.createNotificationChannel(a); nm.createNotificationChannel(k);
    }

    static PendingIntent open(Context c, String url, int code) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("url", url == null ? "/" : url);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Notification foreground(Context c) {
        channels(c);
        return new NotificationCompat.Builder(c, CH_SERVICE).setSmallIcon(R.drawable.ic_stat).setContentTitle("ewvon conectado")
                .setContentText("Recebendo mensagens e ligações").setOngoing(true).setPriority(NotificationCompat.PRIORITY_MIN)
                .setContentIntent(open(c, "/", 1)).build();
    }

    private static Bitmap fetch(String url) {
        if (url == null || !url.startsWith("https://")) return null;
        try {
            HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection(); h.setConnectTimeout(4000); h.setReadTimeout(4000);
            return BitmapFactory.decodeStream(h.getInputStream());
        } catch (Exception e) { return null; }
    }

    static void show(Context c, String kind, String title, String body, String tag, String url, String icon) {
        channels(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "message".equals(kind) ? CH_MSG : CH_NOTICE)
                .setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
                .setContentIntent(open(c, url, tag == null ? 2 : tag.hashCode())).setColor(0xFF2F3CFF);
        Bitmap bm = fetch(icon); if (bm != null) b.setLargeIcon(bm);
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(tag == null ? (int) System.nanoTime() : tag.hashCode(), b.build());
    }

    static void showCall(Context c, String callId, String title, String body, String url, String icon) {
        channels(c);
        Intent decline = new Intent(c, CallRinger.Receiver.class).setAction("br.com.ewvon.app.DECLINE").putExtra("callId", callId);
        PendingIntent dp = PendingIntent.getBroadcast(c, callId.hashCode(), decline, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent answer = open(c, url, callId.hashCode() + 1);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH_CALL)
                .setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(body).setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX).setOngoing(true).setAutoCancel(false).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(answer, true).setContentIntent(answer).setColor(0xFF16A34A)
                .addAction(0, "Atender", answer).addAction(0, "Recusar", dp);
        Bitmap bm = fetch(icon); if (bm != null) b.setLargeIcon(bm);
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(callId.hashCode(), b.build());
    }
}
