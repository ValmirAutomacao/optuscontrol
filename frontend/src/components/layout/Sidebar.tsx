import { useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    FileText,
    Receipt,
    Wallet,
    Tags,
    Download,
    HelpCircle,
    Settings,
    LogOut,
    FolderKanban,
    TrendingUp,
    ShieldCheck,
    Users
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { RequireRole } from '../PermissionGate'
import './Sidebar.css'

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard' },
    { icon: FileText, label: 'Notas Fiscais', path: '/invoices', module: 'invoices' },
    { icon: Receipt, label: 'Despesas', path: '/expenses', module: 'receipts' },
    { icon: FolderKanban, label: 'Projetos/Obras', path: '/projects', module: 'projects' },
    { icon: TrendingUp, label: 'Medições', path: '/measurements', module: 'projects' },
    { icon: Wallet, label: 'Contas a Pagar', path: '/payables', module: 'payables' },
    { icon: Tags, label: 'Categorias', path: '/categories', module: 'receipts' },
    { icon: Users, label: 'Gestão de Acessos', path: '/users', module: 'users' },
]

const supportItems = [
    { icon: HelpCircle, label: 'Ajuda', path: '/help', module: 'public' },
    { icon: Settings, label: 'Configurações', path: '/settings', module: 'companies' },
]

const adminItems = [
    { icon: ShieldCheck, label: 'Admin SaaS', path: '/admin' },
]

export function Sidebar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { signOut } = useAuth()
    const { can, isDeveloper, user } = usePermissions()
    // Segurança extra: apenas o email principal de dev ou se a flag da API for verdadeira
    const reallyIsDev = isDeveloper || user?.email === 'valmirmoreirajunior@gmail.com'

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <img src="/logo_sidebar.png" alt="Optus Control" className="sidebar-logo-img" />
            </div>

            {/* Menu */}
            <nav className="sidebar-nav">
                <span className="nav-label">Menu</span>
                {menuItems.filter(item => item.module === 'dashboard' || can(item.module, 'read')).map((item) => (
                    <a
                        key={item.label}
                        href="#"
                        onClick={(e) => { e.preventDefault(); navigate(item.path) }}
                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </a>
                ))}

                <span className="nav-label">Suporte</span>
                {supportItems.filter(item => item.module === 'public' || can(item.module, 'read')).map((item) => (
                    <a
                        key={item.label}
                        href="#"
                        onClick={(e) => { e.preventDefault(); navigate(item.path) }}
                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </a>
                ))}

                {reallyIsDev && adminItems.map((item) => (
                    <a
                        key={item.label}
                        href="#"
                        onClick={(e) => { e.preventDefault(); navigate(item.path) }}
                        className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </a>
                ))}

                <RequireRole roles={['counter']}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); navigate('/counter') }}
                        className={`nav-item ${location.pathname === '/counter' ? 'active' : ''}`}
                    >
                        <Users size={20} />
                        <span>Visão Contador</span>
                    </a>
                </RequireRole>
            </nav>

            {/* CTA Card */}
            <div className="sidebar-cta">
                <div className="cta-icon">💼</div>
                <h4>Gerencie suas finanças de forma inteligente</h4>
                <button className="cta-button">Ver Indicadores</button>
            </div>

            {/* Logout */}
            <button className="sidebar-logout" onClick={handleLogout}>
                <LogOut size={20} />
                <span>Sair</span>
            </button>
        </aside>
    )
}
