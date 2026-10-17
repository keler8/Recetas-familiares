# Recetario Familiar Inteligente

Aplicación web progresiva (PWA) de producción para la gestión inteligente de recetas familiares, cocina guiada adaptada a electrodomésticos (Thermomix TM7, Airfryer 6L y tradicional), planificación de menús, control de existencias en despensa, listas de compra interactivas con escaneo OCR de tickets, y orientación en alimentación saludable.

---

## 1. Acceso a la Aplicación

- **Red local:** [http://192.168.1.80:8500](http://192.168.1.80:8500)
- **Puerto expuesto en el host:** `8500` (comprobado libre y sin conflicto con ningún servicio existente).
- **Acceso exterior HTTPS:** Listo para proxy inverso con **Nginx Proxy Manager** y **Cloudflare**. La aplicación acepta cabeceras `X-Forwarded-*`, cookies seguras y contexto seguro para la PWA.

### Credenciales iniciales del Administrador:
- **Email:** `admin@recetas.local`
- **Usuario:** `admin`
- **Contraseña:** `AdminRecetas_2026!`
- **Doble Factor (TOTP):** En el primer inicio de sesión se requerirá configurar la autenticación de doble factor mediante la app de autenticación (Google Authenticator, Bitwarden, etc.) escaneando el código QR en pantalla. Se proporcionan códigos de recuperación uniuso.

---

## 2. Arquitectura de Servicios Docker

El despliegue está totalmente contenerizado mediante un proyecto Docker Compose independiente (`recetario_net`), garantizando el aislamiento absoluto de los demás contenedores del servidor Debian:

1. **`frontend` (Nginx 1.25 Alpine):**
   - Sirve la PWA construida en React 18, TypeScript, Vite y Tailwind CSS.
   - Actúa como gateway inverso enrutando `/api/` y WebSockets hacia el contenedor backend.
   - Único contenedor con puerto expuesto al host (`8500:80`).
2. **`backend` (FastAPI / Python 3.11):**
   - API REST con contratos Pydantic v2, SQLAlchemy 2.0 y Alembic.
   - Seguridad: contraseñas cifradas con Argon2id, tokens JWT, TOTP con `pyotp`, limitación de accesos y auditoría estricta.
3. **`postgres` (PostgreSQL 16 Alpine):**
   - Base de datos relacional normalizada con más de 30 entidades.
   - Red interna privada, sin exposición de puertos al host.
4. **`redis` (Redis 7 Alpine):**
   - Broker de mensajería para Celery y caché de sesiones.
5. **`worker` (Celery Worker):**
   - Ejecución asíncrona de tareas pesadas: extracción de documentos, OCR Tesseract, transcripción de audios con Faster-Whisper, consultas estructuradas a Gemini AI y compresión de backups.
6. **`scheduler` (Celery Beat):**
   - Tareas periódicas: monitorización de espacio libre en disco cada 5 minutos, limpieza de temporales obsoletos cada 15 minutos y copias de seguridad automáticas nocturnas.

---

## 3. Protección Crítica de Almacenamiento (Servidor Debian)

Para proteger los 17GB libres de la partición raíz `/dev/sda1` y evitar saturaciones de disco:
1. **Regla de archivos temporales:** Todos los archivos descargados para OCR, PDF, imágenes, audios y vídeos de Instagram son estrictamente temporales. Se eliminan automáticamente en cuanto finaliza su procesamiento o si la tarea se cancela.
2. **Storage Guard:** El servicio `StorageGuard` supervisa continuamente el espacio disponible en disco. Si el espacio libre cae por debajo de **4 GB** (configurable en `DISK_MIN_FREE_GB`), se suspenden automáticamente nuevas tareas pesadas de importación y se emite una alerta en el panel de administración.
3. **Imágenes definitivas:** Se conservan las referencias y se sincronizan con la carpeta del proyecto en Google Drive, manteniendo en local únicamente una caché ligera de miniaturas.

---

## 4. Áreas Funcionales de la Aplicación

- **Recetario Compartido:** Ficha completa de recetas con modos de preparación intercambiables (Thermomix TM7, Airfryer 6L, Tradicional), escalado inteligente de raciones (con reglas culinarias que no multiplican ciegamente levadura, picante o tiempos de cocción), valoraciones, favoritos y notas personales privadas.
- **Cocina Guiada:** Modo táctil a pantalla completa, texto gigante, temporizadores integrados con avisos acústicos, lectura por voz (Web Speech API) y prevención de apagado de pantalla (WakeLock API).
- **Centro de Importación:** Admisión de múltiples recetas por documento (PDF, DOCX, imágenes, Instagram Reels o vídeos). Barra de progreso segmentada (publicadas, pendientes, duplicadas) y cola de revisión individual antes de publicar.
- **Planificador de Menús:** Calendario semanal de comidas y cenas, comensales configurables, generador de menús con IA priorizando recetas aprobadas y gestión de sobras (aprovechamiento).
- **Despensa y Compras:** Existencias organizadas por ubicación (Nevera, Congelador, Despensa), alertas de caducidad, listas colaborativas con 3 modos (Completa, Inteligente descontando despensa, Asistida) y traspaso automático a despensa al marcar artículos como comprados.
- **Lectura de Tickets:** Escaneo de tickets de supermercado con OCR e IA, desglose de líneas y precios, histórico de costes por producto y actualización directa del inventario.
- **Mi Alimentación:** Perfil privado, hábitos, objetivos alimentarios, consentimiento explícito para IA y orientaciones culinarias saludables (sin afirmaciones médicas).
- **Administración Global:** Métricas del sistema en tiempo real, estado de almacenamiento de Debian, gestión de usuarios/roles, registro de auditoría y copias de seguridad cifradas con verificación de integridad SHA-256 (preparado para Google Drive y NAS Synology en `192.168.1.8`).

---

## 5. Comandos de Gestión y Mantenimiento

### Iniciar los contenedores:
```bash
docker compose up -d
```

### Consultar estado de los servicios:
```bash
docker compose ps
```

### Ver registros en tiempo real:
```bash
docker compose logs -f backend
```

### Ejecutar copia de seguridad manual de la base de datos:
```bash
docker compose exec backend python -c "from app.services.backup_service import backup_service; print(backup_service.create_database_backup())"
```

### Restaurar una copia de seguridad:
```bash
docker compose exec -T postgres pg_restore -U recetario_app -d recetario_db /app/data/backups/recetario_backup_NOMBRE.tar.gz
```

### Limpiar archivos temporales manualmente:
```bash
docker compose exec backend python -c "from app.services.storage_guard import storage_guard; storage_guard.cleanup_old_temp_files(max_age_seconds=0)"
```

### Ejecutar batería de pruebas automáticas:
```bash
docker compose exec backend pytest
```
