import { Navigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';

const PermissionGuard = ({ module, action = 'view', children, redirectTo = '/' }) => {
    const { canView, canCreate, canEdit, canDelete } = usePermissions();

    let hasPermission = false;
    switch (action) {
        case 'view': hasPermission = canView(module); break;
        case 'create': hasPermission = canCreate(module); break;
        case 'edit': hasPermission = canEdit(module); break;
        case 'delete': hasPermission = canDelete(module); break;
        default: hasPermission = canView(module);
    }

    // Admin sempre tem acesso, e se ainda não carregou permissions, permite acesso
    if (!hasPermission) {
        return <Navigate to={redirectTo} replace />;
    }

    return children;
};

export default PermissionGuard;
