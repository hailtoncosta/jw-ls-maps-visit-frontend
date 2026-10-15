import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LanguageProvider } from './lib/i18n';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AddressList from './pages/AddressList';
import AddressForm from './pages/AddressForm';
import AddressDetail from './pages/AddressDetail';
import MapView from './pages/MapView';
import VisitCards from './pages/VisitCards';
import AdminPanel from './pages/AdminPanel';
import BackupRestore from './pages/BackupRestore';
import Trash from './pages/Trash';
import MyTerritories from './pages/MyTerritories';
import Settings from './pages/Settings';
import ShareCadastro from './pages/ShareCadastro';
import ImportPage from './pages/ImportPage';
import PermissionGuard from './components/PermissionGuard';
import ProgressoSurdos from './pages/ProgressoSurdos';
import ContactCreator from './pages/ContactCreator';
import ManualGenerator from './pages/ManualGenerator';
import MyProfile from './pages/MyProfile';
import DigitalCardPage from './pages/DigitalCardPage';
import Duplicates from './pages/Duplicates';
import Login from './pages/Login';
import Congregations from './pages/Congregations';

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (location.pathname === '/login' || location.pathname === '/reset-password') return <Login />;

  // Public routes for shared/import cadastro - bypasses authentication
  if (location.pathname.startsWith('/s/') || location.pathname === '/import' || location.pathname.startsWith('/cartao-digital/')) {
    return (
      <Routes>
        <Route path="/s/:id" element={<ShareCadastro />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/cartao-digital/:ids" element={<DigitalCardPage />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<PermissionGuard permission="page_home"><Dashboard /></PermissionGuard>} />
        <Route path="/addresses" element={<PermissionGuard permission="page_addresses"><AddressList /></PermissionGuard>} />
        <Route path="/addresses/new" element={<PermissionGuard permission="page_new_address"><AddressForm /></PermissionGuard>} />
        <Route path="/addresses/:id" element={<PermissionGuard permission="page_addresses"><AddressDetail /></PermissionGuard>} />
        <Route path="/map" element={<PermissionGuard permission="page_map"><MapView /></PermissionGuard>} />
        <Route path="/visit-cards" element={<PermissionGuard permission="page_visit_cards"><VisitCards /></PermissionGuard>} />
        <Route path="/my-territories" element={<PermissionGuard permission="page_my_territories"><MyTerritories /></PermissionGuard>} />
        <Route path="/admin" element={<PermissionGuard permission="admin_manage_users"><AdminPanel /></PermissionGuard>} />
        <Route path="/congregacoes" element={<PermissionGuard permission="admin_manage_congregations"><Congregations /></PermissionGuard>} />
        <Route path="/admin/backup" element={<PermissionGuard permission="admin_backup_restore"><BackupRestore /></PermissionGuard>} />
        <Route path="/admin/trash" element={<PermissionGuard permission="admin_trash"><Trash /></PermissionGuard>} />
        <Route path="/admin/manuals" element={<PermissionGuard permission="admin_manage_users"><ManualGenerator /></PermissionGuard>} />
        <Route path="/progress" element={<PermissionGuard permission="page_progress"><ProgressoSurdos /></PermissionGuard>} />
        <Route path="/contact" element={<ContactCreator />} />
        <Route path="/settings" element={<PermissionGuard permission="page_settings"><Settings /></PermissionGuard>} />
        <Route path="/profile" element={<MyProfile />} />
        <Route path="/duplicates" element={<Duplicates />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4500}
          />
        </QueryClientProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App
