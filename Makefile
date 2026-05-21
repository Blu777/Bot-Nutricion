.PHONY: up down logs seed shell-db shell-api restart build

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-bot:
	docker compose logs -f bot

restart:
	docker compose restart

build:
	docker compose build --no-cache

seed:
	docker compose exec api node dist/db/seed/food-dictionary.js

schema:
	docker compose exec db psql -U postgres -d nutrition -f /dev/stdin < src/db/schema.sql

shell-db:
	docker compose exec db psql -U postgres -d nutrition

shell-api:
	docker compose exec api sh

health:
	curl -s http://localhost:3000/health | jq .
