# Phase 7 — Deployment

## Context

GoldCompass v2 has been built phase-by-phase (Phases 0–6 complete) but only ever run via `next dev`/local `next build`. Phase 7 is the final build phase before the site can go live: package it as a Docker image, run it on the cheapest viable EC2 instance, front it with Cloudflare, and wire up a CI/CD pipeline so both code changes and Git-as-CMS content publishes (the daily outlook PR, the articles PR) actually reach production.

Decisions locked with the user before this plan was written:
- **EC2 instance**: t4g.micro (ARM/Graviton, 1GB RAM) — cheapest viable, per CLAUDE.md §3.
- **Reverse proxy**: Caddy — automatic HTTPS, minimal config.
- **Registry**: GitHub Container Registry (GHCR) — free, no separate account, fits the repo's existing GH Actions patterns.
- **Starting point**: nothing provisioned yet — domain isn't on Cloudflare, no EC2 instance exists. This plan covers provisioning from scratch.

**Critical constraint**: the box must never run `next build` — Turbopack builds can spike well past 1GB RAM. The image is built in CI; the box only ever `docker pull`s and runs it.

**Architecture finding that shapes the CI design** (verified by reading the actual code, not assumed): outlook content (`src/server/outlook/index.ts`) is a *static ES module import* of `current.json` — it gets compiled directly into the build, so a content publish only goes live after a rebuild+redeploy, never via the existing `/api/revalidate` endpoint alone. Articles (`src/server/articles/index.ts`) are read dynamically via `fs.readFileSync` at runtime, which Next's standalone-output file tracing does **not** auto-detect (dynamic `fs` calls aren't statically analyzable), so they need an explicit `outputFileTracingIncludes` entry **and** are also baked into the image at build time (no live volume). Net effect: **both content types only go live on redeploy**, not on PR merge alone. The cleanest fix needs no new application code — just make the deploy workflow trigger `on: push: branches: [main]`, so every merge (outlook PR, articles PR, or a regular code change) automatically rebuilds and redeploys. This already matches the comment baked into `.github/workflows/daily-outlook.yml`: *"Merging the PR publishes it (updates current.json → ISR/redeploy serves it)."* The existing `/api/revalidate` endpoint stays as-is — it's still useful for a manual cache bust, just no longer the primary publish path.

Other findings: no native-binary dependencies in this project need glibc (verified `@tailwindcss/oxide`/`lightningcss` ship `musl` prebuilts; `sharp` isn't even a dependency) — **Alpine is safe** as the base image. `public/` and `src/content/` are tiny (11KB/32KB, no real media yet) — **S3 is deferred**; nothing to offload yet.

## 1. Dockerfile (new, repo root)

Multi-stage build targeting `linux/arm64`, using `output: 'standalone'`.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

Note the `CMD` is `node server.js` — standalone mode ships its own minimal server; `npm start`/`next start` would not work against this output and isn't even present in the runner stage.

`.dockerignore` (new): `node_modules`, `.next`, `.git`, `.github`, `.env*`, `*.md`, `scripts`, `src/content/outlook/draft.json`.

## 2. `next.config.ts` changes

Add standalone output and explicit tracing for the dynamically-read content directory (Next 16 top-level key, not under `experimental`):

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./src/content/**/*.json"],
  },
  async redirects() { /* unchanged */ },
};
```

## 3. Files to live on the EC2 box (`deploy/` folder in repo, copied up once)

`deploy/docker-compose.yml`:
```yaml
services:
  app:
    image: ghcr.io/yassersalama22/goldcompass-v2:latest
    restart: unless-stopped
    env_file: .env
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/v1/price"]
      interval: 30s
      timeout: 5s
      retries: 3
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
volumes:
  caddy_data:
  caddy_config:
```

`deploy/Caddyfile`:
```
goldcompass.app, www.goldcompass.app {
    reverse_proxy app:3000
}
```

`.env` on the box (created manually via SSH, never committed): `REVALIDATE_SECRET=...`, `BUTTONDOWN_API_KEY=...`, `NEXT_PUBLIC_SITE_URL=https://goldcompass.app`.

## 4. GitHub Actions deploy workflow (new, `.github/workflows/deploy.yml`)

Triggers on every push to `main` (covers code pushes **and** outlook/articles publish-PR merges) plus manual dispatch. Cross-builds `linux/arm64` via QEMU on the standard (amd64) hosted runner, pushes to GHCR, then SSHes into the box to pull + restart.

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch: {}

permissions:
  contents: read
  packages: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/arm64
          push: true
          tags: ghcr.io/yassersalama22/goldcompass-v2:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /opt/goldcompass
            docker compose pull
            docker compose up -d --remove-orphans
            docker image prune -f
```

Required new GitHub secrets: `EC2_HOST`, `EC2_USER` (`ec2-user`), `EC2_SSH_KEY` (private key of a dedicated deploy key pair). No GHCR credential is needed on the box — after the first push, set the package visibility to **public** in GitHub (Packages → goldcompass-v2 → Package settings), so `docker pull` on the box needs no login.

Known tradeoff: QEMU-emulated arm64 builds on an amd64 runner are slow (roughly 5–20 min for a Turbopack build). Acceptable for the current publish cadence (daily/few-times-weekly); GitHub now offers native arm64-hosted runners as a future speed-up if needed.

## 5. EC2 provisioning (from scratch)

1. Launch instance: AMI = **Amazon Linux 2023 (arm64)**, type **t4g.micro**, new key pair (download `.pem`), root volume **gp3, 20GB** (override the AMI's default 8GB — Docker layers accumulate). Security group: inbound 22 (restrict to your IP), 80, 443 (0.0.0.0/0); default outbound.
2. Allocate an **Elastic IP** and associate it with the instance (so the address survives stop/start — EIPs are free only while attached to a running instance).
3. SSH in: `ssh -i key.pem ec2-user@<EIP>`, then `sudo dnf update -y`.
4. Add a 2GB swap file (real safety net on 1GB RAM with Docker daemon overhead):
   ```
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
   ```
5. Install Docker + Compose plugin (AL2023's own `docker` package, official Compose binary for the plugin slot since AL2023 doesn't package it):
   ```
   sudo dnf install -y docker
   sudo systemctl enable --now docker
   sudo usermod -aG docker ec2-user   # re-login (or `newgrp docker`) to take effect
   sudo mkdir -p /usr/local/lib/docker/cli-plugins
   sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
     -o /usr/local/lib/docker/cli-plugins/docker-compose
   sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
   ```
6. `mkdir -p /opt/goldcompass && cd /opt/goldcompass`; copy `deploy/docker-compose.yml` and `deploy/Caddyfile` up (`scp`); create `.env` by hand (`chmod 600 .env`).
7. `docker compose pull && docker compose up -d`.
8. Verify: `docker compose ps`, `docker stats --no-stream`, `free -h` (confirm swap active), `curl localhost:3000/api/v1/price`.

## 6. Cloudflare setup

1. Add the domain to Cloudflare; update nameservers at the registrar.
2. DNS: `A` record (`@` and `www`) → the Elastic IP, proxied (orange cloud) **on**.
3. SSL/TLS mode: start at **Full** (not "Full (strict)") so Caddy can complete its first HTTP-01 challenge — Cloudflare's proxy forwards standard HTTP(S) traffic through to the origin, so the challenge reaches Caddy fine even with the proxy on. Once Caddy has obtained its real Let's Encrypt cert (automatic, on first incoming request), switch to **Full (strict)**.
4. Optional Cache Rule: `Cache Everything` + long TTL for `/_next/static/*` (immutable, content-hashed). Leave HTML on Cloudflare's default — it respects the origin's `Cache-Control`, which already matches the app's ISR revalidate windows (300s–3600s); no blanket edge-cache override needed there.
5. Enable "Always Use HTTPS"; consider HSTS only after confirming HTTPS works end-to-end.

## 7. S3 for assets — deferred

`public/` is 11KB of default boilerplate and `src/content/` is 32KB of JSON; there's no `next/image` usage and no OG images yet. Nothing exists today to offload. Revisit when real brand/OG images or article hero images are added — note this explicitly in CLAUDE.md rather than building S3 wiring speculatively.

## 8. Verification / runbook

- `docker compose ps` → both containers running/healthy.
- `docker stats --no-stream` + `free -h` → confirm memory headroom, swap present but ideally unused at idle.
- `curl -I https://goldcompass.app` → 200, valid cert.
- `curl https://goldcompass.app/api/v1/price` and `/api/v1/recommendations` → valid JSON.
- Push a trivial commit to `main` → confirm the deploy workflow runs end-to-end and the site picks up the change.
- Merge a real outlook or articles publish PR → confirm the deploy workflow fires automatically off the same `main` push trigger, and the new content is live after the rebuild (this is the key end-to-end check for the architecture finding above).
- Update `CLAUDE.md` §13 with the Phase 7 status-log entry (what was built, file-by-file, verification performed) and §11 (final EC2 instance type / static-export question — now answered: Docker standalone on t4g.micro), per the project's own convention.

## Files to create/modify

- `Dockerfile`, `.dockerignore` (new, repo root)
- `next.config.ts` (add `output: "standalone"` + `outputFileTracingIncludes`)
- `deploy/docker-compose.yml`, `deploy/Caddyfile` (new)
- `.github/workflows/deploy.yml` (new)
- `CLAUDE.md` (§9, §11, §13 updates)
