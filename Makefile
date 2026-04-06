.PHONY: dev backend frontend install

# Run both backend and frontend
dev: backend frontend

backend:
	cd backend && uv run uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

install:
	cd backend && uv sync
	cd frontend && npm install
