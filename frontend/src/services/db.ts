import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RecetarioDB extends DBSchema {
  recipes: {
    key: number;
    value: any;
    indexes: { 'by-title': string };
  };
  offline_shopping: {
    key: number;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<RecetarioDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<RecetarioDB>('recetario_offline_db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('recipes')) {
          const recipeStore = db.createObjectStore('recipes', { keyPath: 'id' });
          recipeStore.createIndex('by-title', 'title');
        }
        if (!db.objectStoreNames.contains('offline_shopping')) {
          db.createObjectStore('offline_shopping', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveRecipeOffline(recipe: any) {
  const db = await getDB();
  await db.put('recipes', recipe);
}

export async function getOfflineRecipes(): Promise<any[]> {
  const db = await getDB();
  return db.getAll('recipes');
}

export async function getOfflineRecipe(id: number): Promise<any | undefined> {
  const db = await getDB();
  return db.get('recipes', id);
}

export async function removeOfflineRecipe(id: number) {
  const db = await getDB();
  await db.delete('recipes', id);
}
