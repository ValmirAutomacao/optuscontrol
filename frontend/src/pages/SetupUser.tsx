import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, Lock, CheckCircle2, AlertCircle, Loader } from 'lucide-react'
import './CompanySetup.css' // Reaproveitando estilos do setup original

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export function SetupUser() {
    const { token } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(true)
    const [inviteData, setInviteData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        validateInvite()
    }, [token])

    async function validateInvite() {
        if (!token) return
        try {
            const res = await fetch(`${API_URL}/users/invite/${token}`)
            if (res.ok) {
                const data = await res.json()
                setInviteData(data)
            } else {
                const err = await res.json()
                setError(err.detail || 'Convite inválido ou expirado.')
            }
        } catch (e) {
            setError('Erro ao conectar com o servidor.')
        } finally {
            setVerifying(false)
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (password !== passwordConfirm) {
            setError('As senhas não conferem.')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`${API_URL}/users/invite/${token}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, password_confirm: passwordConfirm })
            })

            if (res.ok) {
                setSuccess(true)
                setTimeout(() => navigate('/login'), 5000)
            } else {
                const err = await res.json()
                setError(err.detail || 'Erro ao ativar conta.')
            }
        } catch (e) {
            setError('Erro de conexão.')
        } finally {
            setLoading(false)
        }
    }

    if (verifying) return <div className="setup-loading"><Loader className="spin" /> Verificando convite...</div>

    if (success) {
        return (
            <div className="setup-container">
                <div className="setup-card success-card">
                    <CheckCircle2 size={64} color="#10b981" />
                    <h1>Conta Ativada!</h1>
                    <p>Sua senha foi definida com sucesso. Você será redirecionado para o login em instantes.</p>
                    <button className="btn-primary" onClick={() => navigate('/login')}>Fazer Login Agora</button>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="setup-container">
                <div className="setup-card">
                    <AlertCircle size={64} color="#ef4444" />
                    <h1>Ops! Algo deu errado</h1>
                    <p>{error}</p>
                    <button className="btn-secondary" onClick={() => navigate('/login')}>Voltar ao Início</button>
                </div>
            </div>
        )
    }

    return (
        <div className="setup-container">
            <div className="setup-card">
                <div className="setup-header">
                    <div className="setup-icon"><Shield size={32} /></div>
                    <h1>Ativar Conta</h1>
                    <p>Olá <strong>{inviteData?.name}</strong>! Defina sua senha para acessar o Optus Control na empresa <strong>{inviteData?.company_name}</strong>.</p>
                </div>

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="form-group">
                        <label><Lock size={16} /> Nova Senha</label>
                        <input
                            required
                            type="password"
                            name="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            minLength={6}
                        />
                    </div>
                    <div className="form-group">
                        <label><Lock size={16} /> Confirmar Senha</label>
                        <input
                            required
                            type="password"
                            name="password_confirm"
                            autoComplete="new-password"
                            value={passwordConfirm}
                            onChange={e => setPasswordConfirm(e.target.value)}
                            placeholder="Repita a senha"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Ativando...' : 'Ativar Minha Conta'}
                    </button>
                </form>
            </div>
        </div>
    )
}
