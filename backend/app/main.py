"""FastAPI backend for Woodshed — YouTube music practice tool."""

from __future__ import annotations

import logging
from typing import Dict, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.audio import VideoNotFoundError, get_audio_stream_url, resolve_video

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
async def stream(video_id: str) -> StreamingResponse:
    """Proxy the audio stream for a YouTube video to avoid CORS issues."""
    try:
        audio_url = get_audio_stream_url(video_id)
    except VideoNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error getting stream for %s", video_id)
        raise HTTPException(status_code=500, detail="Failed to get audio stream") from exc

    # Stream the audio from YouTube through our server.
    client = httpx.AsyncClient()

    try:
        upstream = await client.send(
            client.build_request("GET", audio_url),
            stream=True,
        )
    except httpx.HTTPError as exc:
        await client.aclose()
        logger.warning("Failed to connect to upstream audio: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to fetch audio stream") from exc

    content_type = upstream.headers.get("content-type", "audio/mpeg")
    content_length = upstream.headers.get("content-length")

    headers: dict[str, str] = {
        "Accept-Ranges": "bytes",
        "Content-Type": content_type,
    }
    if content_length:
        headers["Content-Length"] = content_length

    async def generate():
        try:
            async for chunk in upstream.aiter_bytes(chunk_size=64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        generate(),
        status_code=upstream.status_code,
        headers=headers,
    )
