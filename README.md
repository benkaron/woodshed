# Woodshed

A web-based music practice tool. Paste a YouTube link, then slow down, speed up, pitch shift, and loop sections to practice along with any song.

## Features

- **Speed control** — 0.25x to 2.0x without changing pitch
- **Pitch shift** — ±12 semitones without changing speed
- **A-B looping** — Select any section and loop it endlessly
- **Gradual speed ramp** — Auto-increment speed each loop pass
- **EQ controls** — Highpass/lowpass filters to isolate instruments
- **Waveform display** — Visual loop region selection with drag handles
- **Bookmarks** — Save and recall loop points per song
- **Keyboard shortcuts** — Practice without breaking flow

## Prerequisites

- Python 3.9+
- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`brew install yt-dlp`)
- [ffmpeg](https://ffmpeg.org/) (`brew install ffmpeg`)

## Setup

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI runs at `http://localhost:5173` and proxies API requests to the backend.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| `[` | Set loop start |
| `]` | Set loop end |
| Delete | Clear loop |
| Up / Down | Speed ±0.05x |
| Shift+Up / Shift+Down | Pitch ±1 semitone |
| Left / Right | Seek ±5 seconds |
| R | Toggle speed ramp |
