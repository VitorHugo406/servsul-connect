# Architecture rules

- Clean tab surfaces are scoped by section containers and semantic Card markers; chat, calendar, crisis screens and open task boards retain their domain presentation, while board selection uses the clean scope.
- Birthday presentation separates ordinary-user upcoming name/department lists from management report controls using authenticated roles; this is a display rule, not a change to database access.
- Meeting API resources are read-only, filtered by integration companies and active rooms, with profile identities for organizers/participants; availability subtracts persisted bookings from São Paulo room hours using half-open intervals.
- Apple-inspired glass uses shared semantic CSS optics and the Button base class on the web; do not install native Expo modules in the Vite application.
- Chat presentation uses shared semantic CSS classes and light/dark tokens across sectors, direct messages and groups, so visual changes stay consistent without changing message or permission logic.
- Manual unread reminders use a shared conversation wrapper and browser storage scoped by company and profile; they never rewrite delivery receipts or other participants' read status.
- Desktop navigation measures the main page's top edge so its alignment follows header height changes.
- Vite deduplicates React and React DOM; preview development never registers a service worker, and production workers never cache development modules, to prevent mixed React runtimes after updates.