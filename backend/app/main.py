"""FastAPI backend for Woodshed — YouTube music practice tool."""

from __future__ import annotations

import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.audio import VideoNotFoundError, resolve_video

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Woodshed", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache directory for downloaded audio — use /tmp explicitly for consistency
# (Python's tempfile.gettempdir() returns /var/folders/... on macOS)
CACHE_DIR = Path("/tmp/woodshed-audio")
CACHE_DIR.mkdir(exist_ok=True)


# -- Request / Response models ------------------------------------------------


class ResolveRequest(BaseModel):
    url: str


class ResolveResponse(BaseModel):
    video_id: str
    title: str
    duration: Optional[int]
    thumbnail: str


# -- Routes --------------------------------------------------------------------


@app.post("/api/resolve", response_model=ResolveResponse)
async def resolve(req: ResolveRequest) -> ResolveResponse:
    """Resolve a YouTube URL to video metadata."""
    try:
        meta = resolve_video(req.url)
    except VideoNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error resolving %s", req.url)
        raise HTTPException(status_code=500, detail="Failed to resolve video") from exc

    return ResolveResponse(**meta)


@app.get("/api/stream/{video_id}")
async def stream(video_id: str) -> FileResponse:
    """Download audio via yt-dlp and serve the file."""
    # Check cache first
    cached = CACHE_DIR / f"{video_id}.m4a"
    if not cached.exists():
        # Also check for other formats yt-dlp might produce
        for ext in ("m4a", "webm", "opus", "mp3"):
            candidate = CACHE_DIR / f"{video_id}.{ext}"
            if candidate.exists():
                cached = candidate
                break

    if not cached.exists():
        # Use yt-dlp CLI to download — it handles cookies/tokens/retries properly
        url = f"https://www.youtube.com/watch?v={video_id}"
        output_template = str(CACHE_DIR / f"{video_id}.%(ext)s")
        cmd = [
            "yt-dlp",
            "-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
            "--extractor-args", "youtube:player_client=android_vr,default",
            "-o", output_template,
            "--no-playlist",
            "--no-post-overwrites",
            url,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0:
                logger.error("yt-dlp failed: %s", stderr.decode())
                raise HTTPException(
                    status_code=502,
                    detail="Failed to download audio",
                )
        except FileNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="yt-dlp not found — install it with: brew install yt-dlp",
            )

        # Find the downloaded file (yt-dlp picks the extension)
        for ext in ("m4a", "webm", "opus", "mp3", "ogg"):
            candidate = CACHE_DIR / f"{video_id}.{ext}"
            if candidate.exists():
                cached = candidate
                break

        if not cached.exists():
            raise HTTPException(status_code=500, detail="Download succeeded but file not found")

    # Determine content type
    content_types = {
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
        ".opus": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
    }
    content_type = content_types.get(cached.suffix, "audio/mpeg")

    return FileResponse(
        cached,
        media_type=content_type,
        headers={"Accept-Ranges": "bytes"},
    )
