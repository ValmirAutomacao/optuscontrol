import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']

interface AuthContextType {
    user: User | null
    session: Session | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, fullName: string) => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('Error getting session:', error.message)
                // Se houver erro de refresh token, limpar sessão
                if (error.message.includes('Refresh Token')) {
                    setSession(null)
                    setUser(null)
                }
            } else {
                setSession(session)
                setUser(session?.user ?? null)
            }
            setLoading(false)
        }).catch(err => {
            console.error('Session error:', err)
            setSession(null)
            setUser(null)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                // Se a sessão expirou ou houve erro de token, limpar
                if (event === 'TOKEN_REFRESHED' && !session) {
                    console.log('Token refresh failed, clearing session')
                    setSession(null)
                    setUser(null)
                } else if (event === 'SIGNED_OUT') {
                    setSession(null)
                    setUser(null)
                } else {
                    setSession(session)
                    setUser(session?.user ?? null)
                }
                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
    }

    const signUp = async (email: string, password: string, fullName: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName }
            }
        })
        if (error) throw error
    }

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) {
                console.error('Sign out error:', error.message)
            }
        } catch (err) {
            console.error('Sign out exception:', err)
        }
        // Sempre limpar estado local, mesmo se houver erro
        setSession(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
