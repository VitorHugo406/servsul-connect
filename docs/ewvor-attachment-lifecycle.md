# Ewvor attachments: implementation and rollout plan

## Current status

This branch is intentionally isolated from the production branch. Do not apply storage-policy changes to production until the application and the storage migration are deployed together.

## Required behavior

1. Upload a file to a private temporary object in Supabase Storage.
2. Store lifecycle metadata for each attachment: sender user ID, object key, creation time, temporary expiry time (24 hours), original-file availability, and an opaque device registration ID. Never store a local filesystem path as a server-accessible URL.
3. Authorize every download on the server. The sender and only the participants of the message/conversation can request a short-lived signed URL. A random object key is not authorization.
4. A scheduled server-side cleanup removes expired temporary objects and marks their metadata as expired. The cleanup must use service-role credentials in a server-side scheduled job only.
5. After expiry, the web client must not fall back to the old public URL. It requests a transfer from the sender's registered desktop companion. If the companion is offline, the UI reports the file unavailable until it reconnects.
6. If the sender deletes the original file, the companion must return a not-found response. A recipient's separately downloaded copy is independent and cannot be revoked.

## Important implementation constraint

The current application is a browser-based React app. It has no desktop companion, device registration, signaling service, or peer-to-peer transfer implementation. A browser tab cannot reliably serve local files after it closes, after the device goes offline, or after browser permissions are revoked. The 24-hour fallback therefore cannot be truthfully marked complete until the companion and its authenticated transfer protocol are built and tested.

## Storage security findings

- The current chat uploader uses paths of the form `<auth-user-id>/<timestamp>.<extension>`.
- The existing security-hardening migration checks the first path segment against `attachments.id`, which does not match the uploader's current path format.
- Chat attachment links are embedded in message content, and the browser-side signed URL helper falls back to the original URL when signing fails. That fallback is unsafe once the bucket is private and can also conceal authorization failures.
- Avatars currently use public URLs. Changing the avatar bucket to private without migrating every avatar consumer would break profile images.

## Safe rollout sequence

1. Introduce attachment metadata and an authorization-aware server endpoint that resolves conversation participants before issuing short-lived URLs.
2. Update all chat attachment uploaders/renderers to use opaque object keys and the authorized endpoint. Remove fallback to public URLs for attachment objects.
3. Test sender, recipient, unrelated user, expired link, deleted object, and cross-company access.
4. Make the attachments bucket private and deploy the migration only after application code is live and verified. Preserve the current avatar delivery contract until a separate avatar migration is complete.
5. Add scheduled deletion for expired temporary copies and verify it removes objects, not just database rows.
6. Build, package, authenticate, and test the desktop companion for post-expiry local transfers before advertising the full 24-hour behavior.

## Acceptance tests

- Unauthorized users cannot create signed URLs or download objects.
- Conversation participants can download an unexpired attachment.
- Signed URLs expire and cannot be renewed by a non-participant.
- Expired temporary objects are physically removed by scheduled cleanup.
- An expired attachment is served only by the authenticated sender companion.
- Sender device offline or original missing returns a clear unavailable result.
- A recipient's saved copy remains available independently.
- Avatar images and company logos continue to load after attachment hardening.
