import { useState, useEffect } from 'react'
import { Building2, Lock, Mail, User, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './CompanySetup.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface CompanyData {
    id: string
    name: string
    fantasy_name?: string
    cnpj?: string
    city?: string
    state?: string
}

interface TokenData {
    valid: boolean
    admin_email: string
    admin_name: string
    company: CompanyData
    expires_at: string
}

type PageStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'success'

export function CompanySetup() {
    const { token } = useParams<{ token: string }>()
    const navigate = useNavigate()
    const { signOut } = useAuth()

    const [status, setStatus] = useState<PageStatus>('loading')
    const [tokenData, setTokenData] = useState<TokenData | null>(null)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [passwordError, setPasswordError] = useState('')

    useEffect(() => {
        if (token) {
            validateToken()
        }
    }, [token])

    async function validateToken() {
        try {
            const res = await fetch(`${API_URL}/admin/onboarding/${token}`)

            if (res.ok) {
                const data = await res.json()
                setTokenData(data)
                setStatus('valid')
            } else {
                const err = await res.json()
                if (err.detail?.includes('utilizado')) {
                    setStatus('used')
                } else if (err.detail?.includes('expirou')) {
                    setStatus('expired')
                } else {
                    setStatus('invalid')
                }
                setError(err.detail || 'Convite inválido')
            }
        } catch (e) {
            setStatus('invalid')
            setError('Erro de conexão')
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setPasswordError('')

        if (password.length < 6) {
            setPasswordError('A senha deve ter no mínimo 6 caracteres')
            return
        }

        if (password !== passwordConfirm) {
            setPasswordError('As senhas não conferem')
            return
        }

        setSubmitting(true)

        try {
            const res = await fetch(`${API_URL}/admin/onboarding/${token}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, password_confirm: passwordConfirm })
            })

            if (res.ok) {
                setStatus('success')
            } else {
                const err = await res.json()
                setPasswordError(err.detail || 'Erro ao completar cadastro')
            }
        } catch (e) {
            setPasswordError('Erro de conexão')
        } finally {
            setSubmitting(false)
        }
    }

    // Loading
    if (status === 'loading') {
        return (
            <div className="setup-container">
                <div className="setup-card">
                    <Loader className="spinner" size={48} />
                    <p>Validando convite...</p>
                </div>
            </div>
        )
    }

    // Invalid/Expired/Used
    if (status === 'invalid' || status === 'expired' || status === 'used') {
        return (
            <div className="setup-container">
                <div className="setup-card error-card">
                    <AlertCircle size={64} />
                    <h1>
                        {status === 'expired' && 'Convite Expirado'}
                        {status === 'used' && 'Convite Já Utilizado'}
                        {status === 'invalid' && 'Convite Inválido'}
                    </h1>
                    <p>{error}</p>
                    {status === 'used' && (
                        <button className="btn-primary" onClick={() => navigate('/login')}>
                            Fazer Login
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Success
    if (status === 'success') {
        return (
            <div className="setup-container">
                <div className="setup-card success-card">
                    <CheckCircle size={64} />
                    <h1>Cadastro Concluído!</h1>
                    <p>Sua conta foi criada com sucesso. Agora você pode fazer login.</p>
                    <button className="btn-primary" onClick={async () => {
                        await signOut()
                        navigate('/login')
                    }}>
                        Ir para Login
                    </button>
                </div>
            </div>
        )
    }

    // Valid - Show form
    return (
        <div className="setup-container">
            <div className="setup-card">
                <div className="setup-header">
                    <div className="logo">
                        <Building2 size={32} />
                        <span>Optus Control</span>
                    </div>
                    <h1>Complete seu Cadastro</h1>
                    <p>Crie sua senha para acessar o sistema</p>
                </div>

                {/* Company Info */}
                <div className="company-info">
                    <h3>Dados da Empresa</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="label">Razão Social</span>
                            <span className="value">{tokenData?.company.name}</span>
                        </div>
                        {tokenData?.company.fantasy_name && (
                            <div className="info-item">
                                <span className="label">Nome Fantasia</span>
                                <span className="value">{tokenData.company.fantasy_name}</span>
                            </div>
                        )}
                        <div className="info-item">
                            <span className="label">CNPJ</span>
                            <span className="value">{tokenData?.company.cnpj}</span>
                        </div>
                        {tokenData?.company.city && (
                            <div className="info-item">
                                <span className="label">Localização</span>
                                <span className="value">{tokenData.company.city} - {tokenData.company.state}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="setup-form">
                    <h3>Seus Dados de Acesso</h3>

                    <div className="form-group">
                        <label><User size={16} /> Nome</label>
                        <input type="text" value={tokenData?.admin_name || ''} disabled />
                    </div>

                    <div className="form-group">
                        <label><Mail size={16} /> Email</label>
                        <input type="email" value={tokenData?.admin_email || ''} disabled />
                        <small>Este será seu email de login</small>
                    </div>

                    <div className="form-group">
                        <label><Lock size={16} /> Senha *</label>
                        <input
                            type="password"
                            name="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label><Lock size={16} /> Confirmar Senha *</label>
                        <input
                            type="password"
                            name="password_confirm"
                            autoComplete="new-password"
                            value={passwordConfirm}
                            onChange={e => setPasswordConfirm(e.target.value)}
                            placeholder="Repita a senha"
                            required
                        />
                    </div>

                    {passwordError && (
                        <div className="error-message">
                            <AlertCircle size={16} /> {passwordError}
                        </div>
                    )}

                    <button type="submit" className="btn-primary btn-full" disabled={submitting}>
                        {submitting ? 'Criando conta...' : 'Completar Cadastro'}
                    </button>
                </form>

                <div className="setup-footer">
                    <p>Ao criar sua conta, você concorda com os termos de uso.</p>
                </div>
            </div>
        </div>
    )
}
