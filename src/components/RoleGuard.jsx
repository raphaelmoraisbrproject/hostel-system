import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RoleGuard = ({ allowedRoles, children, redirectTo = '/' }) => {
    const { profile } = useAuth();

    // Ainda carregando profile, mostra children (auth já verificou user)
    if (!profile) {
        return children;
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(profile.role)) {
        return <Navigate to={redirectTo} replace />;
    }

    return children;
};

export default RoleGuard;
