# Security policy

## Reporting

Open a private security advisory on the GitHub repository, or open a regular issue if it is low
risk. Please do not disclose exploitable details publicly until a fix is available.

## What Kanzen does with your data

- **Provider tokens** are encrypted at rest with AES-256-GCM using `TOKEN_ENCRYPTION_KEY` and are
  never returned to the browser.
- **Sessions** are stateless JWTs in `httpOnly`, `SameSite`, `Secure` cookies. Access tokens live
  15 minutes, refresh tokens 7 days.
- **Passwords** are hashed with bcrypt. Kanzen never stores them in plain text.
- **OAuth** uses the authorization code flow with PKCE and a short lived state stored in Redis.

## Hardening notes for self hosters

- Generate real secrets: `openssl rand -hex 32` for each of `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, and `TOKEN_ENCRYPTION_KEY`.
- Set `PROVIDERS_DEMO_MODE=false` in production if you want real syncs.
- Restrict `WEB_ORIGIN` to your actual frontend origin.
- Put the API behind the platform firewall and enable rate limiting at the edge.
