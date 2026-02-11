import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simple Session Init
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else setLoading(false);
        });

        // Simple Auth Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Profile sync delay:', error.message);
                // Hard Fallback for Main Admin ID
                if (userId === 'd996e38b-d731-409b-a918-6c84b9676646') {
                    setProfile({ id: userId, username: 'pegasus.spare', role: 'SUPER_ADMIN' });
                }
            } else {
                setProfile(data);
            }
        } catch (err) {
            console.error('Fetch Error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        // ALWAYS use the internal mapping to avoid dashboard email errors
        const email = username.includes('@') ? username : `${username}@pegasus.spare`;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('--- LOGIN ERROR DETAIL ---');
            console.error('Code:', err.code);
            console.error('Message:', err.message);
            console.error('Status:', err.status);
            console.error('---------------------------');
            throw new Error(`Login Error: ${err.message}. (System reset required if recurring)`);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
