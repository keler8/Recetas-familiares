import pytest
from app.services.gemini_service import gemini_service


def test_heuristic_recipe_extraction():
    sample_text = """
    TORTILLA DE PATATAS
    Ingredientes:
    - 500g patatas
    - 5 huevos
    - 1 cebolla
    - Aceite de oliva
    - Sal al gusto
    
    Preparación:
    1. Pelar y cortar las patatas y la cebolla en láminas finas.
    2. Pochar en abundante aceite de oliva a fuego medio durante 15 minutos.
    3. Batir los huevos en un bol con una pizca de sal.
    4. Escurrir las patatas, mezclar con el huevo y cuajar en sartén vuelta y vuelta.
    """
    recipes = gemini_service.extract_recipes_from_text(sample_text)
    assert len(recipes) >= 1
    r = recipes[0]
    assert "TORTILLA" in r["title"].upper()
    assert len(r["ingredients"]) >= 3
    assert len(r["steps"]) >= 3


def test_appliance_variant_generator():
    base_recipe = {
        "title": "Pollo al curry",
        "ingredients": [{"name": "Pechuga de pollo", "amount": 300, "unit": "g"}],
        "steps": [{"step_number": 1, "instruction": "Sofreír y cocinar."}]
    }
    tm_variant = gemini_service.generate_appliance_variant(base_recipe, "thermomix")
    assert "TM7" in tm_variant["title"] or "Thermomix" in tm_variant["title"]
    assert len(tm_variant["steps"]) >= 2
    assert tm_variant["steps"][0].get("accessory") is not None or "vaso" in tm_variant["steps"][0]["instruction"].lower()

    airfryer_variant = gemini_service.generate_appliance_variant(base_recipe, "airfryer")
    assert "Airfryer" in airfryer_variant["title"]
    assert any("precalentar" in s["instruction"].lower() for s in airfryer_variant["steps"])
