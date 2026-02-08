.PHONY: dev dev-backend dev-frontend build build-shared build-backend build-frontend start install clean check

# Run full dev environment (shared build + backend + frontend in parallel)
dev: build-shared
	@echo "Starting backend and frontend..."
	@npx tsx watch apps/backend/src/main.ts & \
	 npm run dev --workspace=apps/frontend & \
	 wait

# Run only backend in dev mode
dev-backend: build-shared
	npm run dev --workspace=apps/backend

# Run only frontend in dev mode
dev-frontend: build-shared
	npm run dev --workspace=apps/frontend

# Build everything for production
build: build-shared build-backend build-frontend

build-shared:
	npm run build --workspace=packages/shared

build-backend: build-shared
	npm run build --workspace=apps/backend

build-frontend: build-shared
	npm run build --workspace=apps/frontend

# Start production server
start: build
	npx tsx apps/backend/src/main.ts

# Install dependencies
install:
	npm install

# TypeScript check without emitting
check: build-shared
	@echo "Checking backend..."
	npx tsc --noEmit --project apps/backend/tsconfig.json
	@echo "Checking frontend..."
	npx tsc --noEmit --project apps/frontend/tsconfig.json
	@echo "All checks passed."

# Remove build artifacts
clean:
	rm -rf packages/shared/dist apps/backend/dist apps/frontend/dist
