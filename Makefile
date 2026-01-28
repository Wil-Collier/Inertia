SHELL := /bin/bash

# Inertia Development Environment
# ================================
# Manages Vite dev server with Cloudflare Pages Functions for local development.
#
# Usage:
#   make start   - Start Vite + Wrangler in background (for API testing)
#   make stop    - Stop background servers
#   make dev     - Start Vite only in foreground (no API - use for UI work)
#
# Note: API endpoints (/api/*) require Wrangler to be running.
# The Vite dev server proxies /api/* requests to Wrangler on port 8788.

PID_FILE := .devserver.pids
LOG_DIR := .devserver
VITE_PORT ?= 5173
WRANGLER_PORT ?= 8788
WRANGLER := pnpm exec wrangler
VITE_CMD := pnpm dev --port $(VITE_PORT)
# Use wrangler pages dev to serve the built dist folder with functions
WRANGLER_CMD := $(WRANGLER) pages dev ./dist --port $(WRANGLER_PORT)

.PHONY: start stop status restart check dev build lint

# Start both Vite and Wrangler in background (use for testing API endpoints)
start:
	@set -euo pipefail; \
	if [ -f $(PID_FILE) ]; then \
		echo "Dev environment already running (PID file $(PID_FILE) exists). Run 'make stop' first."; \
		exit 1; \
	fi; \
	if [ ! -d node_modules ]; then \
		echo "Installing pnpm dependencies..."; \
		pnpm install; \
	fi; \
	mkdir -p $(LOG_DIR); \
	echo "Building Vite project..."; \
	pnpm build > $(LOG_DIR)/build.log 2>&1 || (cat $(LOG_DIR)/build.log && exit 1); \
	echo "Starting Cloudflare Pages dev server (port $(WRANGLER_PORT))..."; \
	nohup $(WRANGLER_CMD) > $(LOG_DIR)/wrangler.log 2>&1 & \
	WRANGLER_PID=$$!; \
	sleep 3; \
	if ! kill -0 $$WRANGLER_PID >/dev/null 2>&1; then \
		echo "Wrangler failed to start. See $(LOG_DIR)/wrangler.log"; \
		cat $(LOG_DIR)/wrangler.log; \
		exit 1; \
	fi; \
	echo "Starting Vite dev server (port $(VITE_PORT))..."; \
	nohup $(VITE_CMD) > $(LOG_DIR)/vite.log 2>&1 & \
	VITE_PID=$$!; \
	sleep 2; \
	if ! kill -0 $$VITE_PID >/dev/null 2>&1; then \
		echo "Vite dev server failed to start. Cleaning up..."; \
		kill $$WRANGLER_PID >/dev/null 2>&1 || true; \
		echo "See $(LOG_DIR)/vite.log for details."; \
		cat $(LOG_DIR)/vite.log; \
		exit 1; \
	fi; \
	echo $$WRANGLER_PID $$VITE_PID > $(PID_FILE); \
	echo ""; \
	echo "Local environment ready:"; \
	echo "  App (with API) => http://localhost:$(VITE_PORT)"; \
	echo "  (Vite proxies /api/* to Wrangler on port $(WRANGLER_PORT))"; \
	echo ""; \
	echo "Logs: $(LOG_DIR)/wrangler.log, $(LOG_DIR)/vite.log"

# Stop all background dev servers
stop:
	@if [ ! -f $(PID_FILE) ]; then \
		echo "No PID file found; nothing to stop."; \
		exit 0; \
	fi; \
	PIDS=$$(cat $(PID_FILE)); \
	if [ -z "$$PIDS" ]; then \
		echo "PID file empty; removing."; \
		rm -f $(PID_FILE); \
		exit 0; \
	fi; \
	echo "Stopping processes: $$PIDS"; \
	for PID in $$PIDS; do \
		if kill -0 $$PID >/dev/null 2>&1; then \
			kill $$PID >/dev/null 2>&1 || true; \
		fi; \
	done; \
	sleep 1; \
	for PID in $$PIDS; do \
		if kill -0 $$PID >/dev/null 2>&1; then \
			echo "Force killing $$PID"; \
			kill -9 $$PID >/dev/null 2>&1 || true; \
		fi; \
	done; \
	rm -f $(PID_FILE); \
	echo "Local environment stopped."

# Check status of background servers
status:
	@if [ ! -f $(PID_FILE) ]; then \
		echo "Local environment is not running."; \
		exit 0; \
	fi; \
	PIDS=$$(cat $(PID_FILE)); \
	if [ -z "$$PIDS" ]; then \
		echo "Local environment PID file is empty."; \
		exit 1; \
	fi; \
	RUNNING=0; \
	for PID in $$PIDS; do \
		if kill -0 $$PID >/dev/null 2>&1; then \
			echo "Process $$PID is running."; \
			RUNNING=1; \
		else \
			echo "Process $$PID is not running."; \
		fi; \
	done; \
	if [ $$RUNNING -eq 1 ]; then \
		echo "Local environment is running."; \
	else \
		echo "Local environment appears to be stopped. Run 'make stop' to clean up."; \
	fi

# Restart background servers
restart: stop start
	@echo "Local environment restarted."

# Standard dev command (foreground, no Pages Functions API)
# Note: API calls will fail with this mode. Use 'make start' for full functionality.
dev:
	@echo "Starting Vite dev server (API endpoints will NOT work)..."
	@echo "Use 'make start' for full functionality with API support."
	@echo ""
	pnpm dev --host

# Build for production
build:
	pnpm build

# Lint the codebase
lint:
	pnpm lint

# Run all checks (lint + build)
check:
	pnpm lint
	pnpm build
