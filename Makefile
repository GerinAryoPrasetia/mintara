.DEFAULT_GOAL := help

.PHONY: help install dev start test build pack publish clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies for all workspaces
	npm install

dev: start ## Alias for start

start: ## Run client + server in dev mode (hot reload, two ports)
	npm start

test: ## Run tests across all workspaces (shared, server, client)
	npm test

build: ## Build the publishable mintara CLI package (client build + server bundle)
	npm run build --workspace=server

pack: build ## Build and produce a local tarball (server/mintara-*.tgz) without publishing
	cd server && npm pack

publish: build ## Publish the mintara CLI package to npm (requires npm login; pass OTP=123456 if 2FA is required)
	cd server && npm publish --access=public $(if $(OTP),--otp=$(OTP))

clean: ## Remove build artifacts
	rm -rf server/dist server/public client/dist server/*.tgz
