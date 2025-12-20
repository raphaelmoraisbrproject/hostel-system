import { usePermissions as usePermissionsContext, MODULES } from '../contexts/PermissionsContext';

export { MODULES };

export const usePermissions = (module) => {
    const context = usePermissionsContext();

    if (!module) {
        return context;
    }

    return {
        ...context,
        canView: context.canView(module),
        canCreate: context.canCreate(module),
        canEdit: context.canEdit(module),
        canDelete: context.canDelete(module),
    };
};

export default usePermissions;
