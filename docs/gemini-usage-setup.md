# Gemini usage setup

Gemini requests fail closed until the database is configured. Groq remains available.

1. Create a Supabase project, open SQL Editor, and run the entire `sql/gemini_usage.sql` script. Tables have RLS enabled; RPCs are executable only by `service_role`.
2. In Supabase project settings, obtain the project URL and the **service_role** secret. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Render Environment. Never put either service role key or the database password in client code or Git.
3. Set `GEMINI_ADMIN_PASSWORD` to a unique random secret of at least 24 characters in Render Environment. Existing `GEMINI_API_KEY`, `GROQ_API_KEY`, and site authentication settings remain unchanged.
4. Deploy only after the SQL and environment settings exist. Visit `/admin/gemini` over HTTPS. Sign in with username `admin` and that password. Reset selects the primary model but does not erase history or override an already reached 500-call daily cap.
5. Confirm both models are available to the Google project and inspect Google AI Studio's actual limits. This counter covers only calls made by this application, not other applications or projects. Google counts per project and resets daily limits at midnight Pacific time.

Each reservation is stored before sending, including initial, continuation and fallback attempts. An interrupted reservation remains pending and counts conservatively. Success, failure, cancellation, timeout, not-sent and retry are distinguished. Network failures can make it impossible to know whether Google actually charged a request; compare with Google AI Studio. No prompt, music preference, key, response content, or provider error message is stored.

The 500 cap applies only to the primary model. Backup model limits depend on the Google account; backup 429s are reported without retry. Only a specific provider daily request quota signal triggers an early persistent switch; ambiguous 429s and minute/token/spending limits do not. Switchover remains in effect until an administrator resets it. Model availability and account limits can change.

The SQL script and in-process mocks cannot prove deployed database locking, credentials, network, or RLS behavior. Before production, test against a separate Supabase project with concurrent transactions and verify access denial for anon/authenticated roles, then verify Render connectivity. Do not send credentials in chat.
