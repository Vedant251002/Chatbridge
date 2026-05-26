# Deploying to a single EC2 instance

This is the path I'd take for the existing single-tenant setup. One VM,
Docker Compose, Caddy in front for HTTPS + admin basic auth.

## 1. Provision the EC2 instance

- AMI: Ubuntu 22.04 LTS
- Type: `t3.small` minimum, `t3.medium` recommended
- Disk: 20 GB gp3
- Elastic IP: attach one so the WhatsApp session survives restarts
- Security group inbound rules:
  - `22` from your IP (SSH)
  - `80` and `443` from `0.0.0.0/0`
  - Do NOT expose `3000`, `5432`, or `6379` — they stay inside Docker

## 2. Point a domain at the instance

In your DNS, add an A record (e.g. `bot.example.com → <Elastic IP>`).
Caddy will auto-issue a Let's Encrypt certificate the first time the
site is hit.

## 3. Install Docker on the instance

```bash
ssh ubuntu@<elastic-ip>

sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
exit
# log back in so the new group takes effect
ssh ubuntu@<elastic-ip>
```

## 4. Copy the project

Either clone the repo (recommended) or `rsync` your local checkout up.

```bash
git clone <your-repo-url> ~/whatsapp-ai
cd ~/whatsapp-ai
```

## 5. Configure secrets

```bash
cp .env.production.example .env
# Generate a Caddy basic-auth password hash:
docker run --rm caddy:2-alpine caddy hash-password
# Paste the $2a$... output into ADMIN_PASSWORD_HASH in .env.
nano .env  # fill in DOMAIN, GROK_API_KEY, OPENAI_API_KEY, POSTGRES_PASSWORD, ADMIN_PASSWORD_HASH
```

## 6. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend
```

The first time, watch the backend logs for the QR code in the terminal,
or open `https://<your-domain>` and scan there.

## 7. Operations

```bash
# Update after code changes:
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Tail logs:
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web

# Postgres shell:
docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER $POSTGRES_DB

# Backups (cron this):
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup-$(date +%F).sql.gz
```

## 8. Things to watch

- The `sessions/` directory on the host is the WhatsApp pairing.
  Back it up. Losing it forces a re-scan of the QR.
- Run a daily `pg_dump` cron and ship it to S3 if the chat history
  matters.
- Monitor disk usage — embeddings + chat history grow slowly but
  forever unless you prune.
- Baileys is unofficial; WhatsApp can disconnect or ban a number.
  For business-critical use, switch to the official WhatsApp Cloud API.
