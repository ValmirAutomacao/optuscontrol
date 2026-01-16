import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

export function Login() {
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn, signUp, user } = useAuth()
    const navigate = useNavigate()

    // Redirecionar se já estiver logado
    useEffect(() => {
        if (user) {
            navigate('/', { replace: true })
        }
    }, [user, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (isLogin) {
                await signIn(email, password)
            } else {
                await signUp(email, password, fullName)
            }
            // Após login/signup bem sucedido, o useEffect vai redirecionar
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao autenticar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                {/* Logo */}
                <div className="login-logo">
                    <img src="/logo_full.jpg" alt="Optus Control" className="login-logo-img" />
                </div>

                <h1 className="login-title">
                    {isLogin ? 'Bem-vindo de volta!' : 'Criar conta'}
                </h1>
                <p className="login-subtitle">
                    {isLogin
                        ? 'Entre com suas credenciais para acessar o sistema'
                        : 'Preencha os dados para criar sua conta'}
                </p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    {!isLogin && (
                        <div className="form-group">
                            <label htmlFor="fullName">Nome completo</label>
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Seu nome"
                                required={!isLogin}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Senha</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar conta')}
                    </button>
                </form>

                <div className="login-footer">
                    <span>
                        {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                    </span>
                    <button
                        type="button"
                        className="login-toggle"
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? 'Criar conta' : 'Fazer login'}
                    </button>
                </div>
            </div>
        </div>
    )
}
