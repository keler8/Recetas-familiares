# Registro de Decisiones de Arquitectura (ADR)

## ADR-001: Arquitectura de Despliegue con Gateway Nginx Frontend
- **Fecha:** 2026-10-17
- **Contexto:** Se requiere acceso local vía `http://IP:PUERTO` y compatibilidad transparente con proxy inverso HTTPS (Nginx Proxy Manager / Cloudflare), sin exponer servicios internos como Postgres o Redis.
- **Decisión:** Exponer un único puerto host (`8500`) hacia el contenedor `frontend` (Nginx), que sirve la SPA y enruta `/api/` y `/ws` internamente a `backend:8000`.
- **Consecuencias:** Simplifica configuración de cortafuegos y proxies, elimina problemas de CORS en producción, asegura cabeceras `X-Forwarded-*` y cookies seguras.

## ADR-002: Base de Datos Relacional y Migraciones
- **Fecha:** 2026-10-17
- **Contexto:** El modelo de datos abarca más de 40 entidades interrelacionadas con requisitos de auditoría, control de versiones, precisión decimal en precios y monedas.
- **Decisión:** PostgreSQL 16 con SQLAlchemy 2.0 y Alembic. Uso de tipos `Numeric(10, 2)` para precios y cantidades monetarias exactas, y claves foráneas con cascadas controladas.

## ADR-003: Control de Almacenamiento y Protección del Disco Debian
- **Fecha:** 2026-10-17
- **Contexto:** El disco principal del servidor cuenta con 17GB disponibles y ha sufrido incidencias previas por saturación.
- **Decisión:**
  1. Todos los ficheros de importación, OCR, transcripción y vídeo se consideran estrictamente temporales y se almacenan en un directorio con limpieza inmediata tras su procesamiento o cancelación.
  2. Implementar servicio de monitorización periódica de espacio libre en disco. Si el espacio libre cae por debajo de 5GB (o umbral configurable), se suspenden temporalmente nuevas tareas pesadas de importación y se emite alerta administrativa.
  3. Las imágenes definitivas aprobadas se guardan en Google Drive (carpeta del proyecto) con caché local de miniaturas estrictamente acotada (máximo 500MB).

## ADR-004: Autenticación, MFA y Autorización
- **Fecha:** 2026-10-17
- **Contexto:** No debe existir registro público; los usuarios son creados/invitados por administradores. MFA TOTP obligatorio para administradores, opcional para familiares.
- **Decisión:** Hashing con Argon2id (`passlib[argon2]`), tokens JWT en cookies HTTP-only con protección SameSite y revocación en Redis, y TOTP con `pyotp` y códigos de recuperación uniuso. Auditoría estricta de accesos administrativos a datos privados de hogares.
