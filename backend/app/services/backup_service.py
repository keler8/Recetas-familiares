import os
import subprocess
import hashlib
import time
import logging
import tarfile
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class BackupService:
    def __init__(self, backup_dir: str = settings.BACKUP_PATH):
        self.backup_dir = backup_dir
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_database_backup(self) -> Dict[str, Any]:
        """
        Executes pg_dump on PostgreSQL database, archives and hashes the backup file.
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"recetario_backup_{timestamp}.sql"
        sql_path = os.path.join(self.backup_dir, backup_filename)
        tar_filename = f"recetario_backup_{timestamp}.tar.gz"
        tar_path = os.path.join(self.backup_dir, tar_filename)

        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

        try:
            # 1. Run pg_dump
            cmd = [
                "pg_dump",
                "-h", settings.POSTGRES_SERVER,
                "-p", str(settings.POSTGRES_PORT),
                "-U", settings.POSTGRES_USER,
                "-d", settings.POSTGRES_DB,
                "-F", "c",  # custom format (compressed, flexible restore)
                "-f", sql_path
            ]
            subprocess.run(cmd, env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

            # 2. Package into tar.gz
            with tarfile.open(tar_path, "w:gz") as tar:
                tar.add(sql_path, arcname=backup_filename)

            # Remove plain SQL file to save space
            if os.path.exists(sql_path):
                os.remove(sql_path)

            # 3. Calculate SHA-256 hash
            hasher = hashlib.sha256()
            with open(tar_path, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            sha256_hash = hasher.hexdigest()
            file_size = os.path.getsize(tar_path)

            logger.info(f"Backup created successfully: {tar_filename} ({file_size} bytes, SHA256: {sha256_hash})")

            return {
                "success": True,
                "filename": tar_filename,
                "filepath": tar_path,
                "size_bytes": file_size,
                "sha256": sha256_hash,
                "timestamp": timestamp,
                "drive_synced": False,
                "synology_synced": False
            }
        except Exception as e:
            logger.error(f"Failed to create database backup: {e}")
            if os.path.exists(sql_path):
                os.remove(sql_path)
            return {
                "success": False,
                "error": str(e),
                "filename": tar_filename,
                "size_bytes": 0,
                "sha256": None
            }

    def verify_backup_integrity(self, tar_path: str) -> bool:
        """Verifies that the tarball is readable and not corrupted."""
        try:
            with tarfile.open(tar_path, "r:gz") as tar:
                return len(tar.getmembers()) > 0
        except Exception as e:
            logger.error(f"Backup verification failed for {tar_path}: {e}")
            return False

    def list_backups(self) -> List[Dict[str, Any]]:
        backups = []
        if not os.path.exists(self.backup_dir):
            return []

        for f in os.listdir(self.backup_dir):
            if f.endswith(".tar.gz"):
                fp = os.path.join(self.backup_dir, f)
                try:
                    stat = os.stat(fp)
                    backups.append({
                        "filename": f,
                        "size_bytes": stat.st_size,
                        "size_mb": round(stat.st_size / (1024 * 1024), 2),
                        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "is_valid": self.verify_backup_integrity(fp)
                    })
                except Exception:
                    pass
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return backups


backup_service = BackupService()
