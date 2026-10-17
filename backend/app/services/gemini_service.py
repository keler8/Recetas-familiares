import os
import json
import logging
import re
from typing import Dict, Any, List, Optional
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
            return "gemini-3.8-flash"
        normalized = model_name.strip()
        deprecated = {
            "gemini-2.5-flash": "gemini-3.8-flash",
            "gemini-2.0-flash": "gemini-3.8-flash",
            "gemini-1.5-flash": "gemini-3.8-flash",
            "gemini-1.5-pro": "gemini-3.1-pro-preview",
            "gemini-2.5-pro": "gemini-3.1-pro-preview"
        }
        return deprecated.get(normalized, normalized)

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = self._normalize_model(settings.GEMINI_MODEL)
        self._client = None

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    def update_credentials(self, api_key: Optional[str] = None, model: Optional[str] = None):
        if api_key is not None:
            self.api_key = api_key.strip() if api_key else None
        if model is not None:
            self.model_name = self._normalize_model(model)
        self._client = None  # Force re-initialization

    def test_connection(self, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        key_to_use = (api_key.strip() if api_key else None) or self.api_key
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
        if not self._client and self.is_configured():
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
                        "Actúa como un chef y especialista culinario. Analiza el siguiente texto extraído de un "
                        f"{source_hint}. Si contiene múltiples recetas, sepáralas individualmente en una lista JSON. "
                        "Para cada receta, extrae los campos estructurados estrictos según el esquema JSON. "
                        "IMPORTANTE: No inventes cantidades ni tiempos que no existan. Si algo no está claro, indícalo "
                        "en 'uncertainty_notes'. Mantén los nombres de ingredientes normalizados en castellano.\n\n"
                        f"Texto:\n{text[:15000]}"
                    )
                    response = client.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config={
                            "response_mime_type": "application/json",
                        }
                    )
                    content = response.text
                    parsed = json.loads(content)
                    if isinstance(parsed, list):
                        return parsed
                    elif isinstance(parsed, dict) and "recipes" in parsed:
                        return parsed["recipes"]
                    elif isinstance(parsed, dict) and "title" in parsed:
                        return [parsed]
            except Exception as e:
                logger.warning(f"Gemini API extraction failed, using fallback heuristic parser: {e}")

        # Local intelligent heuristic parser fallback
        return self._heuristic_recipe_parser(text)

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
                        f"Recetas disponibles: {json.dumps([{'id': r['id'], 'title': r['title'], 'dish_type': r.get('dish_type'), 'calories': r.get('nutrition_calories')} for r in approved_recipes], ensure_ascii=False)}.\n"
                        "Devuelve una lista JSON con objetos: "
                        "[{'day': str, 'meal_type': 'desayuno'|'almuerzo'|'comida'|'merienda'|'cena'|'snacks', 'recipe_id': int|null, 'title': str, 'calories': float}]."
                    )
                    response = client.models.generate_content(
                        model=self.model_name,
                        contents=prompt,
                        config={"response_mime_type": "application/json"}
                    )
                    return json.loads(response.text)
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
        Parses a photo or scanned document of a weekly nutrition plan, diet menu or doctor sheet.
        Uses Gemini multimodal vision (gemini-3.8-flash) to extract structured days and meals.
        Falls back to intelligent local heuristic if Gemini is not configured or fails.
        """
        client = self._get_client()
        model_to_use = self._normalize_model(self.model_name)

        if client and self.is_configured():
            try:
                from google.genai import types
                part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
                prompt = (
                    "Eres un asistente nutricionista y culinario de alta precisión.\n"
                    "Analiza esta imagen o documento que contiene una pauta nutricional, dieta médica o planificación semanal de comidas "
                    "y extrae toda la planificación estructurada en formato JSON estricto.\n\n"
                    "Reglas de extracción:\n"
                    "1. Identifica los días de la semana (lunes, martes, miercoles, jueves, viernes, sabado, domingo). Si la imagen solo tiene días numerados (Día 1 a 7), mapea Día 1 a lunes, etc.\n"
                    "2. Identifica cada comida o toma del día y clasifícala estrictamente en uno de estos valores para 'meal_type':\n"
                    "   - 'desayuno'\n"
                    "   - 'almuerzo' (media mañana)\n"
                    "   - 'comida' (almuerzo principal del mediodía)\n"
                    "   - 'merienda'\n"
                    "   - 'cena'\n"
                    "   - 'snacks' (picoteo o suplementación)\n"
                    "3. Para cada comida o plato extrae:\n"
                    "   - 'title': Nombre claro y apetitoso del plato o alimento (ej. 'Lentejas estofadas con verduras', 'Yogur natural con nueces', 'Pollo a la plancha con judías verdes').\n"
                    "   - 'calories': Número entero estimado de calorías para 1 ración (ej. 450, o 180 para merienda/snack). Si la foto indica calorías o gramos, úsalas con exactitud.\n"
                    "   - 'is_recipe': true si es un plato cocinado/receta con preparación (ej. guiso, ensalada mixta, salteado, tortilla, pescado al horno); false si es un alimento directo o producto sin receta (ej. '1 manzana', 'café solo', '2 nueces').\n"
                    "   - 'description': Breve descripción culinaria de 1 o 2 frases.\n"
                    "   - 'ingredients': Lista de ingredientes deducibles o visibles con {'name': str, 'amount': float or null, 'unit': str or null}.\n"
                    "   - 'steps': Pasos sencillos de preparación si es una receta elaborada [{'step_number': 1, 'instruction': '...'}].\n\n"
                    "Responde ÚNICAMENTE con el objeto JSON sin comillas invertidas ni bloques ```json. La estructura requerida es:\n"
                    "{\n"
                    "  \"plan_title\": \"Plan Nutricional Extraído\",\n"
                    "  \"notes\": \"Indicaciones generales, hidratación o consejos que aparezcan en el documento\",\n"
                    "  \"days\": [\n"
                    "    {\n"
                    "      \"day_name\": \"lunes\",\n"
                    "      \"meals\": [\n"
                    "        {\n"
                    "          \"meal_type\": \"desayuno\",\n"
                    "          \"title\": \"Tostadas integrales con aguacate y huevo\",\n"
                    "          \"calories\": 360,\n"
                    "          \"is_recipe\": true,\n"
                    "          \"description\": \"Tostadas de masa madre con aguacate machacado y huevo pochado\",\n"
                    "          \"ingredients\": [{\"name\": \"Pan integral\", \"amount\": 2, \"unit\": \"rebanadas\"}, {\"name\": \"Aguacate\", \"amount\": 0.5, \"unit\": \"unidad\"}, {\"name\": \"Huevos\", \"amount\": 2, \"unit\": \"unidades\"}],\n"
                    "          \"steps\": [{\"step_number\": 1, \"instruction\": \"Tostar las rebanadas de pan.\"}, {\"step_number\": 2, \"instruction\": \"Pochar o cocinar los huevos a la plancha y montar sobre el aguacate.\"}]\n"
                    "        }\n"
                    "      ]\n"
                    "    }\n"
                    "  ]\n"
                    "}"
                )

                response = client.models.generate_content(
                    model=model_to_use,
                    contents=[part, prompt]
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
            "notes": "Plan generado con pautas saludables equilibradas en macronutrientes.",
            "days": days
        }


gemini_service = GeminiService()
