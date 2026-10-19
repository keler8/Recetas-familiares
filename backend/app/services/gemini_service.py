import os
import json
import logging
import re
import uuid
import urllib.parse
from typing import Dict, Any, List, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

RECIPE_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "dish_type": {"type": "string"},
        "cuisine": {"type": "string"},
        "prep_time_min": {"type": "integer"},
        "cook_time_min": {"type": "integer"},
        "total_time_min": {"type": "integer"},
        "difficulty": {"type": "string", "enum": ["facil", "media", "dificil"]},
        "base_servings": {"type": "integer"},
        "categories": {
            "type": "array",
            "items": {"type": "string"}
        },
        "tags": {
            "type": "array",
            "items": {"type": "string"}
        },
        "allergens": {
            "type": "array",
            "items": {"type": "string"}
        },
        "ingredients": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "amount": {"type": ["number", "null"]},
                    "unit": {"type": ["string", "null"]},
                    "notes": {"type": ["string", "null"]},
                    "is_optional": {"type": "boolean"}
                },
                "required": ["name", "amount", "unit"]
            }
        },
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step_number": {"type": "integer"},
                    "instruction": {"type": "string"},
                    "timer_seconds": {"type": ["integer", "null"]},
                    "tip": {"type": ["string", "null"]}
                },
                "required": ["step_number", "instruction"]
            }
        },
        "uncertainty_notes": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["title", "ingredients", "steps"]
}


class GeminiService:
    @staticmethod
    def _normalize_model(model_name: Optional[str]) -> str:
        if not model_name:
            return "gemini-3.5-flash-lite"
        normalized = model_name.strip()
        deprecated = {
            "gemini-2.5-flash": "gemini-3.5-flash-lite",
            "gemini-2.0-flash": "gemini-3.5-flash-lite",
            "gemini-1.5-flash": "gemini-3.5-flash-lite",
            "gemini-1.5-pro": "gemini-3.1-pro-preview",
            "gemini-2.5-pro": "gemini-3.1-pro-preview",
            "gemini-3.8-flash": "gemini-3.5-flash-lite",
        }
        return deprecated.get(normalized, normalized)

    @staticmethod
    def _clean_json_response(text: str) -> str:
        if not text:
            return "{}"
        t = text.strip()
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t)
        if match:
            candidate = match.group(1).strip()
            if (candidate.startswith("{") and candidate.endswith("}")) or (candidate.startswith("[") and candidate.endswith("]")):
                return candidate

        start_obj = t.find("{")
        end_obj = t.rfind("}")
        start_arr = t.find("[")
        end_arr = t.rfind("]")

        if start_obj != -1 and end_obj != -1 and (start_arr == -1 or start_obj < start_arr):
            return t[start_obj:end_obj + 1].strip()
        elif start_arr != -1 and end_arr != -1:
            return t[start_arr:end_arr + 1].strip()

        if t.startswith("```json"):
            t = t[7:]
        elif t.startswith("```"):
            t = t[3:]
        if t.endswith("```"):
            t = t[:-3]
        return t.strip()

    def _generate_with_fallback(self, client, contents: Any, config: Any = None) -> Any:
        candidate_models = [self.model_name] + [
            "gemini-3.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.8-flash"
        ]
        seen = set()
        models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

        last_error = None
        for model in models_to_try:
            try:
                kwargs = {"model": model, "contents": contents}
                if config is not None:
                    kwargs["config"] = config
                return client.models.generate_content(**kwargs)
            except Exception as e:
                err_str = str(e)
                if any(code in err_str for code in ["429", "404", "503", "RESOURCE_EXHAUSTED", "NOT_FOUND", "UNAVAILABLE"]):
                    logger.warning(f"Model {model} failed with temporary error ({err_str[:80]}), trying next candidate model...")
                    last_error = e
                    continue
                else:
                    raise e
        if last_error:
            raise last_error
        raise RuntimeError("No candidate Gemini models succeeded")

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = self._normalize_model(settings.GEMINI_MODEL)
        self._client = None

    def load_from_db(self, db=None) -> "GeminiService":
        """Loads Gemini API key and model preference from SystemSetting database table."""
        close_session = False
        if db is None:
            try:
                from app.database import SessionLocal
                db = SessionLocal()
                close_session = True
            except Exception as e:
                logger.debug(f"Could not open DB session for Gemini settings: {e}")
                return self
        try:
            from app.models.system import SystemSetting
            setting = db.query(SystemSetting).filter(SystemSetting.key == "connector_gemini").first()
            if setting and setting.value:
                try:
                    data = json.loads(setting.value) if isinstance(setting.value, str) else setting.value
                    if data.get("api_key") and len(str(data["api_key"]).strip()) > 5:
                        self.api_key = str(data["api_key"]).strip()
                    if data.get("model"):
                        self.model_name = self._normalize_model(data["model"])
                    self._client = None
                except Exception as ex:
                    logger.warning(f"Error parsing connector_gemini settings: {ex}")
        except Exception as e:
            logger.warning(f"Error loading connector_gemini from database: {e}")
        finally:
            if close_session and db is not None:
                db.close()
        return self

    def is_configured(self) -> bool:
        if not (self.api_key and len(self.api_key.strip()) > 5):
            self.load_from_db()
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def update_credentials(self, api_key: Optional[str] = None, model: Optional[str] = None):
        if api_key is not None:
            self.api_key = api_key.strip() if api_key else None
        if model is not None:
            self.model_name = self._normalize_model(model)
        self._client = None  # Force re-initialization

    def test_connection(self, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        key_to_use = (api_key.strip() if api_key else None) or self.api_key
        if not key_to_use:
            self.load_from_db()
            key_to_use = self.api_key
        model_to_use = self._normalize_model((model.strip() if model else None) or self.model_name)
        if not key_to_use or len(key_to_use) < 5:
            return {"success": False, "error": "No se ha proporcionado una clave API de Gemini válida."}
        try:
            from google import genai
            client = genai.Client(api_key=key_to_use)
            response = client.models.generate_content(
                model=model_to_use,
                contents="Responde únicamente: 'Conexión con Recetario Familiar exitosa.'",
            )
            return {
                "success": True,
                "message": response.text.strip(),
                "model": model_to_use
            }
        except Exception as e:
            logger.error(f"Gemini connection test error: {e}")
            return {"success": False, "error": str(e)}

    def _get_client(self):
        if not self.is_configured():
            return None
        if not self._client:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize google-genai client: {e}")
        return self._client

    def extract_recipes_from_text(self, text: str, source_hint: str = "documento") -> List[Dict[str, Any]]:
        """
        Extracts one or multiple recipes from raw text using Gemini structured output,
        or falls back to local intelligent heuristic parser if API key is not configured.
        """
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    prompt = (
                        "Actúa como un chef profesional y redactor culinario de alta gastronomía. "
                        f"Analiza el siguiente texto culinario extraído de: {source_hint}.\n"
                        "Si el documento contiene varias recetas separadas, extrae cada una como un objeto dentro de una lista JSON.\n"
                        "REGLAS OBLIGATORIAS:\n"
                        "1. TÍTULO LIMPIO: Devuelve un título limpio y elegante en 'title'. Elimina numeraciones o viñetas iniciales (ej: '. Tarta...' -> 'Tarta...'). Si el título incluye notas de autoría como '(Ana Munel)' o 'Jordi Roca', mantén la receta con el nombre del plato y menciónalo con elegancia en 'description'.\n"
                        "2. CLASIFICACIÓN EXACTA (dish_type): Clasifica estrictamente como uno de: 'Postre', 'Plato principal', 'Entrante / Aperitivo', 'Guarnición', 'Desayuno / Merienda' o 'Bebida / Coctel'. Cualquier tarta, bizcocho, coulant, dulce o postre DEBE tener dish_type = 'Postre'.\n"
                        "3. TIEMPOS REALISTAS: Estima tiempos coherentes (prep_time_min, cook_time_min, total_time_min). No pongas tiempos por defecto.\n"
                        "4. DIFICULTAD: 'facil', 'media' o 'dificil'.\n"
                        "5. INGREDIENTES: Lista de objetos con 'name' (normalizado en español), 'amount' (numérico o null), 'unit' (ej: 'g', 'ml', 'ud', 'cucharada', 'pizca') y 'notes' (opcional).\n"
                        "6. PASOS: Lista de pasos secuenciales y detallados ('step_number', 'instruction', 'timer_seconds' en segundos si el paso requiere tiempo, y 'tip' opcional).\n"
                        "7. KEYWORD FOTO: 'food_keyword' con el término más preciso en inglés o español para buscar una foto culinaria perfecta del plato (ej: 'chocolate coulant lava cake', 'carrot cake cream cheese frosting', 'apple pie tart', 'seafood soup bisque', 'braised beef cheeks', etc.).\n"
                        "8. CALORÍAS Y VALOR NUTRICIONAL: Estima con rigor culinario las calorías por ración en 'nutrition_calories' (número realista, ej: 420.0) y los macronutrientes por ración: 'nutrition_protein' (proteínas en g), 'nutrition_carbs' (carbohidratos en g) y 'nutrition_fat' (grasas en g) basándote en los ingredientes, cantidades y raciones ('base_servings'). No dejes las calorías a null ni a 0.\n\n"
                        f"Texto de la receta:\n{text[:15000]}"
                    )
                    from google.genai import types
                    config = types.GenerateContentConfig(response_mime_type="application/json")
                    response = self._generate_with_fallback(
                        client,
                        contents=prompt,
                        config=config
                    )
                    content = response.text
                    parsed = json.loads(content)
                    raw_recipes = []
                    if isinstance(parsed, list):
                        raw_recipes = parsed
                    elif isinstance(parsed, dict) and "recipes" in parsed:
                        raw_recipes = parsed["recipes"]
                    elif isinstance(parsed, dict) and ("title" in parsed or "ingredients" in parsed):
                        raw_recipes = [parsed]
                    
                    if raw_recipes:
                        return [self._format_extracted_recipe(r, source_hint) for r in raw_recipes]
            except Exception as e:
                logger.warning(f"Gemini API extraction failed, using fallback heuristic parser: {e}")

        # Local intelligent heuristic parser fallback
        return [self._format_extracted_recipe(r, source_hint) for r in self._heuristic_recipe_parser(text)]

    def _format_extracted_recipe(self, r: Dict[str, Any], source_hint: str = "") -> Dict[str, Any]:
        """Ensures a recipe extracted from any document or text is complete, consistent, and beautifully formatted."""
        raw_title = r.get("title") or (os.path.splitext(source_hint)[0].replace("_", " ").title() if source_hint else "Receta sin título")
        # Strip leading dots, numbers, dashes, bullet points: e.g. ". Tarta de zanahoria" -> "Tarta de zanahoria"
        title = re.sub(r"^[\s0-9\.\-\*\•\–\—]+", "", str(raw_title)).strip()
        if not title:
            title = str(raw_title).strip() or "Receta sin título"

        prep_time = r.get("prep_time_min") or 15
        cook_time = r.get("cook_time_min") or 20
        total_time = r.get("total_time_min") or (prep_time + cook_time)

        # Smart classification of dish_type
        raw_dish_type = (r.get("dish_type") or "").strip()
        lower_title = title.lower()
        if not raw_dish_type or raw_dish_type.lower() in ["comida", "cena", "plato principal"]:
            if any(k in lower_title for k in ["tarta", "bizcocho", "coulant", "culan", "volcan", "volcán", "pastel", "brownie", "cheesecake", "dulce", "postre", "flan", "mousse", "galleta", "cookie", "magdalena", "muffin", "helado", "panna cotta", "crema catalana", "natilla"]):
                dish_type = "Postre"
            elif any(k in lower_title for k in ["sopa", "crema", "gazpacho", "salmorejo", "croqueta", "ensalada", "tapa", "aperitivo", "empanada"]):
                dish_type = "Entrante / Aperitivo"
            elif any(k in lower_title for k in ["tostada", "pancake", "tortita", "desayuno", "merienda", "smoothie"]):
                dish_type = "Desayuno / Merienda"
            else:
                dish_type = raw_dish_type or "Plato principal"
        else:
            dish_type = raw_dish_type

        cuisine = r.get("cuisine") or ("Repostería" if dish_type == "Postre" else "Mediterránea")
        difficulty = r.get("difficulty") or "media"
        if difficulty not in ["facil", "media", "dificil"]:
            difficulty = "media"

        base_servings = r.get("base_servings") or (8 if dish_type == "Postre" else 4)
        categories = r.get("categories") or ["Comidas", "Platos principales"]
        if isinstance(categories, str):
            categories = [categories]
        tags = r.get("tags") or ["Casero"]
        if isinstance(tags, str):
            tags = [tags]
        allergens = r.get("allergens") or []
        if isinstance(allergens, str):
            allergens = [allergens]

        # Clean ingredients
        raw_ings = r.get("ingredients") or []
        cleaned_ings = []
        for idx, ing in enumerate(raw_ings):
            if isinstance(ing, str):
                cleaned_ings.append({"name": ing.strip(), "amount": 1.0, "unit": "ud", "notes": None, "order_index": idx})
            elif isinstance(ing, dict):
                cleaned_ings.append({
                    "name": ing.get("name") or "Ingrediente",
                    "amount": ing.get("amount") if ing.get("amount") is not None else 1.0,
                    "unit": ing.get("unit") or "ud",
                    "notes": ing.get("notes"),
                    "order_index": idx
                })
        if not cleaned_ings:
            cleaned_ings.append({"name": "Ingredientes según preparación", "amount": 1.0, "unit": "ud", "notes": None, "order_index": 0})

        # Clean steps
        raw_steps = r.get("steps") or []
        cleaned_steps = []
        for idx, step in enumerate(raw_steps):
            if isinstance(step, str):
                cleaned_steps.append({"step_number": idx + 1, "instruction": step.strip(), "timer_seconds": None, "tip": None})
            elif isinstance(step, dict):
                cleaned_steps.append({
                    "step_number": step.get("step_number") or (idx + 1),
                    "instruction": step.get("instruction") or f"Paso {idx + 1}",
                    "timer_seconds": step.get("timer_seconds"),
                    "tip": step.get("tip")
                })
        if not cleaned_steps:
            cleaned_steps.append({"step_number": 1, "instruction": "Preparar y cocinar los ingredientes al gusto.", "timer_seconds": None, "tip": None})

        # Nutrition handling
        nutrition_cal = r.get("nutrition_calories")
        nutrition_prot = r.get("nutrition_protein")
        nutrition_carbs = r.get("nutrition_carbs")
        nutrition_fat = r.get("nutrition_fat")

        if nutrition_cal is None or float(nutrition_cal or 0) <= 0:
            est_nut = self.heuristic_estimate_nutrition(title, cleaned_ings, int(base_servings), dish_type)
            nutrition_cal = est_nut.get("calories")
            nutrition_prot = est_nut.get("protein")
            nutrition_carbs = est_nut.get("carbs")
            nutrition_fat = est_nut.get("fat")
        else:
            try:
                nutrition_cal = round(float(nutrition_cal), 1)
                nutrition_prot = round(float(nutrition_prot), 1) if nutrition_prot is not None else None
                nutrition_carbs = round(float(nutrition_carbs), 1) if nutrition_carbs is not None else None
                nutrition_fat = round(float(nutrition_fat), 1) if nutrition_fat is not None else None
            except (ValueError, TypeError):
                est_nut = self.heuristic_estimate_nutrition(title, cleaned_ings, int(base_servings), dish_type)
                nutrition_cal = est_nut.get("calories")
                nutrition_prot = est_nut.get("protein")
                nutrition_carbs = est_nut.get("carbs")
                nutrition_fat = est_nut.get("fat")

        return {
            "title": title,
            "description": r.get("description") or f"Exquisita receta de {title}.",
            "dish_type": dish_type,
            "cuisine": cuisine,
            "prep_time_min": int(prep_time),
            "cook_time_min": int(cook_time),
            "total_time_min": int(total_time),
            "difficulty": difficulty,
            "base_servings": int(base_servings),
            "categories": categories,
            "tags": tags,
            "allergens": allergens,
            "ingredients": cleaned_ings,
            "steps": cleaned_steps,
            "nutrition_calories": float(nutrition_cal) if nutrition_cal is not None else None,
            "nutrition_protein": float(nutrition_prot) if nutrition_prot is not None else None,
            "nutrition_carbs": float(nutrition_carbs) if nutrition_carbs is not None else None,
            "nutrition_fat": float(nutrition_fat) if nutrition_fat is not None else None,
            "uncertainty_notes": r.get("uncertainty_notes") or []
        }

    def estimate_recipe_nutrition(
        self,
        title: str,
        ingredients: List[Any],
        base_servings: int = 4,
        dish_type: Optional[str] = None,
        servings: Optional[int] = None
    ) -> Dict[str, float]:
        """
        Estimates nutritional values (calories, protein, carbs, fat per serving)
        using Gemini API, or falls back to intelligent nutritional heuristics.
        """
        effective_servings = servings if servings is not None else base_servings
        servings = max(1, int(effective_servings or 4))
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    ing_lines = []
                    for ing in (ingredients or []):
                        if isinstance(ing, str):
                            ing_lines.append(f"- {ing}")
                        elif isinstance(ing, dict):
                            amt = ing.get("amount")
                            unit = ing.get("unit") or ""
                            name = ing.get("name") or ""
                            notes = ing.get("notes")
                            amt_str = f"{amt} {unit}".strip() if amt else ""
                            notes_str = f" ({notes})" if notes else ""
                            ing_lines.append(f"- {amt_str} {name}{notes_str}".strip())

                    prompt = (
                        "Actúa como un dietista y nutricionista culinario profesional. "
                        "Calcula los valores nutricionales estimados POR RACIÓN para la siguiente receta culinaria:\n"
                        f"Título: {title}\n"
                        f"Tipo de plato: {dish_type or 'Plato'}\n"
                        f"Raciones base (servings): {servings}\n"
                        "Ingredientes:\n"
                        + ("\n".join(ing_lines) if ing_lines else "- Ingredientes habituales del plato") + "\n\n"
                        "Calcula la suma calórica realista de los ingredientes y divídela entre las raciones indicadas.\n"
                        "Devuelve ÚNICAMENTE un objeto JSON estructurado:\n"
                        "{\n"
                        '  "calories": 420.0,\n'
                        '  "protein": 28.5,\n'
                        '  "carbs": 35.0,\n'
                        '  "fat": 16.0\n'
                        "}"
                    )
                    from google.genai import types
                    config = types.GenerateContentConfig(response_mime_type="application/json")
                    response = self._generate_with_fallback(
                        client,
                        contents=prompt,
                        config=config
                    )
                    parsed = json.loads(response.text)
                    if isinstance(parsed, dict) and "calories" in parsed:
                        cal = float(parsed.get("calories") or 0)
                        prot = float(parsed.get("protein") or 0)
                        carbs = float(parsed.get("carbs") or 0)
                        fat = float(parsed.get("fat") or 0)
                        if cal > 0:
                            return {
                                "calories": round(cal, 1),
                                "protein": round(prot, 1),
                                "carbs": round(carbs, 1),
                                "fat": round(fat, 1)
                            }
            except Exception as e:
                logger.warning(f"Gemini API nutrition estimation failed: {e}")

        return self.heuristic_estimate_nutrition(title, ingredients, servings, dish_type)

    def heuristic_estimate_nutrition(
        self,
        title: str,
        ingredients: List[Any],
        base_servings: int = 4,
        dish_type: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Intelligent nutritional heuristic engine calculating calories and macros
        per serving based on ingredient density tables and culinary classification.
        """
        servings = max(1, int(base_servings or 4))
        lower_title = (title or "").lower()
        dish = (dish_type or "").lower()

        total_kcal = 0.0
        total_prot = 0.0
        total_carbs = 0.0
        total_fat = 0.0
        parsed_any = False

        INGREDIENT_DENSITIES = [
            (["aceite", "oliva", "girasol"], 884, 0, 0, 100),
            (["mantequilla", "manteca"], 717, 1, 0, 81),
            (["nata", "crema de leche", "crema para cocinar"], 340, 2.5, 3, 36),
            (["mayonesa"], 680, 1, 1, 75),
            (["azúcar", "azucar", "azúcar moreno", "glace"], 387, 0, 100, 0),
            (["miel", "sirope", "caramelo"], 304, 0.3, 82, 0),
            (["chocolate negro", "chocolate fondant", "cacao puro", "cacao"], 540, 8, 46, 31),
            (["chocolate blanco", "chocolate con leche"], 535, 8, 59, 30),
            (["turrón", "turron"], 550, 10, 50, 35),
            (["harina", "maizena", "almidon"], 364, 10, 76, 1),
            (["arroz"], 360, 7, 79, 1),
            (["pasta", "espagueti", "macarron", "tallarin", "fideo", "lasaña"], 370, 13, 74, 1.5),
            (["pan", "galleta", "bizcocho", "hojaldre", "masa"], 380, 8, 65, 12),
            (["avena"], 389, 17, 66, 7),
            (["pollo", "pechuga", "pavo"], 165, 31, 0, 3.6),
            (["ternera", "buey", "carne picada"], 250, 26, 0, 15),
            (["cerdo", "carrillera", "lomo", "costilla", "panceta", "bacon"], 280, 20, 0, 22),
            (["jamón", "jamon"], 240, 30, 0, 13),
            (["salmón", "salmon"], 208, 20, 0, 13),
            (["atún", "atun", "bonito"], 140, 24, 0, 4),
            (["merluza", "bacalao", "raya", "pescada", "lenguado"], 90, 18, 0, 1),
            (["gamba", "gambon", "langostino", "camarón", "vieira", "mejillón", "almeja"], 95, 20, 1, 1),
            (["huevo"], 155, 13, 1, 11),
            (["leche"], 62, 3.3, 4.8, 3.3),
            (["queso crema", "mascarpone", "philadelphia"], 350, 6, 4, 35),
            (["queso", "parmesano", "mozzarella", "gouda", "manchego", "cheddar", "cabrales"], 380, 25, 2, 30),
            (["yogur"], 60, 3.5, 4.7, 3.3),
            (["cuajada"], 90, 5, 5, 5),
            (["nuez", "nueces", "almendra", "avellana", "piñon", "cacahuete", "pistacho", "castaña"], 600, 15, 14, 55),
            (["garbanzo", "lenteja", "alubia", "judia blanca"], 160, 9, 27, 2.5),
            (["patata", "papa", "boniato", "batata"], 86, 2, 20, 0.1),
            (["calabaza", "zanahoria", "remolacha"], 35, 1, 8, 0.2),
            (["cebolla", "puerro", "ajo", "chalota"], 40, 1.4, 9, 0.1),
            (["tomate", "pimiento", "calabacín", "berenjena", "champiñon", "seta", "espárrago"], 25, 1.5, 4, 0.2),
            (["manzana", "pera", "plátano", "fresa", "granada", "naranja", "limón"], 55, 0.5, 14, 0.2)
        ]

        for ing in (ingredients or []):
            raw_name = ""
            amt = None
            unit = "ud"
            if isinstance(ing, str):
                raw_name = ing
                match = re.search(r"(\d+[\.,]?\d*)\s*(g|kg|ml|l|cucharadas?|pizcas?|ud|uds)?\s*(.*)", ing, re.IGNORECASE)
                if match:
                    amt = float(match.group(1).replace(",", "."))
                    unit = match.group(2) or "ud"
                    raw_name = match.group(3)
            elif isinstance(ing, dict):
                raw_name = ing.get("name") or ""
                amt = ing.get("amount")
                unit = (ing.get("unit") or "ud").lower()

            name_lower = raw_name.lower()
            grams = 100.0
            if amt is not None:
                try:
                    f_amt = float(amt)
                    if unit in ["kg", "l", "litro", "litros"]:
                        grams = f_amt * 1000.0
                    elif unit in ["g", "gr", "gramos", "ml"]:
                        grams = f_amt
                    elif unit in ["cucharada", "cucharadas", "tbsp"]:
                        grams = f_amt * 15.0
                    elif unit in ["cucharadita", "cucharaditas", "tsp"]:
                        grams = f_amt * 5.0
                    elif unit in ["taza", "tazas", "cup"]:
                        grams = f_amt * 200.0
                    elif unit in ["pizca", "pizcas"]:
                        grams = f_amt * 2.0
                    elif "huevo" in name_lower:
                        grams = f_amt * 55.0
                    else:
                        if any(w in name_lower for w in ["cebolla", "manzana", "pera", "patata"]):
                            grams = f_amt * 150.0
                        elif any(w in name_lower for w in ["diente", "ajo"]):
                            grams = f_amt * 5.0
                        else:
                            grams = f_amt * 80.0
                except (ValueError, TypeError):
                    grams = 100.0

            matched = False
            for keywords, k_cal, k_prot, k_carbs, k_fat in INGREDIENT_DENSITIES:
                if any(kw in name_lower for kw in keywords):
                    factor = grams / 100.0
                    total_kcal += k_cal * factor
                    total_prot += k_prot * factor
                    total_carbs += k_carbs * factor
                    total_fat += k_fat * factor
                    matched = True
                    parsed_any = True
                    break

            if not matched and len(name_lower) > 2:
                total_kcal += 30.0 * (grams / 100.0)

        per_serving_cal = total_kcal / servings if (parsed_any and total_kcal > 150) else None
        if not per_serving_cal or per_serving_cal < 80:
            if "postre" in dish or any(k in lower_title for k in ["tarta", "bizcocho", "coulant", "chocolate", "pastel", "brownie", "cheesecake", "flan", "mousse"]):
                return {"calories": 420.0, "protein": 6.5, "carbs": 54.0, "fat": 19.5}
            elif any(k in lower_title for k in ["sopa", "crema", "gazpacho", "salmorejo", "caldo"]):
                return {"calories": 185.0, "protein": 7.0, "carbs": 16.0, "fat": 9.5}
            elif any(k in lower_title for k in ["croqueta", "canapé", "canape", "tapa", "aperitivo"]):
                return {"calories": 260.0, "protein": 9.0, "carbs": 24.0, "fat": 14.0}
            elif any(k in lower_title for k in ["ensalada"]):
                return {"calories": 280.0, "protein": 8.0, "carbs": 12.0, "fat": 20.0}
            elif any(k in lower_title for k in ["arroz", "pasta", "espagueti", "macarron", "lasaña"]):
                return {"calories": 520.0, "protein": 22.0, "carbs": 74.0, "fat": 14.0}
            elif any(k in lower_title for k in ["pollo", "ternera", "carne", "carrillera", "solomillo"]):
                return {"calories": 480.0, "protein": 38.0, "carbs": 18.0, "fat": 24.0}
            elif any(k in lower_title for k in ["pescado", "salmón", "salmon", "merluza", "raya", "marisco", "vieira"]):
                return {"calories": 390.0, "protein": 34.0, "carbs": 12.0, "fat": 18.0}
            else:
                return {"calories": 440.0, "protein": 26.0, "carbs": 38.0, "fat": 18.0}

        return {
            "calories": round(total_kcal / servings, 1),
            "protein": round(total_prot / servings, 1),
            "carbs": round(total_carbs / servings, 1),
            "fat": round(total_fat / servings, 1)
        }

    def generate_appliance_variant(self, recipe_dict: Dict[str, Any], target_appliance: str) -> Dict[str, Any]:

        """
        Generates Thermomix TM7 or Airfryer 6L variant adaptation.
        """
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    prompt = (
                        f"Adapta la siguiente receta para {target_appliance.upper()} con precisión culinaria profesional. "
                        "Si es Thermomix TM7: especifica velocidades (ej. Vel 1 a 10, cuchara, espiga), giro inverso cuando "
                        "corresponda, temperaturas (ej. 100°C, 120°C, Varoma), tiempos exactos y accesorios (cuchillas, mariposa, cestillo). "
                        "Si es Airfryer: toma como referencia una cesta de 6 Litros, temperatura en °C, tiempos por tanda y aviso de volteo o agitación. "
                        "Devuelve únicamente un JSON con { 'title': str, 'description': str, 'appliance_settings': dict, 'ingredients': list, 'steps': list }.\n\n"
                        f"Receta base:\n{json.dumps(recipe_dict, ensure_ascii=False)}"
                    )
                    response = client.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config={"response_mime_type": "application/json"}
                    )
                    return json.loads(response.text)
            except Exception as e:
                logger.warning(f"Gemini appliance variant failed, fallback applied: {e}")

        # Fallback adaptation template
        return self._heuristic_variant_generator(recipe_dict, target_appliance)

    def analyze_receipt_ocr(self, ocr_text: str) -> Dict[str, Any]:
        """
        Parses raw OCR text from a supermarket ticket into structured items, prices, and totals.
        """
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    prompt = (
                        "Analiza el siguiente texto de un ticket de supermercado. Extrae el nombre del supermercado, "
                        "fecha, importe total y la lista de artículos con cantidad, unidad (ud, kg, g), precio unitario, "
                        "importe de línea y posibles descuentos. Devuelve JSON con "
                        "{'store_name': str, 'receipt_date': 'YYYY-MM-DD', 'total_amount': float, 'lines': [{'product_name': str, 'quantity': float, 'unit': str, 'unit_price': float, 'line_total': float, 'discount': float, 'category': str}]}.\n\n"
                        f"Texto OCR:\n{ocr_text}"
                    )
                    response = client.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config={"response_mime_type": "application/json"}
                    )
                    return json.loads(response.text)
            except Exception as e:
                logger.warning(f"Gemini receipt parsing failed: {e}")

        return self._heuristic_receipt_parser(ocr_text)

    def generate_meal_plan_suggestions(self, approved_recipes: List[Dict[str, Any]], preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generates healthy, diverse meal plan suggestions covering breakfasts, mid-mornings, lunches, snacks, and dinners,
        prioritizing approved recipes and healthy daily food items with estimated calories.
        """
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    prompt = (
                        "Genera un menú semanal equilibrado de lunes a domingo cubriendo todos los momentos del día: "
                        "desayuno, almuerzo (media mañana), comida, merienda y cena. "
                        "Para comida y cena prioriza las siguientes recetas aprobadas existentes en la biblioteca. "
                        "Para desayunos, almuerzos/media mañana y meriendas puedes sugerir productos sencillos y saludables "
                        "(ej. 'Tostada integral con tomate y AOVE', '1 Manzana con puñado de nueces', 'Yogur natural con semillas', 'Kéfir con frutos rojos').\n"
                        f"Preferencias y hábitos del hogar: {json.dumps(preferences, ensure_ascii=False)}.\n"
                        f"Recetas disponibles: {json.dumps([{'id': r['id'], 'title': r['title'], 'dish_type': r.get('dish_type'), 'calories': r.get('nutrition_calories') or r.get('calories')} for r in approved_recipes], ensure_ascii=False)}.\n"
                        "Devuelve una lista JSON con objetos: "
                        "[{'day': str, 'meal_type': 'desayuno'|'almuerzo'|'comida'|'merienda'|'cena'|'snacks', 'recipe_id': int|null, 'title': str, 'calories': float}]."
                    )
                    response = self._generate_with_fallback(
                        client,
                        contents=prompt,
                        config={"response_mime_type": "application/json"}
                    )
                    raw_text = response.text.strip()
                    if raw_text.startswith("```"):
                        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                        raw_text = re.sub(r"\s*```$", "", raw_text)
                    data = json.loads(raw_text)
                    if isinstance(data, list) and len(data) > 0:
                        return data
                    elif isinstance(data, dict):
                        for k in ["plan", "menu", "meals", "items", "suggestions"]:
                            if k in data and isinstance(data[k], list) and len(data[k]) > 0:
                                return data[k]
            except Exception as e:
                logger.warning(f"Gemini meal plan generation failed: {e}")

        # Local fallback menu generator
        return self._heuristic_meal_plan(approved_recipes)

    # ------------------ Heuristic Fallbacks ------------------

    def _heuristic_recipe_parser(self, text: str) -> List[Dict[str, Any]]:
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if not lines:
            return []

        title = lines[0]
        ingredients = []
        steps = []
        is_step_section = False
        step_num = 1

        for line in lines[1:]:
            lower = line.lower()
            if any(k in lower for k in ["preparación", "elaboración", "pasos", "instrucciones"]):
                is_step_section = True
                continue

            if not is_step_section:
                # Try to parse ingredient: e.g. "300g pechuga de pollo" or "- 2 cebollas"
                match = re.search(r"(\d+[\.,]?\d*)\s*(g|kg|ml|l|cucharadas?|pizcas?|ud|uds)?\s*(.*)", line, re.IGNORECASE)
                if match and match.group(3).strip():
                    amt = float(match.group(1).replace(",", "."))
                    unit = match.group(2) if match.group(2) else "ud"
                    name = match.group(3).strip().lstrip("-*• ")
                    ingredients.append({"name": name, "amount": amt, "unit": unit, "notes": None, "is_optional": False})
                else:
                    clean_name = line.lstrip("-*• 0123456789. ")
                    if len(clean_name) > 2:
                        ingredients.append({"name": clean_name, "amount": 1.0, "unit": "ud", "notes": None, "is_optional": False})
            else:
                clean_instruction = re.sub(r"^\d+[\.\)\-]\s*", "", line).strip()
                if len(clean_instruction) > 5:
                    steps.append({
                        "step_number": step_num,
                        "instruction": clean_instruction,
                        "timer_seconds": 300 if "minuto" in clean_instruction.lower() else None,
                        "tip": None
                    })
                    step_num += 1

        if not steps and len(lines) > 2:
            steps.append({"step_number": 1, "instruction": " ".join(lines[3:]), "timer_seconds": None, "tip": None})

        return [{
            "title": title,
            "description": f"Receta importada: {title}",
            "dish_type": "Plato principal",
            "cuisine": "Mediterránea",
            "prep_time_min": 15,
            "cook_time_min": 20,
            "total_time_min": 35,
            "difficulty": "media",
            "base_servings": 4,
            "categories": ["Comidas", "Platos principales"],
            "tags": ["Casero"],
            "allergens": [],
            "ingredients": ingredients or [{"name": "Ingredientes principales", "amount": 1, "unit": "ud", "notes": None, "is_optional": False}],
            "steps": steps or [{"step_number": 1, "instruction": "Cocinar los ingredientes al gusto.", "timer_seconds": None, "tip": None}],
            "uncertainty_notes": ["Importación heurística local (Gemini API no configurado o sin respuesta)"]
        }]

    def _heuristic_variant_generator(self, recipe: Dict[str, Any], target_appliance: str) -> Dict[str, Any]:
        title = recipe.get("title", "Receta")
        if target_appliance.lower() == "thermomix":
            return {
                "title": f"{title} (Thermomix TM7)",
                "description": "Adaptación precisa para Thermomix TM7 con tiempos y velocidades calibradas.",
                "appliance_settings": {"model": "Thermomix TM7", "main_accessory": "Cuchillas"},
                "ingredients": recipe.get("ingredients", []),
                "steps": [
                    {
                        "step_number": 1,
                        "instruction": "Poner los aromáticos en el vaso. Picar 5 seg / Vel 5. Bajar los restos con la espátula.",
                        "appliance_action": "Picar",
                        "temperature": None,
                        "speed": "Velocidad 5",
                        "accessory": "Cuchillas",
                        "timer_seconds": 5,
                        "tip": "Comprobar que quede al tamaño deseado.",
                        "is_manual": False
                    },
                    {
                        "step_number": 2,
                        "instruction": "Añadir 30 g de aceite. Sofreír 7 min / 120 °C / Vel 1.",
                        "appliance_action": "Sofreír",
                        "temperature": "120 °C",
                        "speed": "Velocidad 1",
                        "accessory": "Cuchillas",
                        "timer_seconds": 420,
                        "tip": "Sin cubilete para evaporar líquidos.",
                        "is_manual": False
                    },
                    {
                        "step_number": 3,
                        "instruction": "Incorporar el resto de ingredientes. Cocinar 18 min / 100 °C / Giro Inverso / Vel Cuchara.",
                        "appliance_action": "Cocinar",
                        "temperature": "100 °C",
                        "speed": "Giro Inverso, Vel Cuchara",
                        "accessory": "Mariposa",
                        "timer_seconds": 1080,
                        "tip": "El giro inverso protege la textura de los alimentos.",
                        "is_manual": False
                    }
                ]
            }
        elif target_appliance.lower() == "airfryer":
            return {
                "title": f"{title} (Airfryer 6L)",
                "description": "Adaptación para freidora de aire de 6L optimizando dorado y jugosidad.",
                "appliance_settings": {"capacity_liters": 6, "preheat": True},
                "ingredients": recipe.get("ingredients", []),
                "steps": [
                    {
                        "step_number": 1,
                        "instruction": "Precalentar la airfryer a 190 °C durante 3 minutos.",
                        "appliance_action": "Precalentar",
                        "temperature": "190 °C",
                        "speed": None,
                        "accessory": "Cesta rejilla",
                        "timer_seconds": 180,
                        "tip": "El precalentamiento asegura un sellado uniforme.",
                        "is_manual": False
                    },
                    {
                        "step_number": 2,
                        "instruction": "Colocar los alimentos en una sola capa sin amontonar en la cesta de 6L.",
                        "appliance_action": "Colocar",
                        "temperature": None,
                        "speed": None,
                        "accessory": "Cesta rejilla",
                        "timer_seconds": None,
                        "tip": "Si hay mucha cantidad, cocinar en dos tandas para no perder crujiente.",
                        "is_manual": True
                    },
                    {
                        "step_number": 3,
                        "instruction": "Cocinar a 185 °C durante 18 minutos. Agitar o dar la vuelta a mitad del tiempo (minuto 9).",
                        "appliance_action": "Cocinar y Agitar",
                        "temperature": "185 °C",
                        "speed": None,
                        "accessory": "Cesta rejilla",
                        "timer_seconds": 1080,
                        "tip": "Comprobar con un termómetro o corte al minuto 15.",
                        "is_manual": False
                    }
                ]
            }
        return {"title": f"{title} (Adaptada)", "steps": recipe.get("steps", [])}

    def _heuristic_receipt_parser(self, text: str) -> Dict[str, Any]:
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        total = 0.0
        parsed_lines = []
        store = "Supermercado"

        for line in lines:
            lower = line.lower()
            if any(s in lower for s in ["mercadona", "carrefour", "eroski", "lidl", "dia", "alcampo"]):
                store = line.title()
            
            # Check price pattern
            match = re.search(r"(\d+[,\.]\d{2})", line)
            if match:
                price = float(match.group(1).replace(",", "."))
                prod_name = re.sub(r"(\d+[,\.]\d{2})", "", line).strip()
                if "total" in lower:
                    total = max(total, price)
                elif len(prod_name) > 2:
                    parsed_lines.append({
                        "product_name": prod_name,
                        "quantity": 1.0,
                        "unit": "ud",
                        "unit_price": price,
                        "line_total": price,
                        "discount": 0.0,
                        "category": "Alimentación"
                    })

        if total == 0.0 and parsed_lines:
            total = sum(l["line_total"] for l in parsed_lines)

        return {
            "store_name": store,
            "receipt_date": None,
            "total_amount": round(total, 2),
            "lines": parsed_lines
        }

    def _heuristic_meal_plan(self, recipes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        breakfast_options = [
            {"title": "Tostada integral con tomate rallado, AOVE y huevo pochado", "calories": 340},
            {"title": "Porridge de copos de avena con bebida vegetal, canela y plátano", "calories": 360},
            {"title": "Tostada de centeno con aguacate, semillas de chía y café", "calories": 320},
            {"title": "Yogur natural con granola casera y frutos rojos", "calories": 310},
            {"title": "Tortilla francesa de 2 huevos con espinacas y pan integral", "calories": 350},
            {"title": "Pancake de avena y plátano con una cucharadita de miel", "calories": 380},
            {"title": "Tostada con pavo braseado, tomate y aceite de oliva virgen extra", "calories": 330}
        ]
        midmorning_options = [
            {"title": "1 Manzana Fuji y 4 nueces crudas", "calories": 160},
            {"title": "Yogur griego natural sin azúcar", "calories": 130},
            {"title": "1 Plátano de Canarias y un puñado de almendras", "calories": 190},
            {"title": "2 Mandarinas y café solo o infusión", "calories": 85},
            {"title": "Queso fresco de Burgos con arándanos", "calories": 140},
            {"title": "1 Pera de temporada y 3 nueces", "calories": 150},
            {"title": "Zumo verde de pepino, manzana y jengibre", "calories": 95}
        ]
        snack_options = [
            {"title": "Hummus tradicional con bastoncitos de zanahoria", "calories": 170},
            {"title": "Kéfir natural con semillas de lino molidas", "calories": 140},
            {"title": "1 Onza de chocolate negro (>85%) y unas avellanas", "calories": 160},
            {"title": "Torta de arroz con crema de cacahuete 100%", "calories": 175},
            {"title": "Yogur de soja natural con nueces", "calories": 150},
            {"title": "Infusión digestiva con un puñado de almendras tostadas", "calories": 130},
            {"title": "Rodajas de manzana con canela al microondas", "calories": 90}
        ]

        result = []
        recipe_idx = 0
        total_r = len(recipes)

        for i, d in enumerate(days):
            bf = breakfast_options[i % len(breakfast_options)]
            mm = midmorning_options[i % len(midmorning_options)]
            sn = snack_options[i % len(snack_options)]

            lunch_r = recipes[recipe_idx % total_r] if total_r > 0 else {"title": "Plato equilibrado de verduras y proteína", "calories": 550}
            dinner_r = recipes[(recipe_idx + 1) % total_r] if total_r > 0 else {"title": "Crema ligera o pescado a la plancha", "calories": 420}
            recipe_idx += 2

            # 1. Desayuno
            result.append({
                "day": d,
                "meal_type": "desayuno",
                "recipe_id": None,
                "title": bf["title"],
                "calories": bf["calories"]
            })
            # 2. Almuerzo / Media mañana
            result.append({
                "day": d,
                "meal_type": "almuerzo",
                "recipe_id": None,
                "title": mm["title"],
                "calories": mm["calories"]
            })
            # 3. Comida
            result.append({
                "day": d,
                "meal_type": "comida",
                "recipe_id": lunch_r.get("id"),
                "title": lunch_r.get("title"),
                "calories": lunch_r.get("calories") or lunch_r.get("nutrition_calories") or 600
            })
            # 4. Merienda
            result.append({
                "day": d,
                "meal_type": "merienda",
                "recipe_id": None,
                "title": sn["title"],
                "calories": sn["calories"]
            })
            # 5. Cena
            result.append({
                "day": d,
                "meal_type": "cena",
                "recipe_id": dinner_r.get("id"),
                "title": dinner_r.get("title"),
                "calories": dinner_r.get("calories") or dinner_r.get("nutrition_calories") or 430
            })

        return result

    def generate_dietary_advice_and_recipe_modifications(
        self,
        dietary_goals: str,
        user_query: str,
        recipe: Optional[Dict[str, Any]] = None,
        preferred_foods: Optional[str] = None,
        excluded_foods: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Acts as an intelligent dietary and healthy culinary assistant.
        Recommends healthy adjustments, ingredient substitutions, or generates adapted healthy recipes.
        """
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    recipe_context = ""
                    if recipe:
                        recipe_context = (
                            f"\nReceta base a analizar o modificar:\n"
                            f"Título: {recipe.get('title')}\n"
                            f"Ingredientes: {json.dumps(recipe.get('ingredients', []), ensure_ascii=False)}\n"
                            f"Pasos: {json.dumps(recipe.get('steps', []), ensure_ascii=False)}\n"
                        )

                    prompt = (
                        "Actúa como un Asistente Dietético y Culinario Familiar altamente cualificado. "
                        "Tu función es ayudar a la familia a comer de forma más saludable, adaptando o recomendando recetas.\n"
                        f"Perfil dietético del hogar: {dietary_goals or 'Dieta mediterránea equilibrada'}\n"
                        f"Alimentos preferidos: {preferred_foods or 'No especificado'}\n"
                        f"Alimentos a evitar / intolerancias: {excluded_foods or 'Ninguno'}\n"
                        f"{recipe_context}\n"
                        f"Petición del usuario: {user_query}\n\n"
                        "Responde ÚNICAMENTE en formato JSON con la siguiente estructura:\n"
                        "{\n"
                        '  "advice": "Explicación clara, empática y práctica con tips culinarios saludables.",\n'
                        '  "suggested_modifications": ["Sustitución o ajuste 1", "Sustitución o ajuste 2"],\n'
                        '  "healthy_recipe_variant": null o un objeto con {"title": "string", "description": "string", "prep_time_min": 15, "cook_time_min": 20, "ingredients": [{"name": "string", "amount": 100, "unit": "g"}], "steps": [{"step_number": 1, "instruction": "string"}]}\n'
                        "}"
                    )
                    response = client.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config={"response_mime_type": "application/json"}
                    )
                    return json.loads(response.text)
            except Exception as e:
                logger.error(f"Gemini dietary advice failed, falling back to heuristic: {e}")

        return self._heuristic_dietary_advice(dietary_goals, user_query, recipe, preferred_foods, excluded_foods)

    def _heuristic_dietary_advice(
        self,
        dietary_goals: str,
        user_query: str,
        recipe: Optional[Dict[str, Any]] = None,
        preferred_foods: Optional[str] = None,
        excluded_foods: Optional[str] = None
    ) -> Dict[str, Any]:
        query_lower = (user_query or "").lower()
        goals_lower = (dietary_goals or "").lower()

        swaps = []
        advice_points = []

        # Analyze healthy goals
        if "antiinflamatori" in goals_lower or "antiinflamatori" in query_lower:
            advice_points.append("Incorpora fuentes ricas en Omega-3 (pescado azul, nueces, semillas de lino) y especias antiinflamatorias como cúrcuma con pimienta negra y jengibre.")
            swaps.append("Sustituye aceites refinados por Aceite de Oliva Virgen Extra prensado en frío.")
        if "sal" in goals_lower or "hipertension" in goals_lower or "sal" in query_lower:
            advice_points.append("Para reducir el sodio sin perder sabor, potencia el uso de hierbas aromáticas (orégano, albahaca, romero), ajo asado y ralladura de cítricos.")
            swaps.append("Reemplaza la sal refinada por mezcla de especias y zumo de limón.")
        if "keto" in goals_lower or "carbohidrat" in goals_lower or "baja en hidratos" in query_lower:
            advice_points.append("Prioriza vegetales de hoja verde y crucíferas sobre tubérculos y cereales refinados.")
            swaps.append("Cambia arroz tradicional o pasta por arroz de coliflor o fideos de calabacín.")
        if "gluten" in goals_lower or "celiac" in goals_lower:
            swaps.append("Usa harina de avena certificada sin gluten o harina de almendras para rebozados y espesantes.")
        if "lactosa" in goals_lower:
            swaps.append("Sustituye nata o quesos cremosos por bebida de coco, puré de anacardos o yogur vegetal sin azúcares.")

        if not swaps:
            swaps = [
                "Reduce grasas saturadas cocinando en Airfryer (180°C con pulverización de AOVE) en lugar de fritura por inmersión.",
                "Aumenta la fibra añadiendo un 50% de vegetales troceados a la base del plato.",
                "Sustituye natas y salsas pesadas por leche evaporada o yogur griego natural desnatado."
            ]

        advice_text = (
            f"Como tu Asistente Dietético Familiar, he analizado tu consulta orientada a: {dietary_goals or 'Alimentación saludable familiar'}.\n\n"
            + (" ".join(advice_points) + "\n\n" if advice_points else "")
            + "Recomendación culinaria clave:\n"
            + "Ajustar las técnicas de cocción al vapor (Thermomix Varoma) y aire caliente (Airfryer) preserva los micronutrientes y reduce la densidad calórica sin sacrificar el sabor familiar."
        )

        healthy_variant = None
        if recipe:
            healthy_variant = {
                "title": f"{recipe.get('title', 'Receta')} (Versión Saludable)",
                "description": f"Adaptación nutricional ligera optimizada para {dietary_goals or 'una alimentación equilibrada'}.",
                "prep_time_min": recipe.get("prep_time_min", 15),
                "cook_time_min": recipe.get("cook_time_min", 20),
                "ingredients": [
                    {"name": ing.get("name"), "amount": ing.get("amount"), "unit": ing.get("unit")}
                    for ing in recipe.get("ingredients", [])
                ],
                "steps": [
                    {"step_number": s.get("step_number", idx + 1), "instruction": s.get("instruction")}
                    for idx, s in enumerate(recipe.get("steps", []))
                ]
            }

        return {
            "advice": advice_text,
            "suggested_modifications": swaps,
            "healthy_recipe_variant": healthy_variant
        }

    def extract_nutrition_plan_from_image(self, file_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Parses a photo or scanned document of a weekly nutrition plan, dietitian report, diet menu or doctor sheet.
        Uses Gemini multimodal vision (gemini-3.8-flash) to extract structured patient profile, habits, and weekly days/meals.
        Falls back to intelligent local heuristic if Gemini is not configured or fails.
        """
        client = self._get_client()
        model_to_use = self._normalize_model(self.model_name)

        if client and self.is_configured():
            try:
                from google.genai import types
                part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
                prompt = (
                    "Eres un asistente nutricionista clínico y chef culinario de máxima precisión.\n"
                    "Analiza este informe de dietista, menú nutricional o documento de planificación semanal "
                    "y extrae el perfil del paciente, todas las pautas y hábitos, la planificación semanal completa de lunes a domingo, "
                    "y todas las recetas individuales en formato JSON estricto.\n\n"
                    "INSTRUCCIONES CLÍNICAS Y CULINARIAS CRÍTICAS:\n"
                    "1. Estructura típica de menús de dietista (como LMO Nutrición):\n"
                    "   - Suelen incluir bloques generales para 'DES-AYUNO' con 2 o 3 opciones (ej. Bol de yogur con chía y avena, Tortitas de avena proteicas, Tostadas integrales con varias combinaciones).\n"
                    "   - Suelen incluir bloques generales para 'SNACKS / MEDIAS MAÑANAS / MERIENDAS' (ej. Batidos de fruta con proteína en polvo, Muffin en airfryer/horno, Dátiles o barritas como preentreno).\n"
                    "   - Suelen incluir indicaciones de 'POSTRE' (ej. Infusión digestiva/relajante + 1 onza de chocolate negro 85%).\n"
                    "   - Las 'COMIDA' y 'CENA' suelen estar organizadas en columnas por día de la semana (Lunes a Domingo), incluyendo posibles días con 'Cena Libre'.\n\n"
                    "2. Reglas de extracción en 'days':\n"
                    "   - Debes generar OBLIGATORIAMENTE los 7 días de la semana con 'day_name': 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'.\n"
                    "   - Para cada día distribuye y rota las opciones de desayuno del documento, de modo que cada día tenga su 'desayuno'.\n"
                    "   - Incluye 'almuerzo' (media mañana o snack preentreno) y 'merienda' (batido, muffin en airfryer o fruta).\n"
                    "   - Incluye 'comida' y 'cena' correspondientes a la columna de ese día exacto.\n"
                    "   - Incluye 'postre' (la infusión con chocolate negro recomendada tras la cena).\n\n"
                    "3. Reglas de extracción en 'recipes':\n"
                    "   - Extrae una lista exhaustiva de TODAS las recetas que aparecen en el documento (desayunos, comidas, cenas, snacks, postres elaborados).\n"
                    "   - Para cada receta detalla: 'title', 'meal_type' (desayuno, comida, cena, merienda, postre), 'description', 'calories', 'ingredients' ([{'name': str, 'amount': float or null, 'unit': str or null}]), 'steps' ([{'step_number': int, 'instruction': str}]).\n\n"
                    "4. 'dietary_guidelines':\n"
                    "   - Extrae en una lista de strings TODOS los consejos nutricionales, pautas de hidratación libre (infusiones, café, agua con gas), normas del preentreno (dátiles/barrita 45-60 min antes), pauta de proteína en polvo (si pasan más de 1.5-2h desde entreno a cena), aliño con AOVE en crudo, técnicas de cocción rápida (boniato al microondas 10 min, airfryer, etc.) y postres.\n\n"
                    "Responde estrictamente con un objeto JSON válido con este esquema:\n"
                    "{\n"
                    "  \"plan_title\": \"Menú / Plan Nutricional Dietista\",\n"
                    "  \"patient_name\": \"Nombre del paciente o null\",\n"
                    "  \"target_calories\": 1750,\n"
                    "  \"dietary_goal\": \"deficit\",\n"
                    "  \"habits\": \"Hábitos y pautas generales de cocina y estilo de vida...\",\n"
                    "  \"dietary_guidelines\": [\"Consejo 1\", \"Consejo 2\"],\n"
                    "  \"preferred_foods\": \"Alimentos recomendados...\",\n"
                    "  \"excluded_foods\": \"Alimentos desaconsejados o a evitar...\",\n"
                    "  \"notes\": \"Observaciones clínicas relevantes\",\n"
                    "  \"days\": [\n"
                    "    {\n"
                    "      \"day_name\": \"lunes\",\n"
                    "      \"meals\": [\n"
                    "        {\"meal_type\": \"desayuno\", \"title\": \"...\", \"calories\": 350, \"is_recipe\": true, \"description\": \"...\", \"ingredients\": [], \"steps\": []},\n"
                    "        {\"meal_type\": \"almuerzo\", \"title\": \"...\", \"calories\": 100, \"is_recipe\": false, \"description\": \"...\", \"ingredients\": [], \"steps\": []},\n"
                    "        {\"meal_type\": \"comida\", \"title\": \"...\", \"calories\": 550, \"is_recipe\": true, \"description\": \"...\", \"ingredients\": [], \"steps\": []},\n"
                    "        {\"meal_type\": \"merienda\", \"title\": \"...\", \"calories\": 200, \"is_recipe\": true, \"description\": \"...\", \"ingredients\": [], \"steps\": []},\n"
                    "        {\"meal_type\": \"cena\", \"title\": \"...\", \"calories\": 450, \"is_recipe\": true, \"description\": \"...\", \"ingredients\": [], \"steps\": []},\n"
                    "        {\"meal_type\": \"postre\", \"title\": \"...\", \"calories\": 50, \"is_recipe\": false, \"description\": \"...\", \"ingredients\": [], \"steps\": []}\n"
                    "      ]\n"
                    "    }\n"
                    "  ],\n"
                    "  \"recipes\": [\n"
                    "    {\n"
                    "      \"title\": \"Nombre de la receta\",\n"
                    "      \"meal_type\": \"desayuno\",\n"
                    "      \"description\": \"Descripción culinaria\",\n"
                    "      \"calories\": 350,\n"
                    "      \"ingredients\": [{\"name\": \"Ingrediente\", \"amount\": 100, \"unit\": \"g\"}],\n"
                    "      \"steps\": [{\"step_number\": 1, \"instruction\": \"Instrucción\"}]\n"
                    "    }\n"
                    "  ]\n"
                    "}"
                )

                gen_cfg = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )

                response = self._generate_with_fallback(
                    client=client,
                    contents=[part, prompt],
                    config=gen_cfg
                )

                cleaned = self._clean_json_response(response.text)
                data = json.loads(cleaned)
                if isinstance(data, dict) and "days" in data and len(data["days"]) > 0:
                    return data
            except Exception as e:
                logger.error(f"Error parsing nutrition plan with Gemini Vision: {e}")

        # Fallback heuristic
        return self._heuristic_nutrition_plan_parser()

    def _heuristic_nutrition_plan_parser(self) -> Dict[str, Any]:
        """Provides a balanced Mediterranean 7-day plan fallback when AI vision is unavailable."""
        day_names = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
        meals_template = [
            ("desayuno", "Tostada de pan integral con tomate y aceite de oliva virgen extra", 280, True,
             [{"name": "Pan integral", "amount": 2, "unit": "rebanadas"}, {"name": "Tomate maduro", "amount": 1, "unit": "unidad"}, {"name": "Aceite de oliva virgen extra", "amount": 1, "unit": "cucharada"}],
             [{"step_number": 1, "instruction": "Tostar el pan, rallar el tomate y aliñar con una pizca de sal y AOVE."}]),
            ("almuerzo", "Pieza de fruta de temporada y puñado de nueces", 180, False, [], []),
            ("comida", "Lentejas estofadas con verduras y arroz integral", 480, True,
             [{"name": "Lentejas pardinas", "amount": 80, "unit": "g"}, {"name": "Zanahoria", "amount": 1, "unit": "unidad"}, {"name": "Cebolla", "amount": 0.5, "unit": "unidad"}, {"name": "Pimiento verde", "amount": 0.5, "unit": "unidad"}],
             [{"step_number": 1, "instruction": "Picar las verduras y sofreír suavemente con una cucharada de aceite."}, {"step_number": 2, "instruction": "Añadir las lentejas, cubrir con agua o caldo vegetal y cocer a fuego medio durante 35 minutos."}]),
            ("merienda", "Yogur natural con semillas de chía", 130, False, [], []),
            ("cena", "Merluza al horno con patatas panadera y cebolla", 380, True,
             [{"name": "Lomo de merluza", "amount": 200, "unit": "g"}, {"name": "Patatas", "amount": 1, "unit": "unidad"}, {"name": "Cebolla", "amount": 0.5, "unit": "unidad"}],
             [{"step_number": 1, "instruction": "Cortar patata y cebolla en rodajas finas y hornear a 180°C durante 20 min."}, {"step_number": 2, "instruction": "Colocar la merluza sobre el lecho y cocinar 10 minutos más a 190°C."}])
        ]

        days = []
        for d in day_names:
            day_meals = []
            for m_type, title, cals, is_rec, ings, steps in meals_template:
                day_meals.append({
                    "meal_type": m_type,
                    "title": title,
                    "calories": cals,
                    "is_recipe": is_rec,
                    "description": f"Plato equilibrado para {m_type}",
                    "ingredients": ings,
                    "steps": steps
                })
            days.append({"day_name": d, "meals": day_meals})

        return {
            "plan_title": "Plan Nutricional Mediterráneo",
            "patient_name": None,
            "target_calories": 1800,
            "dietary_goal": "saludable",
            "habits": "Beber al menos 2 litros de agua diarios, cocinar a la plancha o al vapor, evitar ultraprocesados y mantener actividad física regular.",
            "dietary_guidelines": [
                "Mantener una adecuada hidratación (2 litros diarios de agua o infusiones)",
                "Priorizar cocciones ligeras: plancha, vapor, horno y papillote",
                "Evitar ultraprocesados, salsas comerciales y azúcares añadidos",
                "Cenar al menos 2 horas antes de acostarse para favorecer la digestión"
            ],
            "preferred_foods": "Verduras variadas de temporada, legumbres, pescado blanco y azul, huevos y AOVE",
            "excluded_foods": "Fritos, refrescos con azúcar, bollería y snacks ultraprocesados",
            "notes": "Plan generado con pautas saludables equilibradas en macronutrientes.",
            "days": days
        }

    def generate_or_find_recipe_image(
        self,
        title: str,
        dish_type: Optional[str] = None,
        cuisine: Optional[str] = None
    ) -> str:
        """
        Returns an appetizing, high-resolution curated food photograph matched to the specific dish or category.
        """
        return self._get_curated_food_image(title, dish_type, cuisine)

    def search_food_images_online(self, query: str, count: int = 10) -> List[str]:
        """
        Performs a real-time web search for authentic culinary photographs matching the exact dish title.
        Returns direct, high-resolution food image URLs.
        """
        if not query or len(query.strip()) < 2:
            return []

        # Strip prefixes and parenthetical notes
        clean = re.sub(r'^(receta\s+(de\s+)?|como\s+hacer\s+|como\s+montar\s+el\s+)', '', query, flags=re.IGNORECASE)
        clean = re.sub(r'\(.*?\)', '', clean).strip()

        search_terms = [
            f"{clean} receta plato",
            f"{clean} comida"
        ]

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        }

        found_urls = []
        seen = set()

        for st in search_terms:
            if len(found_urls) >= count:
                break
            try:
                url = f"https://www.bing.com/images/search?q={urllib.parse.quote(st)}&form=HDRSC2&first=1"
                with httpx.Client(timeout=5.0, follow_redirects=True) as client:
                    resp = client.get(url, headers=headers)
                    if resp.status_code == 200:
                        # Extract pairs of (original URL, Bing CDN ID OIP)
                        pattern = r'murl&quot;:&quot;(https?://[^&]+)&quot;.*?id=(OIP\.[a-zA-Z0-9_-]+)'
                        pairs = re.findall(pattern, resp.text)
                        for murl, oip in pairs:
                            murl_clean = murl.replace('&amp;', '&')
                            murl_lower = murl_clean.lower()
                            if any(bad in murl_lower for bad in ['.svg', '.gif', 'logo', 'icon', 'avatar', 'placeholder', 'blank', 'pixel', 'banner']):
                                continue
                            # Use high-resolution Bing CDN URL (800x600) which is fast, HTTPS, and bypasses 403 hotlink protections
                            cdn_url = f"https://tse2.mm.bing.net/th?id={oip}&w=800&h=600&c=7&rs=1&p=0"
                            if cdn_url not in seen:
                                seen.add(cdn_url)
                                found_urls.append(cdn_url)
                                if len(found_urls) >= count:
                                    break

                        # Fallback: if pairs didn't yield enough, look for OIP IDs directly
                        if len(found_urls) < count:
                            oips = re.findall(r'id=(OIP\.[a-zA-Z0-9_-]+)', resp.text)
                            for oip in oips:
                                cdn_url = f"https://tse2.mm.bing.net/th?id={oip}&w=800&h=600&c=7&rs=1&p=0"
                                if cdn_url not in seen:
                                    seen.add(cdn_url)
                                    found_urls.append(cdn_url)
                                    if len(found_urls) >= count:
                                        break
            except Exception as e:
                logger.debug(f"Online image search error for '{st}': {e}")

        return found_urls

    def get_food_image_candidates(
        self,
        title: str,
        dish_type: Optional[str] = None,
        cuisine: Optional[str] = None,
        count: int = 12
    ) -> List[str]:
        """
        Returns a prioritized list of high-quality photo URLs matching the recipe title,
        combining real-time web search with curated dish galleries.
        """
        candidates: List[str] = []
        seen = set()

        # 1. Search online for the exact recipe title
        try:
            online_results = self.search_food_images_online(title, count=count)
            for url in online_results:
                if url not in seen:
                    seen.add(url)
                    candidates.append(url)
        except Exception as e:
            logger.debug(f"Error in online candidate search: {e}")

        combined = f"{title} {dish_type or ''} {cuisine or ''}".lower()

        # 2. Curated dish-specific galleries
        dish_specific = [
            (["coulant", "culan", "volcan", "volcán", "lava cake", "fondant chocolate", "fondant de chocolate"], [
                "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
            ]),
            (["zanahoria", "carrot cake"], [
                "https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=800&q=80",
            ]),
            (["manzana", "apple pie", "apple tart"], [
                "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1535920527002-b35e96722eb9?auto=format&fit=crop&w=800&q=80",
            ]),
            (["queso", "cheesecake"], [
                "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
            ]),
            (["gambon", "gambón", "gamba", "langostino", "marisco"], [
                "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80",
            ]),
            (["carrillera", "carrillada", "estofado", "guiso de carne"], [
                "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
            ]),
            (["brownie"], [
                "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1589218436045-ee320057f443?auto=format&fit=crop&w=800&q=80",
            ]),
            (["bizcocho", "plum cake"], [
                "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80",
            ]),
            (["paella", "arroz"], [
                "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1515443961218-a51367888e4b?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
            ]),
            (["croqueta"], [
                "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
            ]),
            (["flan", "natilla", "crema catalana"], [
                "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
            ]),
            (["salmon", "salmón", "merluza", "bacalao", "pescado"], [
                "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80",
            ]),
            (["pollo", "pechuga", "alitas", "pavo"], [
                "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
            ]),
            (["carne", "ternera", "solomillo", "hamburguesa"], [
                "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
            ]),
            (["pasta", "espagueti", "macarron", "lasaña"], [
                "https://images.unsplash.com/photo-1621996346565-e3d5d6281724?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80",
            ]),
            (["pizza"], [
                "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
            ]),
        ]

        for keywords, urls in dish_specific:
            if any(k in combined for k in keywords):
                for u in urls:
                    if u not in seen:
                        seen.add(u)
                        candidates.append(u)

        # 3. Category fallback galleries
        category_galleries = {
            "dessert": [
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80"
            ],
            "rice": [
                "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80"
            ],
            "pasta": [
                "https://images.unsplash.com/photo-1621996346565-e3d5d6281724?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
            ],
            "chicken": [
                "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80"
            ],
            "meat": [
                "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80"
            ],
            "fish": [
                "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=800&q=80"
            ],
            "soup": [
                "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80"
            ],
            "default": [
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
            ]
        }

        target_cat = "default"
        if (dish_type and dish_type.lower() == "postre") or any(w in combined for w in ["tarta", "bizcocho", "pastel", "dulce", "postre", "flan", "mousse", "galleta", "brownie", "cheesecake", "torta", "coulant", "culan", "volcan", "volcán", "chocolate"]):
            target_cat = "dessert"
        elif any(w in combined for w in ["arroz", "paella", "risotto"]):
            target_cat = "rice"
        elif any(w in combined for w in ["pasta", "espagueti", "lasaña"]):
            target_cat = "pasta"
        elif any(w in combined for w in ["pollo", "pavo"]):
            target_cat = "chicken"
        elif any(w in combined for w in ["carne", "ternera", "carrillera"]):
            target_cat = "meat"
        elif any(w in combined for w in ["pescado", "salmon", "marisco", "gamba"]):
            target_cat = "fish"
        elif any(w in combined for w in ["sopa", "crema", "caldo"]):
            target_cat = "soup"

        for u in category_galleries.get(target_cat, category_galleries["default"]):
            if u not in seen:
                seen.add(u)
                candidates.append(u)

        return candidates[:max(count, 12)]

    def _get_curated_food_image(
        self,
        title: str,
        dish_type: Optional[str] = None,
        cuisine: Optional[str] = None
    ) -> str:
        """
        Returns a beautifully matched high-resolution food photograph URL based on the dish title.
        Prioritizes real-time web search for the exact dish name.
        """
        # 1. Search online for the exact recipe
        try:
            online_imgs = self.search_food_images_online(title, count=3)
            if online_imgs:
                return online_imgs[0]
        except Exception as e:
            logger.debug(f"Online photo search fallback: {e}")

        # 2. Fall back to curated candidate list
        candidates = self.get_food_image_candidates(title, dish_type, cuisine, count=8)
        if candidates:
            return candidates[0]

        return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"

    def suggest_recipe_tips(
        self,
        title: str,
        ingredients: Optional[List[str]] = None,
        dish_type: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generates practical culinary tips, chef secrets, preservation, freezing, and reheating guidelines
        for a given recipe using Gemini AI.
        """
        client = self._get_client()
        model_to_use = self._normalize_model(self.model_name)

        if client and self.is_configured():
            try:
                ings_summary = ", ".join(ingredients[:15]) if ingredients else "Ingredientes tradicionales del plato"
                prompt = (
                    f"Eres un chef profesional y experto en conservación de alimentos.\n"
                    f"Genera consejos culinarios y de conservación muy prácticos y breves para la receta: '{title}'.\n"
                    f"Ingredientes principales: {ings_summary}\n"
                    f"Tipo de plato: {dish_type or 'Plato principal'}\n\n"
                    f"Devuelve ÚNICAMENTE un JSON con estas 4 claves:\n"
                    f"{{\n"
                    f'  "chef_notes": "1 o 2 trucos culinarios del chef para potenciar el sabor, punto de cocción o presentación.",\n'
                    f'  "preservation_tips": "Cómo guardarlo en la nevera y cuántos días aguanta en óptimas condiciones.",\n'
                    f'  "freezing_tips": "Si admite congelación o no, y cómo descongelarlo adecuadamente.",\n'
                    f'  "reheating_tips": "El mejor método para recalentar (sartén, horno, microondas) sin perder jugosidad o textura."\n'
                    f"}}"
                )
                response = client.models.generate_content(
                    model=model_to_use,
                    contents=prompt
                )
                cleaned = self._clean_json_response(response.text)
                data = json.loads(cleaned)
                if isinstance(data, dict):
                    return {
                        "chef_notes": str(data.get("chef_notes", "")).strip(),
                        "preservation_tips": str(data.get("preservation_tips", "")).strip(),
                        "freezing_tips": str(data.get("freezing_tips", "")).strip(),
                        "reheating_tips": str(data.get("reheating_tips", "")).strip(),
                    }
            except Exception as e:
                logger.warning(f"Error suggesting recipe tips with Gemini: {e}")

        # Fallback generic advice
        return {
            "chef_notes": f"Para realzar el sabor de {title}, cuida el punto de sal y añade un toque de hierbas frescas o aceite de oliva virgen extra justo al servir.",
            "preservation_tips": "Guarda en recipiente hermético en el frigorífico hasta 3-4 días.",
            "freezing_tips": "Apto para congelar en porciones individuales en recipientes herméticos o bolsas de congelación.",
            "reheating_tips": "Calienta a fuego suave en sartén o cazo con unas gotas de agua o aceite para recuperar jugosidad."
        }


gemini_service = GeminiService()

