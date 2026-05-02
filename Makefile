.PHONY: help up down build logs restart clean stop ps

help:
	@echo "Gomoku Docker Compose Commands"
	@echo "=============================="
	@echo "make up         - Start all services"
	@echo "make down       - Stop all services"
	@echo "make build      - Build all service images"
	@echo "make rebuild    - Rebuild all service images (no cache)"
	@echo "make logs       - View logs from all services"
	@echo "make logs-server - View logs from server only"
	@echo "make logs-client - View logs from client only"
	@echo "make restart    - Restart all services"
	@echo "make stop       - Stop all running containers (without removing)"
	@echo "make ps         - Show status of containers"
	@echo "make clean      - Remove containers and volumes"
	@echo "make help       - Show this help message"

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

rebuild:
	docker-compose build --no-cache

logs:
	docker-compose logs -f

logs-server:
	docker-compose logs -f server

logs-client:
	docker-compose logs -f client

restart:
	docker-compose restart

stop:
	docker-compose stop

ps:
	docker-compose ps

clean:
	docker-compose down -v
