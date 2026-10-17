import os
import subprocess
import logging
import uuid
import re
from typing import Dict, Any, Optional
from app.config import settings
from app.services.storage_guard import storage_guard
from app.services.whisper_service import whisper_service
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class InstagramService:
    @staticmethod
    def is_instagram_url(url: str) -> bool:
        return bool(re.search(r"https?://(www\.)?instagram\.com/(p|reel|tv)/", url))

    @classmethod
    def process_instagram_url(cls, url: str) -> Dict[str, Any]:
        """
        Processes an Instagram URL: extracts public metadata, video/audio if accessible,
        runs local transcription on audio, extracts frames, and structures recipe with Gemini.
        All temporary media files are deleted upon completion.
        """
        if not cls.is_instagram_url(url):
            raise ValueError("URL no válida de Instagram (debe ser /p/, /reel/ o /tv/)")

        if not storage_guard.can_start_heavy_task():
            raise RuntimeError("Espacio en disco insuficiente para procesar vídeo de Instagram.")

        job_id = str(uuid.uuid4())[:8]
        temp_dir = os.path.join(settings.TEMP_PATH, f"ig_{job_id}")
        os.makedirs(temp_dir, exist_ok=True)

        video_path = None
        audio_path = None
        transcription = ""
        description = ""
        creator = ""
        title = ""
        thumbnail_url = ""

        try:
            import yt_dlp

            ydl_opts = {
                "outtmpl": os.path.join(temp_dir, "%(id)s.%(ext)s"),
                "format": "mp4/best[height<=720]/best",
                "quiet": True,
                "no_warnings": True,
                "extract_flat": False,
                "noplaylist": True,
                "socket_timeout": 15,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    info = ydl.extract_info(url, download=True)
                    description = info.get("description", "") or ""
                    creator = info.get("uploader", "") or info.get("channel", "") or ""
                    title = info.get("title", "") or f"Receta de {creator}"
                    thumbnail_url = info.get("thumbnail", "") or ""
                    video_filename = ydl.prepare_filename(info)
                    if os.path.exists(video_filename):
                        video_path = video_filename
                except Exception as dl_err:
                    logger.warning(f"Could not download full Instagram video (might be restricted/login required): {dl_err}")
                    # Try metadata-only extraction
                    try:
                        info = ydl.extract_info(url, download=False)
                        description = info.get("description", "") or ""
                        creator = info.get("uploader", "") or ""
                        title = info.get("title", "") or f"Receta de {creator}"
                        thumbnail_url = info.get("thumbnail", "") or ""
                    except Exception as meta_err:
                        logger.warning(f"Could not extract metadata: {meta_err}")

            # If video was downloaded, extract audio for Whisper
            if video_path and os.path.exists(video_path):
                audio_path = os.path.join(temp_dir, "audio.wav")
                try:
                    cmd = [
                        "ffmpeg", "-y", "-i", video_path,
                        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                        audio_path
                    ]
                    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                    if os.path.exists(audio_path):
                        transcription = whisper_service.transcribe_audio_file(audio_path, delete_after=True)
                except Exception as audio_err:
                    logger.warning(f"Audio extraction failed: {audio_err}")

            combined_text = f"Título: {title}\nCreador: {creator}\nDescripción:\n{description}"
            if transcription:
                combined_text += f"\n\nTranscripción de audio:\n{transcription}"

            # Run recipe extraction
            extracted = gemini_service.extract_recipes_from_text(combined_text, source_hint="Instagram Reel")
            recipe_data = extracted[0] if extracted else {
                "title": title or "Receta Instagram",
                "ingredients": [],
                "steps": []
            }

            return {
                "url": url,
                "creator": creator,
                "title": title,
                "description": description,
                "transcription": transcription,
                "video_obtained": bool(video_path),
                "thumbnail_url": thumbnail_url,
                "recipe_data": recipe_data
            }

        finally:
            # Clean up all temporary files created for this Instagram task
            try:
                import shutil
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    logger.info(f"STORAGE GUARD: Cleaned Instagram temp directory {temp_dir}")
            except Exception as clean_err:
                logger.warning(f"Failed to clean temp dir {temp_dir}: {clean_err}")


instagram_service = InstagramService()
