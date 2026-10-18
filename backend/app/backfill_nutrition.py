import json
import logging
from app.database import SessionLocal
from app.models.recipe import Recipe
from app.models.import_job import RecipeDraft
from app.services.gemini_service import gemini_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill_nutrition")

def backfill():
    db = SessionLocal()
    try:
        # 1. Backfill recipes
        recipes = db.query(Recipe).all()
        logger.info(f"Found {len(recipes)} recipes in database.")
        for r in recipes:
            logger.info(f"Processing recipe {r.id}: '{r.title}' (current cal: {r.nutrition_calories})")
            variant = next((v for v in r.variants if v.is_default), r.variants[0] if r.variants else None)
            ingredients = []
            if variant:
                for ing in variant.ingredients:
                    ingredients.append({
                        "name": ing.name,
                        "amount": ing.amount,
                        "unit": ing.unit,
                        "notes": ing.notes
                    })
            est = gemini_service.estimate_recipe_nutrition(
                title=r.title,
                ingredients=ingredients,
                base_servings=r.base_servings or 4,
                dish_type=r.dish_type
            )
            r.nutrition_calories = est.get("calories")
            r.nutrition_protein = est.get("protein")
            r.nutrition_carbs = est.get("carbs")
            r.nutrition_fat = est.get("fat")
            logger.info(f"  -> Updated recipe {r.id} with: {est}")
        db.commit()
        logger.info("All recipes successfully updated with nutritional information.")

        # 2. Backfill drafts
        drafts = db.query(RecipeDraft).all()
        logger.info(f"Found {len(drafts)} drafts in database.")
        for d in drafts:
            try:
                ex = json.loads(d.extracted_json) if isinstance(d.extracted_json, str) else (d.extracted_json or {})
            except Exception:
                ex = {}

            if ex.get("nutrition_calories") is None or float(ex.get("nutrition_calories") or 0) <= 0:
                ingredients = ex.get("ingredients") or []
                base_servings = ex.get("base_servings") or 4
                dish_type = ex.get("dish_type") or "Plato principal"
                est = gemini_service.estimate_recipe_nutrition(
                    title=d.title or ex.get("title") or "Receta",
                    ingredients=ingredients,
                    base_servings=base_servings,
                    dish_type=dish_type
                )
                ex["nutrition_calories"] = est.get("calories")
                ex["nutrition_protein"] = est.get("protein")
                ex["nutrition_carbs"] = est.get("carbs")
                ex["nutrition_fat"] = est.get("fat")
                d.extracted_json = json.dumps(ex, ensure_ascii=False)
                logger.info(f"  -> Draft {d.id} '{d.title}' updated with {est.get('calories')} kcal")

        db.commit()
        logger.info("All drafts successfully updated with nutritional information.")

    except Exception as e:
        db.rollback()
        logger.error(f"Error during backfill: {e}", exc_info=True)
    finally:
        db.close()

if __name__ == "__main__":
    backfill()
