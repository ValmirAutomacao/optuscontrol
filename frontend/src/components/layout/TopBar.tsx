import { useState, useEffect, useRef } from 'react'
import { Search, Bell, Calendar, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { CompanySelector } from '../PermissionGate'
import './TopBar.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface Notification {
    id: string
    type: string
    title: string
    message: string
    is_read: boolean
    created_at: string
    metadata?: Record<string, unknown>
}

export function TopBar() {
    const { user, session } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [showDropdown, setShowDropdown] = useState(false)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (user && session?.access_token) {
            loadNotifications()
        }
    }, [user, session])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function loadNotifications() {
        if (!session?.access_token) return
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/notifications?limit=10&unread_only=false`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.slice(0, 5))
                setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
            }
        } catch (e) {
            console.error('Error loading notifications:', e)
        } finally {
            setLoading(false)
        }
    }

    async function markAsRead(id: string) {
        if (!session?.access_token) return
        try {
            await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (e) {
            console.error(e)
        }
    }

    async function markAllAsRead() {
        if (!session?.access_token) return
        try {
            await fetch(`${API_URL}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            setUnreadCount(0)
        } catch (e) {
            console.error(e)
        }
    }

    function getNotificationIcon(type: string) {
        switch (type) {
            case 'invoice': return <FileText size={16} />
            case 'warning': return <AlertCircle size={16} />
            case 'success': return <CheckCircle size={16} />
            default: return <Bell size={16} />
        }
    }

    function formatTime(dateStr: string) {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Agora'
        if (diffMins < 60) return `${diffMins}min`
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
        return `${Math.floor(diffMins / 1440)}d`
    }

    const userName = user?.user_metadata?.full_name || 'Usuário'
    const userInitial = userName.charAt(0).toUpperCase()

    return (
        <header className="topbar">
            {/* Esquerda: Seletor de Empresa para Contadores */}
            <div className="topbar-left">
                <CompanySelector />
            </div>

            <div className="topbar-right">
                {/* Search */}
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="search-input"
                    />
                </div>

                {/* Actions */}
                <div className="topbar-actions">
                    {/* Notifications */}
                    <div className="notification-wrapper" ref={dropdownRef}>
                        <button
                            className="icon-button"
                            onClick={() => setShowDropdown(!showDropdown)}
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="icon-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>

                        {showDropdown && (
                            <div className="notification-dropdown">
                                <div className="notification-header">
                                    <h3>Notificações</h3>
                                    {unreadCount > 0 && (
                                        <button className="mark-all" onClick={markAllAsRead}>
                                            Marcar todas como lidas
                                        </button>
                                    )}
                                </div>

                                <div className="notification-list">
                                    {loading ? (
                                        <div className="notification-empty">Carregando...</div>
                                    ) : notifications.length === 0 ? (
                                        <div className="notification-empty">
                                            <Bell size={24} />
                                            <p>Nenhuma notificação</p>
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                                                onClick={() => !n.is_read && markAsRead(n.id)}
                                            >
                                                <div className={`notification-icon type-${n.type}`}>
                                                    {getNotificationIcon(n.type)}
                                                </div>
                                                <div className="notification-content">
                                                    <strong>{n.title}</strong>
                                                    <p>{n.message}</p>
                                                </div>
                                                <span className="notification-time">
                                                    <Clock size={12} /> {formatTime(n.created_at)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="notification-footer">
                                    <a href="/notifications">Ver todas</a>
                                </div>
                            </div>
                        )}
                    </div>

                    <button className="icon-button">
                        <Calendar size={20} />
                    </button>

                    {/* Profile */}
                    <div className="user-profile">
                        <div className="user-avatar-circle">
                            {userInitial}
                        </div>
                        <div className="user-info">
                            <span className="user-name">{userName}</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
