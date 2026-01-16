import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { PermissionsProvider } from './hooks/usePermissions'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { OfflineSyncBanner } from './components/layout/OfflineSyncBanner'
import { Dashboard } from './pages/Dashboard'
import { Invoices } from './pages/Invoices'
import { Expenses } from './pages/Expenses'
import { Payables } from './pages/Payables'
import { Categories } from './pages/Categories'
import { Export } from './pages/Export'
import { Settings } from './pages/Settings'
import { Projects } from './pages/Projects'
import { Measurements } from './pages/Measurements'
import { CounterDashboard } from './pages/CounterDashboard'
import { Admin } from './pages/Admin'
import { CompanySetup } from './pages/CompanySetup'
import { SetupUser } from './pages/SetupUser'
import { Users } from './pages/Users'
import { Login } from './pages/Login'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" />
}

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <TopBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/payables" element={<Payables />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/export" element={<Export />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/measurements" element={<Measurements />} />
          <Route path="/counter" element={<CounterDashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/users" element={<Users />} />
        </Routes>
        <OfflineSyncBanner />
      </main>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup/:token" element={<CompanySetup />} />
      <Route path="/setup-user/:token" element={<SetupUser />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionsProvider>
          <AppRoutes />
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
