# Arquitectura Técnica - Recetario Familiar Inteligente

## 1. Visión General
Aplicación web progresiva (PWA) e infraestructura contenerizada para la gestión inteligente de recetas familiares, planificación culinaria, inventario de despensa, listas de compra y adaptaciones de electrodomésticos (Thermomix TM7, Airfryer 6L, tradicional).

```
[ Cliente Navegador / PWA Móvil ]
                 │
                 ▼ (HTTP local :8500 o HTTPS vía Nginx Proxy Manager / Cloudflare)
       ┌──────────────────┐
       │     frontend     │  Nginx 1.25 Alpine
       │  (React + Vite)  │  - Sirve SPA estática
       └─────────┬────────┘  - Proxy inverso a /api y /ws
                 │
      (Red interna Docker: recetario_net)
                 │
                 ▼
       ┌──────────────────┐
       │     backend      │  FastAPI (Python 3.11)
       │  (REST API / WS) │  - Autenticación Argon2id + JWT + TOTP
       └─────┬──────┬─────┘  - Lógica de negocio, RBAC, auditoría
             │      │
      ┌──────┴──┐   └───┐
      ▼         ▼       ▼
┌──────────┐ ┌─────┐ ┌──────────────────────────────────────┐
│ postgres │ │redis│ │ worker & scheduler (Celery)          │
│ (v16)    │ │(v7) │ │ - OCR, Whisper, Gemini, Backups,     │
└──────────┘ └─────┘ │   Limpieza automática de temporales  │
                     └──────────────────────────────────────┘
```

## 2. Componentes Docker
1. **frontend**:
   - React 18, TypeScript, Tailwind CSS, Lucide Icons, Radix UI.
   - PWA con Service Worker, Web App Manifest e IndexedDB para modo offline.
   - Soporte multilingüe completo (Castellano y Euskera).
   - Nginx actúa como gateway único expuesto en el puerto host `8500`.
2. **backend**:
   - FastAPI con Pydantic v2 y SQLAlchemy 2.0.
   - Alembic para migraciones de esquema de base de datos.
   - Autenticación con Argon2id, JWT en cookies HTTP-only / cabeceras Bearer, y MFA TOTP con pyotp.
3. **postgres**:
   - PostgreSQL 16 Alpine.
   - Volumen dedicado `recetario_pgdata`.
   - Sin puerto expuesto al host (seguridad por defecto).
4. **redis**:
   - Redis 7 Alpine como broker de mensajes y caché de sesiones / cuotas.
   - Volumen `recetario_redisdata`.
5. **worker**:
   - Celery worker para tareas asíncronas pesadas (OCR, transcripción Faster-Whisper, llamadas a Gemini, generación de miniaturas, copias de seguridad).
   - Concurrencia limitada y límites de memoria estrictos.
6. **scheduler**:
   - Celery beat para tareas programadas: comprobación de caducidades, monitorización de espacio en disco, limpieza de temporales obsoletos y backups periódicos.

## 3. Red y Seguridad
- **Red privada:** `recetario_net` (aislada de otras redes de Docker en el servidor).
- **Puerto expuesto:** Únicamente `8500` en el host (`192.168.1.80:8500`), listo para Nginx Proxy Manager y Cloudflare con proxy inverso HTTPS (`X-Forwarded-For`, `X-Forwarded-Proto`, etc.).
- **Almacenamiento protegido:** Volúmenes con cuotas y limpieza automática para proteger los 17GB libres de `/dev/sda1`.
