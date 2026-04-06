"""yt-dlp wrapper for extracting YouTube audio metadata and stream URLs."""

from __future__ import annotations

import logging
from typing import Any, Dict

import yt_dlp

logger = logging.getLogger(__name__)

# Shared yt-dlp options: prefer audio-only, don't download anything.
_BASE_OPTS: Dict[str, Any] = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": False,
    "format": "bestaudio/best",
}


class VideoNotFoundError(Exception):
    """Raised when yt-dlp cannot find or extract a video."""


def resolve_video(url: str) -> Dict[str, Any]:
    """Extract metadata for a YouTube video without downloading.

    Returns a dict with video_id, title, duration, and thumbnail.
    """
    opts = {**_BASE_OPTS}

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        logger.warning("yt-dlp failed for %s: %s", url, exc)
        raise VideoNotFoundError(str(exc)) from exc

    if info is None:
        raise VideoNotFoundError(f"No info returned for {url}")

    return {
        "video_id": info.get("id", ""),
        "title": info.get("title", ""),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail", ""),
    }


def get_audio_stream_url(video_id: str) -> str:
    """Get the direct audio stream URL for a given video ID."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {**_BASE_OPTS}

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        logger.warning("yt-dlp failed for video %s: %s", video_id, exc)
        raise VideoNotFoundError(str(exc)) from exc

    if info is None:
        raise VideoNotFoundError(f"No info returned for video {video_id}")

    audio_url: str | None = info.get("url")
    if not audio_url:
        # Fall back to picking the best audio format from the formats list.
        formats = info.get("formats") or []
        audio_formats = [
            f for f in formats
            if f.get("acodec", "none") != "none" and f.get("url")
        ]
        if not audio_formats:
            raise VideoNotFoundError(f"No audio stream found for video {video_id}")
        # Prefer highest audio bitrate.
        best = max(audio_formats, key=lambda f: f.get("abr") or 0)
        audio_url = best["url"]

    return audio_url
