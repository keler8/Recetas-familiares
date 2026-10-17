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
| 1 | Base técnica (Docker, DB, Auth, RBAC, MFA, UI base, i18n) | **EN CURSO** | 2026-10-17 | - |
| 2 | Recetario (CRUD, variantes, cocina guiada, temporizadores) | Pendiente | - | - |
| 3 | Importador inteligente (PDF, OCR, Drive, deduplicación) | Pendiente | - | - |
| 4 | Planificador de menús (comensales, IA, restricciones) | Pendiente | - | - |
| 5 | Despensa y compras (listas, normalización, tickets OCR/precios) | Pendiente | - | - |
| 6 | Alimentación saludable (perfil, consentimiento IA, hábitos) | Pendiente | - | - |
| 7 | Instagram y multimedia (URL, transcripción local Whisper, Drive) | Pendiente | - | - |
| 8 | PWA avanzada (offline IndexedDB, Service Worker, push) | Pendiente | - | - |
| 9 | Backups y administración (Google Drive, Synology, panel técnico) | Pendiente | - | - |
| 10 | Validación final, pruebas y producción | Pendiente | - | - |

---

## Decisiones Técnicas Inmediatas
1. **Frontend en puerto 8500:** Nginx en el contenedor frontend servirá la PWA estática y enrutará peticiones `/api/` y `/ws` al contenedor backend FastAPI.
2. **Postgres & Redis:** Totalmente aislados en la red interna de Docker, sin exponer puertos a la máquina anfitriona para evitar interferencias y garantizar máxima seguridad.
3. **Control estricto de almacenamiento temporal:** Directorio montado `data/tmp/` con cuota y tareas periódicas de limpieza inmediata para no comprometer los 17GB libres del disco Debian.
