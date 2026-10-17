import os
import shutil
import time
import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


class StorageGuardService:
    def __init__(self, temp_dir: str = settings.TEMP_PATH, min_free_gb: float = settings.DISK_MIN_FREE_GB):
        self.temp_dir = temp_dir
        self.min_free_gb = min_free_gb
        os.makedirs(self.temp_dir, exist_ok=True)
        os.makedirs(settings.STORAGE_PATH, exist_ok=True)
        os.makedirs(settings.BACKUP_PATH, exist_ok=True)

    def get_disk_usage(self, path: str = "/") -> Dict[str, Any]:
        """Returns disk usage stats in GB."""
        try:
            total, used, free = shutil.disk_usage(path)
            total_gb = round(total / (1024 ** 3), 2)
            used_gb = round(used / (1024 ** 3), 2)
            free_gb = round(free / (1024 ** 3), 2)
            percent_used = round((used / total) * 100, 1)

            app_storage_bytes = 0
            for root, dirs, files in os.walk("/app/data"):
                for f in files:
                    fp = os.path.join(root, f)
                    if not os.path.islink(fp):
                        try:
                            app_storage_bytes += os.path.getsize(fp)
                        except OSError:
                            pass
            app_storage_mb = round(app_storage_bytes / (1024 ** 2), 2)

            is_safe = free_gb >= self.min_free_gb

            return {
                "total_gb": total_gb,
                "used_gb": used_gb,
                "free_gb": free_gb,
                "percent_used": percent_used,
                "app_storage_mb": app_storage_mb,
                "min_free_threshold_gb": self.min_free_gb,
                "is_safe": is_safe
            }
        except Exception as e:
            logger.error(f"Error checking disk usage: {e}")
            return {
                "total_gb": 0,
                "used_gb": 0,
                "free_gb": 0,
                "percent_used": 0,
                "app_storage_mb": 0,
                "min_free_threshold_gb": self.min_free_gb,
                "is_safe": True
            }

    def can_start_heavy_task(self) -> bool:
        """Determines if there is sufficient safe disk space to process large documents/media."""
        usage = self.get_disk_usage()
        if not usage["is_safe"]:
            logger.warning(
                f"STORAGE GUARD: Heavy task rejected! Free disk is {usage['free_gb']} GB, below threshold of {self.min_free_gb} GB"
            )
            return False
        return True

    def cleanup_old_temp_files(self, max_age_seconds: int = 3600) -> int:
        """Deletes files in TEMP_PATH older than max_age_seconds (default 1 hour)."""
        now = time.time()
        deleted_count = 0
        try:
            for item in os.listdir(self.temp_dir):
                item_path = os.path.join(self.temp_dir, item)
                try:
                    if os.path.isfile(item_path) or os.path.islink(item_path):
                        if (now - os.path.getmtime(item_path)) > max_age_seconds:
                            os.remove(item_path)
                            deleted_count += 1
                    elif os.path.isdir(item_path):
                        if (now - os.path.getmtime(item_path)) > max_age_seconds:
                            shutil.rmtree(item_path, ignore_errors=True)
                            deleted_count += 1
                except Exception as ex:
                    logger.warning(f"Could not delete temp item {item_path}: {ex}")
        except Exception as e:
            logger.error(f"Error cleaning temp files: {e}")

        if deleted_count > 0:
            logger.info(f"STORAGE GUARD: Cleaned up {deleted_count} temporary files/folders.")
        return deleted_count


storage_guard = StorageGuardService()
