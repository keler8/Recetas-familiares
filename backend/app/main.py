import logging
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User, Household, HouseholdMembership, Recipe, RecipeVariant, RecipeIngredient, RecipeStep
from app.services.auth_service import auth_service
from app.api.v1 import (
    auth, households, recipes, imports, meal_plans,
    pantry, shopping, receipts, nutrition, drive, admin, notifications
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("recetario")


def seed_initial_data():
    """Initializes database schema and seeds initial admin and demo recipe."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed initial admin if no user exists
        admin_count = db.query(User).count()
        if admin_count == 0:
            logger.info("Seeding initial administrator user...")
            hashed_pw = auth_service.get_password_hash(settings.INITIAL_ADMIN_PASSWORD)
            admin_user = User(
                email=settings.INITIAL_ADMIN_EMAIL,
                username=settings.INITIAL_ADMIN_USERNAME,
                full_name="Administrador del Recetario",
                role="admin",
                hashed_password=hashed_pw,
                is_active=True,
                mfa_enabled=False  # Will be prompted for TOTP setup upon first login
            )
            db.add(admin_user)
            db.flush()

            # Personal household
            hh = Household(
                name="Hogar Principal",
                description="Hogar familiar predeterminado",
                owner_id=admin_user.id,
                is_personal=True
            )
            db.add(hh)
            db.flush()

            db.add(HouseholdMembership(
                household_id=hh.id,
                user_id=admin_user.id,
                role="owner"
            ))

            # 2. Seed initial reference recipe from user specifications: "Pollo al curry con arroz"
            recipe = Recipe(
                title="Pollo al curry con arroz",
                description="Delicioso pollo tierno en salsa de curry cremosa con leche de coco, servido con arroz basmati.",
                summary="Plato principal aromático y reconfortante.",
                main_image_url="https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80",
                categories=json.dumps(["Comidas", "Platos principales"], ensure_ascii=False),
                tags=json.dumps(["Thermomix", "Tradicional", "Sin gluten"], ensure_ascii=False),
                dish_type="Plato principal",
                cuisine="Mediterránea con fusión oriental",
                prep_time_min=15,
                cook_time_min=20,
                total_time_min=35,
                difficulty="facil",
                base_servings=4,
                equipment_notes="Vaso de Thermomix TM7 o sartén honda tradicional",
                preservation_tips="Conserva en nevera hasta 3 días en recipiente hermético de cristal.",
                freezing_tips="Apto para congelar sin el arroz.",
                reheating_tips="Calentar suavemente añadiendo una cucharada de agua o leche.",
                allergens=json.dumps([], ensure_ascii=False),
                review_status="approved",
                created_by_id=admin_user.id
            )
            db.add(recipe)
            db.flush()

            # Thermomix Variant
            tm_var = RecipeVariant(
                recipe_id=recipe.id,
                variant_type="thermomix",
                title="Thermomix TM7",
                description="Preparación guiada en Thermomix TM7 con giro inverso para proteger el pollo.",
                is_default=True,
                appliance_settings=json.dumps({"model": "TM7", "accessory": "Mariposa y Cuchillas"}, ensure_ascii=False)
            )
            db.add(tm_var)
            db.flush()

            tm_ingredients = [
                ("Pechuga de pollo", 300, "g", "cortada en dados"),
                ("Arroz basmati", 150, "g", None),
                ("Leche de coco", 200, "ml", None),
                ("Cebolla", 1, "ud", "en cuartos"),
                ("Aceite de oliva virgen extra", 30, "g", None),
                ("Curry en polvo", 1, "cucharada", None),
                ("Sal y pimienta", 1, "pizca", "al gusto")
            ]
            for idx, (iname, iamt, iunit, inotes) in enumerate(tm_ingredients):
                db.add(RecipeIngredient(
                    variant_id=tm_var.id,
                    name=iname,
                    amount=iamt,
                    unit=iunit,
                    notes=inotes,
                    order_index=idx
                ))

            tm_steps = [
                (1, "Preparar y pesar todos los ingredientes con la báscula integrada de la TM7.", None, None, None, 60, "Organiza todo en cuencos antes de empezar.", True),
                (2, "Introducir la cebolla en el vaso. Picar 5 seg / Vel 5. Bajar los restos de las paredes con la espátula.", "Picar", None, "Velocidad 5", 5, None, False),
                (3, "Añadir 30 g de aceite de oliva. Sofreír 5 min / 120 °C / Vel 1.", "Sofreír", "120 °C", "Velocidad 1", 300, "Dejar sin cubilete para dorar mejor.", False),
                (4, "Incorporar el pollo en dados y el curry en polvo. Rehogar 3 min / 120 °C / Giro Inverso / Vel Cuchara.", "Rehogar", "120 °C", "Giro Inverso, Vel Cuchara", 180, "El giro inverso evita que el pollo se deshaga.", False),
                (5, "Verter la leche de coco y la sal. Colocar el cestillo sobre la tapa y programar 12 min / 100 °C / Giro Inverso / Vel Cuchara.", "Cocinar", "100 °C", "Giro Inverso, Vel Cuchara", 720, "Servir caliente acompañado del arroz.", False)
            ]
            for snum, sinstr, saction, stemp, sspeed, stimer, stip, smanual in tm_steps:
                db.add(RecipeStep(
                    variant_id=tm_var.id,
                    step_number=snum,
                    instruction=sinstr,
                    appliance_action=saction,
                    temperature=stemp,
                    speed=sspeed,
                    timer_seconds=stimer,
                    tip=stip,
                    is_manual=smanual
                ))

            # Traditional Variant
            trad_var = RecipeVariant(
                recipe_id=recipe.id,
                variant_type="traditional",
                title="Tradicional",
                description="Cocinado en cazuela o sartén antiadherente.",
                is_default=False
            )
            db.add(trad_var)
            db.flush()

            for idx, (iname, iamt, iunit, inotes) in enumerate(tm_ingredients):
                db.add(RecipeIngredient(
                    variant_id=trad_var.id,
                    name=iname,
                    amount=iamt,
                    unit=iunit,
                    notes=inotes,
                    order_index=idx
                ))

            trad_steps = [
                (1, "Picar la cebolla finamente y cortar el pollo en dados de bocado.", None, None, None, None, None, True),
                (2, "En una sartén honda, calentar el aceite de oliva y pochar la cebolla a fuego medio durante 7 minutos.", "Pochar", "Fuego medio", None, 420, None, False),
                (3, "Añadir los dados de pollo y dorar durante 5 minutos hasta que tomen color.", "Dorar", "Fuego medio-alto", None, 300, None, False),
                (4, "Agregar el curry en polvo, remover 30 segundos e incorporar la leche de coco y la sal.", "Mezclar", "Fuego medio", None, 60, None, False),
                (5, "Dejar cocer a fuego lento durante 10 minutos hasta que la salsa espese. Servir con el arroz.", "Cocer a fuego lento", "Fuego bajo", None, 600, None, False)
            ]
            for snum, sinstr, saction, stemp, sspeed, stimer, stip, smanual in trad_steps:
                db.add(RecipeStep(
                    variant_id=trad_var.id,
                    step_number=snum,
                    instruction=sinstr,
                    appliance_action=saction,
                    temperature=stemp,
                    speed=sspeed,
                    timer_seconds=stimer,
                    tip=stip,
                    is_manual=smanual
                ))

            db.commit()
            logger.info("Initial seed completed successfully.")
    except Exception as e:
        logger.error(f"Error during initial seed: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Recetario Familiar backend...")
    seed_initial_data()
    yield
    logger.info("Shutting down Recetario Familiar backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API REST para el Recetario Familiar Inteligente con gestión de IA, PWA y electrodomésticos",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan
)

# CORS Middleware (allows requests from frontend container and local/reverse proxy)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Salud"])
def health_check():
    from app.services.storage_guard import storage_guard
    storage = storage_guard.get_disk_usage()
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "storage_safe": storage["is_safe"],
        "free_disk_gb": storage["free_gb"]
    }


# Include API v1 Routers
app.include_router(auth.router, prefix="/api")
app.include_router(households.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(meal_plans.router, prefix="/api")
app.include_router(pantry.router, prefix="/api")
app.include_router(shopping.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(nutrition.router, prefix="/api")
app.include_router(drive.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
