import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext({});

export const usePermissions = () => useContext(PermissionsContext);

export const MODULES = {
    BOOKINGS: 'bookings',
    GUESTS: 'guests',
    ROOMS: 'rooms',
    FINANCE: 'finance',
    TASKS: 'tasks',
    LAUNDRY: 'laundry',
    AREAS: 'areas',
    USERS: 'users',
};

export const PermissionsProvider = ({ children }) => {
    const { profile } = useAuth();
    const [permissions, setPermissions] = useState({});

    useEffect(() => {
        if (!profile?.role || profile.role === 'admin') {
            setPermissions({});
            return;
        }

        supabase
            .from('role_permissions')
            .select('*')
            .eq('role', profile.role)
            .then(({ data }) => {
                if (data) {
                    const permsMap = {};
                    data.forEach(p => {
                        permsMap[p.module] = {
                            canView: p.can_view,
                            canCreate: p.can_create,
                            canEdit: p.can_edit,
                            canDelete: p.can_delete,
                        };
                    });
                    setPermissions(permsMap);
                }
            });
    }, [profile?.role]);

    // Admin tem tudo, outros checam permissions
    const isAdmin = profile?.role === 'admin';

    const canView = (module) => isAdmin || permissions[module]?.canView || false;
    const canCreate = (module) => isAdmin || permissions[module]?.canCreate || false;
    const canEdit = (module) => isAdmin || permissions[module]?.canEdit || false;
    const canDelete = (module) => isAdmin || permissions[module]?.canDelete || false;

    return (
        <PermissionsContext.Provider value={{
            permissions,
            canView,
            canCreate,
            canEdit,
            canDelete,
            MODULES,
        }}>
            {children}
        </PermissionsContext.Provider>
    );
};
