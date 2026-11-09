# Architecture rules

- Clean tab surfaces are scoped by section containers and semantic Card markers; chat, calendar, crisis screens and open task boards retain their domain presentation, while board selection uses the clean scope.
- The main shell owns tab geometry; section roots inherit its radius without an inset shell frame, preserving individual controls and domain surfaces.
- Birthday presentation separates ordinary-user upcoming name/department lists from management report controls using authenticated roles; this is a display rule, not a change to database access.
- Meeting API resources are read-only, filtered by integration companies and active rooms, with profile identities for organizers/participants; availability subtracts persisted bookings from São Paulo room hours using half-open intervals.
- Integration management uses the canonical Supabase client URL and publishable key, never separate environment-derived endpoints, to prevent preview-host requests.
- The integration base URL provides an authenticated connection confirmation; resource paths accept trailing slashes so external connector checks do not fail on URL formatting.
- Apple-inspired glass uses shared semantic CSS optics and the Button base class on the web; do not install native Expo modules in the Vite application.
- Chat presentation uses shared semantic CSS classes and light/dark tokens across sectors, direct messages and groups, so visual changes stay consistent without changing message or permission logic.
- Chat emoji menus share a compact scrollable grid; desktop and composer menus use collision-aware portals to avoid clipping by conversation containers.
- Manual unread reminders use a shared conversation wrapper and browser storage scoped by company and profile; they never rewrite delivery receipts or other participants' read status.
- Desktop navigation measures the main page's top edge so its alignment follows header height changes.
- Vite deduplicates React and React DOM; preview development never registers a service worker, and production workers never cache development modules, to prevent mixed React runtimes after updates.- Test mode (desktop "Testar agora") swaps the shared Supabase client's methods for a localStorage store at boot, so real screens run with zero backend access; sessions expire after a fixed window and wipe their prefixed data.
- Phones (<768px) render the Ewwon mobile app (src/components/ewwon): prototype styles are scoped under `.ew`, global button glass excludes `.ew *`, data comes from the existing Supabase tables plus chat_member_prefs, user_preferences, support_tickets, chat_reactions and push_devices; the Android shell lives in capacitor/ and wraps the same dist build.
- Confirmations and text questions use appConfirm/appPrompt (src/lib/appDialog.ts, rendered by AppDialogHost on Radix Dialog) — never window.confirm/prompt/alert.
