import os
import logging
from typing import Optional
from app.services.storage_guard import storage_guard

logger = logging.getLogger(__name__)


class WhisperService:
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                # Run on CPU with int8 quantization to minimize RAM and CPU load on Debian
                logger.info(f"Loading faster-whisper model '{self.model_size}' on CPU...")
                self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            except Exception as e:
                logger.error(f"Failed to load faster-whisper: {e}")
                self._model = None
        return self._model

    def transcribe_audio_file(self, audio_path: str, delete_after: bool = True) -> str:
        """
        Transcribes local audio file using faster-whisper and immediately deletes temporary file.
        """
        if not storage_guard.can_start_heavy_task():
            raise RuntimeError("Espacio de disco insuficiente para transcripción de audio.")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        try:
            model = self._get_model()
            if not model:
                return "Transcripción local no disponible (modelo faster-whisper no cargado)."

            segments, info = model.transcribe(audio_path, beam_size=2, language="es")
            text_segments = []
            for segment in segments:
                text_segments.append(segment.text)
            
            transcription = " ".join(text_segments).strip()
            return transcription
        except Exception as e:
            logger.error(f"Error transcribing audio {audio_path}: {e}")
            return ""
        finally:
            if delete_after and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                    logger.info(f"STORAGE GUARD: Deleted temporary audio file {audio_path}")
                except Exception as ex:
                    logger.warning(f"Could not remove temporary audio {audio_path}: {ex}")


whisper_service = WhisperService()
