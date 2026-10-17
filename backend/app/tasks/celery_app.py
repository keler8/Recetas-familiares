import os
import logging
from celery import Celery
from celery.schedules import crontab
from app.config import settings
from app.services.storage_guard import storage_guard
from app.services.backup_service import backup_service

logger = logging.getLogger(__name__)

celery_app = Celery(
    "recetario_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Madrid",
    enable_utc=True,
    worker_concurrency=2,
    worker_prefetch_multiplier=1,
)

# Celery Beat Periodic Tasks
celery_app.conf.beat_schedule = {
    "clean-temp-files-every-15-mins": {
        "task": "app.tasks.celery_app.cleanup_temp_files_task",
        "schedule": 900.0,  # 15 minutes
    },
    "monitor-disk-space-every-5-mins": {
        "task": "app.tasks.celery_app.monitor_disk_space_task",
        "schedule": 300.0,  # 5 minutes
    },
    "nightly-backup-daily": {
        "task": "app.tasks.celery_app.nightly_backup_task",
        "schedule": crontab(hour=3, minute=0),  # 03:00 AM Europe/Madrid
    }
}


@celery_app.task
def cleanup_temp_files_task():
    logger.info("Executing scheduled cleanup of temporary files...")
    cleaned = storage_guard.cleanup_old_temp_files(max_age_seconds=3600)
    return {"cleaned_files": cleaned}


@celery_app.task
def monitor_disk_space_task():
    usage = storage_guard.get_disk_usage()
    if not usage["is_safe"]:
        logger.error(
            f"CRITICAL DISK ALERT: Free disk is only {usage['free_gb']} GB! (Threshold: {usage['min_free_threshold_gb']} GB)"
        )
    return usage


@celery_app.task
def nightly_backup_task():
    logger.info("Executing nightly automated database backup...")
    result = backup_service.create_database_backup()
    return result
