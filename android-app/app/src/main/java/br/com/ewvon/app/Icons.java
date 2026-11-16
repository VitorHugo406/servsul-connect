package br.com.ewvon.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import java.util.Calendar;

/**
 * Seasonal launcher icon. Every theme is an activity-alias in the manifest (all bundled in the APK); exactly one is enabled.
 * The default alias keeps the old component name (.MainActivity) so shortcuts created by earlier versions keep working.
 * The birthday icon shows on the signed-in person's birthday (MM-DD sent by the site through the bridge).
 */
final class Icons {
    private Icons() { }

    /** Alias names, in the order they are checked is decided by choose(). ".MainActivity" is the default (graphite) icon. */
    private static final String[] ALIASES = {".MainActivity", ".IconAniversario", ".IconNatal", ".IconAnoNovo", ".IconCarnaval", ".IconPascoa",
            ".IconMaes", ".IconNamorados", ".IconJunina", ".IconCriancas", ".IconHalloween"};

    static void setBirthday(Context c, String mmdd) { setBirthday(c, mmdd, null); }

    static void setBirthday(Context c, String mmdd, String firstName) {
        SharedPreferences.Editor e = c.getSharedPreferences("ewvon", Context.MODE_PRIVATE).edit().putString("birthday", mmdd == null ? "" : mmdd);
        if (firstName != null) e.putString("birthday_name", firstName);
        e.apply();
        apply(c);
    }

    /** One "Feliz aniversario" notification per birthday, from 08:00 on (this runs on app open and on the watchdog alarm, so the app need not be open). */
    private static void greet(Context c, SharedPreferences p, Calendar t) {
        String bd = p.getString("birthday", "");
        String today = String.format("%04d-%02d-%02d", t.get(Calendar.YEAR), t.get(Calendar.MONTH) + 1, t.get(Calendar.DAY_OF_MONTH));
        if (bd.length() != 5 || !bd.equals(today.substring(5)) || t.get(Calendar.HOUR_OF_DAY) < 8 || today.equals(p.getString("bday_greeted", ""))) return;
        if (p.getString("secret", "").isEmpty()) return;   // signed out on this phone
        String name = p.getString("birthday_name", "");
        Notifier.show(c, "notice", "\uD83C\uDF82 Feliz anivers\u00e1rio" + (name.isEmpty() ? "" : ", " + name) + "!",
                "Hoje \u00e9 o seu dia! \uD83C\uDF89\n\nToda a equipe ewvon agradece por fazer parte da nossa hist\u00f3ria e deseja um dia cheio de alegria, sa\u00fade, paz e muitas conquistas.\n\nQue este novo ciclo traga ainda mais realiza\u00e7\u00f5es, bons momentos ao lado de quem voc\u00ea ama e muito sucesso na sua jornada.\n\nAproveite cada instante, voc\u00ea merece! \uD83E\uDD73\uD83C\uDF88", "bday-" + today, "/", null);
        p.edit().putString("bday_greeted", today).apply();
    }

    private static int doy(Calendar x) { return x.get(Calendar.DAY_OF_YEAR); }
    private static boolean between(Calendar t, Calendar a, Calendar b) { return doy(t) >= doy(a) && doy(t) <= doy(b); }
    private static Calendar day(int year, int month, int d) { Calendar c = Calendar.getInstance(); c.clear(); c.set(year, month, d, 12, 0); return c; }
    private static Calendar shift(Calendar c, int days) { Calendar r = (Calendar) c.clone(); r.add(Calendar.DAY_OF_MONTH, days); return r; }

    /** Easter Sunday (Gregorian, Meeus/Jones/Butcher). */
    static Calendar easter(int y) {
        int a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4, f = (b + 8) / 25, g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31, dd = ((h + l - 7 * m + 114) % 31) + 1;
        return day(y, month - 1, dd);
    }

    /** Which alias should be on today. */
    static String choose(Calendar t, String birthday) {
        int y = t.get(Calendar.YEAR), mo = t.get(Calendar.MONTH) + 1, d = t.get(Calendar.DAY_OF_MONTH);
        if (birthday != null && birthday.length() == 5 && birthday.equals(String.format("%02d-%02d", mo, d))) return ".IconAniversario";
        Calendar easter = easter(y);
        if (between(t, shift(easter, -52), shift(easter, -46))) return ".IconCarnaval";                       // the week before Carnival until Ash Wednesday
        if (between(t, shift(easter, -7), easter)) return ".IconPascoa";
        Calendar mothers = day(y, Calendar.MAY, 1); while (mothers.get(Calendar.DAY_OF_WEEK) != Calendar.SUNDAY) mothers.add(Calendar.DAY_OF_MONTH, 1); mothers.add(Calendar.DAY_OF_MONTH, 7);
        if (between(t, shift(mothers, -7), mothers)) return ".IconMaes";
        if (mo == 12 && d >= 26 || mo == 1 && d <= 2) return ".IconAnoNovo";
        if (mo == 12) return ".IconNatal";                                                                  // Dec 1 - Dec 25
        if (mo == 6 && d >= 7 && d <= 12) return ".IconNamorados";
        if (mo == 6 && d >= 13) return ".IconJunina";
        if (mo == 10 && d >= 8 && d <= 12) return ".IconCriancas";
        if (mo == 10 && d >= 24) return ".IconHalloween";
        return ".MainActivity";
    }

    /** Enables the wanted alias first, then disables the others (never leaves the app without a launcher icon). */
    static void apply(Context ctx) {
        try {
            Context c = ctx.getApplicationContext();
            SharedPreferences p = c.getSharedPreferences("ewvon", Context.MODE_PRIVATE);
            greet(c, p, Calendar.getInstance());
            String want = choose(Calendar.getInstance(), p.getString("birthday", ""));
            if (want.equals(p.getString("icon", ".MainActivity")) && c.getPackageManager().getComponentEnabledSetting(new ComponentName(c, "br.com.ewvon.app" + want)) != PackageManager.COMPONENT_ENABLED_STATE_DISABLED) return;
            PackageManager pm = c.getPackageManager();
            pm.setComponentEnabledSetting(new ComponentName(c, "br.com.ewvon.app" + want), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (String a : ALIASES) if (!a.equals(want)) pm.setComponentEnabledSetting(new ComponentName(c, "br.com.ewvon.app" + a), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            p.edit().putString("icon", want).apply();
        } catch (Exception ignored) { }
    }
}
