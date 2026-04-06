# CLAUDE.md

direct-commits-allowed: true

## Development

```bash
# Backend
cd backend && uv run uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev

# Both (requires two terminals)
make dev
```

## Prerequisites

- Python 3.9+, Node.js 18+
- `brew install yt-dlp ffmpeg`
