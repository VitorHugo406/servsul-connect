# Architecture rules

- Chat presentation uses shared semantic CSS classes and light/dark tokens across sectors, direct messages and groups, so visual changes stay consistent without changing message or permission logic.
- Manual unread reminders use a shared conversation wrapper and browser storage scoped by company and profile; they never rewrite delivery receipts or other participants' read status.
- Desktop navigation measures the main page's top edge so its alignment follows header height changes.
- Vite deduplicates React and React DOM; preview development never registers a service worker, and production workers never cache development modules, to prevent mixed React runtimes after updates.