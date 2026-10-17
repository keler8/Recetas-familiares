import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('token');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Iniciando sesión segura...</p>
        </div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicLoginRoute: React.FC = () => {
  const { user, loading } = useAuth();
  const token = localStorage.getItem('token');

  if (!loading && (user || token)) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const isLoginPage = location.pathname === '/login';
  const isCookingMode = location.pathname.includes('/cook');

  if (isLoginPage || (!user && !token)) {
    return <main className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">{children}</main>;
  }

  if (isCookingMode) {
    return <main>{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans selection:bg-amber-500 selection:text-black transition-colors duration-150">
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
                  {/* Public Authentication Route */}
                  <Route path="/login" element={<PublicLoginRoute />} />

                  {/* Protected Application Routes */}
                  <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                  <Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
                  <Route path="/recipes/new" element={<ProtectedRoute><RecipeEditPage /></ProtectedRoute>} />
                  <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetailPage /></ProtectedRoute>} />
                  <Route path="/recipes/:id/edit" element={<ProtectedRoute><RecipeEditPage /></ProtectedRoute>} />
                  <Route path="/recipes/:id/cook" element={<ProtectedRoute><CookingModePage /></ProtectedRoute>} />
                  <Route path="/imports" element={<ProtectedRoute><ImportCenterPage /></ProtectedRoute>} />
                  <Route path="/planner" element={<ProtectedRoute><PlannerPage /></ProtectedRoute>} />
                  <Route path="/pantry" element={<ProtectedRoute><PantryPage /></ProtectedRoute>} />
                  <Route path="/shopping" element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
                  <Route path="/receipts" element={<ProtectedRoute><ReceiptScanPage /></ProtectedRoute>} />
                  <Route path="/nutrition" element={<ProtectedRoute><NutritionPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
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
