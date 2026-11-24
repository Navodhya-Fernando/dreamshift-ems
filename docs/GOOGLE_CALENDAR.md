# Google Calendar integration (phase one)
This release imports events from one explicitly selected calendar into the authenticated employee's calendar. No Google account is connected by deployment alone. Google API access is read-only; existing ICS outbound subscription remains separate. Automatic sync, event writes, conflict resolution, Google Tasks, and meeting invitation creation via Google are not implemented in this release.

## Configure
1. In Google Cloud, enable Google Calendar API and configure the OAuth consent screen. Use Internal audience if all eligible employees are within your Google Workspace organization.
2. Create a Web application OAuth client. Add the exact redirect URI https://dreamshift-ems.vercel.app/api/integrations/google-calendar/callback (or your actual production origin).
3. Set server-only Vercel variables GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI and GOOGLE_CALENDAR_TOKEN_KEY. Generate the last with openssl rand -base64 32. Never commit or paste secret values into chat.
4. Redeploy and connect through Settings > Google Calendar. Select a dedicated work calendar; import events and open Calendar. Disconnect removes the stored snapshot and attempts Google token revocation.
5. Test a second employee account: it must not see the first employee's Google events. Test consent denial, expired state, revoked permission, calendar switching and disconnect.

OAuth authorization code exchange uses PKCE, a short-lived encrypted state cookie, offline refresh access, and AES-256-GCM encrypted refresh tokens bound to the EMS user ID. Calendar contents are limited to event title (private events display Busy), time and Google event link. No attendees or descriptions are imported. A bounded 30-day past/90-day future snapshot is replaced only after a successful import. If the 500-event limit is exceeded, previous data remains intact.
