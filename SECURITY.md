# Security

Do not report real vulnerabilities by opening a public issue until the repository owner has selected a private contact method.

Never commit:

- OpenAI API keys
- Supabase secret or legacy service-role keys
- Google OAuth client secrets
- VAPID private keys
- Cron secrets
- database passwords or personal `.env` files

If a secret is accidentally committed, rotate it at the provider immediately; removing it from the latest Git commit is not sufficient.

Meal photographs and nutrition history are personal data. Keep production logs free of prompts, Base64 image content and database rows. The implemented `ai_usage` log intentionally stores only request metadata and token counts.
