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
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self._client = None

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

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
        Generates healthy, diverse meal plan suggestions prioritizing approved recipes.
        """
        if self.is_configured():
            try:
                client = self._get_client()
                if client:
                    prompt = (
                        "Genera un menú semanal equilibrado de lunes a domingo (comida y cena). "
                        "Prioriza las siguientes recetas aprobadas existentes en la biblioteca. "
                        f"Preferencias del hogar: {json.dumps(preferences, ensure_ascii=False)}.\n"
                        f"Recetas disponibles: {json.dumps([{'id': r['id'], 'title': r['title'], 'dish_type': r.get('dish_type')} for r in approved_recipes], ensure_ascii=False)}.\n"
                        "Devuelve una lista JSON con días, momentos (comida, cena), recipe_id o título sugerido."
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
        result = []
        recipe_idx = 0
        total_r = len(recipes)

        for d in days:
            lunch_r = recipes[recipe_idx % total_r] if total_r > 0 else {"title": "Plato equilibrado de verduras y proteína"}
            dinner_r = recipes[(recipe_idx + 1) % total_r] if total_r > 0 else {"title": "Crema ligera o pescado a la plancha"}
            recipe_idx += 2

            result.append({
                "day": d,
                "meal_type": "comida",
                "recipe_id": lunch_r.get("id"),
                "title": lunch_r.get("title")
            })
            result.append({
                "day": d,
                "meal_type": "cena",
                "recipe_id": dinner_r.get("id"),
                "title": dinner_r.get("title")
            })
        return result


gemini_service = GeminiService()
