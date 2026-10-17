from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, Float
)
from sqlalchemy.orm import relationship
from app.database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    main_image_url = Column(String(500), nullable=True)
    
    # Classification
    categories = Column(Text, nullable=True)  # JSON list of strings (e.g. ["Comidas", "Platos principales"])
    tags = Column(Text, nullable=True)  # JSON list of strings (e.g. ["Sin gluten", "Rápido"])
    dish_type = Column(String(100), nullable=True)  # Entrante, Principal, Postre, etc.
    cuisine = Column(String(100), nullable=True)  # Mediterránea, Vasca, Asiática, etc.
    
    # Times and Servings
    prep_time_min = Column(Integer, default=0, nullable=False)
    cook_time_min = Column(Integer, default=0, nullable=False)
    total_time_min = Column(Integer, default=0, nullable=False)
    difficulty = Column(String(50), default="media", nullable=False)  # facil, media, dificil
    base_servings = Column(Integer, default=4, nullable=False)
    
    # Tips & Culinary notes
    equipment_notes = Column(Text, nullable=True)
    preservation_tips = Column(Text, nullable=True)
    freezing_tips = Column(Text, nullable=True)
    reheating_tips = Column(Text, nullable=True)
    leftover_tips = Column(Text, nullable=True)
    chef_notes = Column(Text, nullable=True)

    # Nutrition & Allergens
    nutrition_calories = Column(Float, nullable=True)
    nutrition_protein = Column(Float, nullable=True)
    nutrition_carbs = Column(Float, nullable=True)
    nutrition_fat = Column(Float, nullable=True)
    allergens = Column(Text, nullable=True)  # JSON list of allergens (e.g. ["Gluten", "Lactosa"])
    
    # Provenance and Approval
    original_author = Column(String(150), nullable=True)
    source_type = Column(String(50), default="manual", nullable=False)  # manual, drive, pdf, instagram, url, ai
    source_url = Column(String(500), nullable=True)
    review_status = Column(String(50), default="approved", nullable=False)  # approved, draft, pending_review
    times_prepared = Column(Integer, default=0, nullable=False)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    variants = relationship("RecipeVariant", back_populates="recipe", cascade="all, delete-orphan")
    revisions = relationship("RecipeRevision", back_populates="recipe", cascade="all, delete-orphan")
    ratings = relationship("RecipeRating", back_populates="recipe", cascade="all, delete-orphan")
    favorites = relationship("RecipeFavorite", back_populates="recipe", cascade="all, delete-orphan")
    personal_notes = relationship("RecipePersonalNote", back_populates="recipe", cascade="all, delete-orphan")


class RecipeVariant(Base):
    __tablename__ = "recipe_variants"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_type = Column(String(50), default="traditional", nullable=False)  # traditional, thermomix, airfryer, healthy, custom
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    appliance_settings = Column(Text, nullable=True)  # JSON: {model: 'TM7', accessory: 'mariposa', airfryer_liters: 6, ...}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    recipe = relationship("Recipe", back_populates="variants")
    ingredients = relationship("RecipeIngredient", back_populates="variant", cascade="all, delete-orphan", order_by="RecipeIngredient.order_index")
    steps = relationship("RecipeStep", back_populates="variant", cascade="all, delete-orphan", order_by="RecipeStep.step_number")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    variant_id = Column(Integer, ForeignKey("recipe_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    amount = Column(Float, nullable=True)  # Can be null for "al gusto"
    unit = Column(String(50), nullable=True)  # g, kg, ml, l, cucharada, pizca, unidad, etc.
    notes = Column(String(255), nullable=True)  # e.g. "picada fina", "a temperatura ambiente"
    is_optional = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)

    variant = relationship("RecipeVariant", back_populates="ingredients")


class RecipeStep(Base):
    __tablename__ = "recipe_steps"

    id = Column(Integer, primary_key=True, index=True)
    variant_id = Column(Integer, ForeignKey("recipe_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    instruction = Column(Text, nullable=False)
    
    # Specific appliance controls
    appliance_action = Column(String(100), nullable=True)  # e.g., "Picar", "Sofreír", "Hornear"
    temperature = Column(String(50), nullable=True)  # e.g., "120 °C", "Varoma", "180 °C"
    speed = Column(String(50), nullable=True)  # e.g., "Velocidad 4", "Giro inverso"
    accessory = Column(String(100), nullable=True)  # e.g., "Cuchillas", "Mariposa", "Cestillo"
    timer_seconds = Column(Integer, nullable=True)  # Duration in seconds if automated
    tip = Column(Text, nullable=True)
    is_manual = Column(Boolean, default=False, nullable=False)

    variant = relationship("RecipeVariant", back_populates="steps")


class RecipeRevision(Base):
    __tablename__ = "recipe_revisions"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    version_num = Column(Integer, nullable=False)
    snapshot_json = Column(Text, nullable=False)
    change_summary = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    recipe = relationship("Recipe", back_populates="revisions")


class RecipeRating(Base):
    __tablename__ = "recipe_ratings"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1 to 5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    recipe = relationship("Recipe", back_populates="ratings")


class RecipeFavorite(Base):
    __tablename__ = "recipe_favorites"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    recipe = relationship("Recipe", back_populates="favorites")


class RecipePersonalNote(Base):
    __tablename__ = "recipe_personal_notes"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notes = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    recipe = relationship("Recipe", back_populates="personal_notes")
