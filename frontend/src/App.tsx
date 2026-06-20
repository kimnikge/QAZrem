import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { CatalogPage } from './pages/CatalogPage';
import { ClientsPage } from './pages/ClientsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateOrderPage } from './pages/CreateOrderPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { PartsPage } from './pages/PartsPage';
import { ServicesPage } from './pages/ServicesPage';
import { PrintOrderPage } from './pages/PrintOrderPage';
import { FinancePage } from './pages/FinancePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized } = useAuth();
  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuth();
  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/create-order" element={<CreateOrderPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/print-order/:id" element={<PrintOrderPage />} />
        <Route path="/parts" element={<PartsPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
