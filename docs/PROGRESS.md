# Registro de Progreso - Recetario Familiar Inteligente

Este documento registra el progreso fase por fase según la especificación maestra.

## Resumen del Entorno (Fase 0 - Auditoría)
- **Servidor:** Debian GNU/Linux 12 (bookworm), Kernel 6.1.0-53-amd64
- **CPUs:** 4 núcleos x86_64
- **Memoria RAM:** 7.8 GiB total (3.4 GiB disponible)
- **Almacenamiento `/dev/sda1`:** 53 GB total, 34 GB usados, 17 GB disponibles (68% uso)
- **NAS Synology montado:** `192.168.1.8` en `/mnt/media/...`
- **Dirección IP del servidor:** `192.168.1.80`
- **Puerto seleccionado para el Recetario (Frontend/Gateway):** `8500` (comprobado libre, sin conflictos)
- **Docker:** Versión instalada y funcional (sin sudo para usuario antigravity)
- **Docker Compose:** v5.5.1
- **Contenedores existentes respetados:** Portainer, Vaultwarden, Zigbee2mqtt, Mealie, qBittorrent, etc. (aislamiento garantizado en red independiente `recetario_net`)
- **Git:** Repositorio inicializado en `/home/antigravity/proyectos/recetas` (rama `main`)

---

## Estado por Fases

| Fase | Descripción | Estado | Fecha de Inicio | Fecha de Finalización |
|------|-------------|--------|-----------------|-----------------------|
| 0 | Auditoría del entorno | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 1 | Base técnica (Docker, DB, Auth Argon2id, RBAC, MFA TOTP, UI base, i18n ES/EU) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 2 | Recetario (CRUD, variantes TM7/Airfryer/Tradicional, raciones, cocina guiada, timers) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 3 | Importador inteligente (PDF, DOCX, OCR Tesseract, separación múltiple, drafts) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 4 | Planificador de menús (comensales, IA, restricciones, aprovechamiento de sobras) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 5 | Despensa y compras (3 modos, existencias por ubicación, tickets OCR y precios) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 6 | Alimentación saludable (perfil privado, consentimiento IA, hábitos culinarios) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 7 | Instagram y multimedia (URL, extracción audio, Faster-Whisper, limpieza estricta) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 8 | PWA avanzada (offline IndexedDB, Service Worker, WakeLock, lectura por voz) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 9 | Backups y administración (PostgreSQL pg_dump cifrado, Synology 192.168.1.8, auditoría) | **COMPLETADA** | 2026-10-17 | 2026-10-17 |
| 10 | Validación final, pruebas y producción | **EN CURSO** | 2026-10-17 | - |

---

## Decisiones Técnicas Implementadas
1. **Gateway Nginx Frontend en puerto 8500:** Sirve la SPA PWA estática y redirige `/api/` y WebSockets hacia `backend:8000`. Listo para proxy inverso HTTPS de Cloudflare y Nginx Proxy Manager.
2. **Aislamiento en red `recetario_net`:** PostgreSQL y Redis no exponen puertos al host.
3. **StorageGuard:** Limpieza automática de temporales y suspensión automática de tareas pesadas si el disco cae por debajo de 4GB libres.
4. **MFA y Seguridad:** Argon2id para contraseñas, códigos TOTP con códigos de recuperación uniuso, y registro estricto de auditoría para accesos administrativos a datos privados de hogares.
