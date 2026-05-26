.PHONY: infra up down tools migrate logs db redis

# Start only Postgres + Redis (fastest, no app build needed)
infra:
	docker compose up postgres redis -d

# Start full app (app + postgres + redis)
up:
	docker compose up --build

# Start full app + DB/Redis UIs (Adminer + Redis Commander + Prisma Studio)
tools:
	docker compose --profile tools up --build

# Stop everything and remove containers
down:
	docker compose --profile tools down

# Run Prisma migrations (requires infra to be up)
migrate:
	docker compose run --rm app npx prisma migrate dev --name init

# Tail all logs
logs:
	docker compose logs -f

# Open a psql shell into the running Postgres container
db:
	docker compose exec postgres psql -U postgres -d whatsapp_ai

# Open a redis-cli shell into the running Redis container
redis:
	docker compose exec redis redis-cli
