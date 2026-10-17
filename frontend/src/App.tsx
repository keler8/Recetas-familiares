import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { HouseholdProvider } from './context/HouseholdContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';

// Pages
import { HomePage } from './pages/HomePage';
import { RecipesPage } from './pages/RecipesPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeEditPage } from './pages/RecipeEditPage';
import { CookingModePage } from './pages/CookingModePage';
import { ImportCenterPage } from './pages/ImportCenterPage';
import { PlannerPage } from './pages/PlannerPage';
import { PantryPage } from './pages/PantryPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { ReceiptScanPage } from './pages/ReceiptScanPage';
import { NutritionPage } from './pages/NutritionPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isCookingMode = location.pathname.includes('/cook');

  if (isCookingMode) {
    return <main>{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <HouseholdProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/recipes" element={<RecipesPage />} />
                  <Route path="/recipes/new" element={<RecipeEditPage />} />
                  <Route path="/recipes/:id" element={<RecipeDetailPage />} />
                  <Route path="/recipes/:id/edit" element={<RecipeEditPage />} />
                  <Route path="/recipes/:id/cook" element={<CookingModePage />} />
                  <Route path="/imports" element={<ImportCenterPage />} />
                  <Route path="/planner" element={<PlannerPage />} />
                  <Route path="/pantry" element={<PantryPage />} />
                  <Route path="/shopping" element={<ShoppingListPage />} />
                  <Route path="/receipts" element={<ReceiptScanPage />} />
                  <Route path="/nutrition" element={<NutritionPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/login" element={<LoginPage />} />
                </Routes>
              </Layout>
            </HouseholdProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

export default App;
