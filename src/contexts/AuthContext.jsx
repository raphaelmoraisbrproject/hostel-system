import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes on auth state (login, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const createInvite = async (email, role) => {
        const { data, error } = await supabase
            .from('user_invites')
            .insert({ email, role })
            .select('token')
            .single();

        if (error) throw error;
        return data.token;
    };

    const validateInvite = async (token) => {
        const { data, error } = await supabase
            .rpc('validate_invite_token', { p_token: token });

        if (error) throw error;
        return data;
    };

    const signUpWithInvite = async (token, password, fullName) => {
        // Validate the invite first
        const inviteData = await validateInvite(token);

        if (!inviteData.valid) {
            throw new Error('Invalid or expired invite token');
        }

        // Create the user account
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email: inviteData.email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: inviteData.role,
                }
            }
        });

        if (signUpError) throw signUpError;

        // Mark invite as used
        const { error: markError } = await supabase
            .rpc('mark_invite_as_used', {
                p_invite_id: inviteData.invite_id,
                p_user_id: authData.user.id
            });

        if (markError) throw markError;

        return authData;
    };

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;
    };

    const updatePassword = async (newPassword) => {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
    };

    const getInvites = async () => {
        const { data, error } = await supabase
            .from('user_invites')
            .select('*')
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    };

    const cancelInvite = async (inviteId) => {
        const { error } = await supabase
            .from('user_invites')
            .delete()
            .eq('id', inviteId);

        if (error) throw error;
    };

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: () => supabase.auth.signOut(),
        createInvite,
        validateInvite,
        signUpWithInvite,
        resetPassword,
        updatePassword,
        getInvites,
        cancelInvite,
        user,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
