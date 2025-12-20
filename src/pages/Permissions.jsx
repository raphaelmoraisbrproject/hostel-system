import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Save, RefreshCw } from 'lucide-react';

const Permissions = () => {
    const [selectedRole, setSelectedRole] = useState('manager');
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const roles = [
        { value: 'manager', label: 'Gerente' },
        { value: 'employee', label: 'Funcionário' },
        { value: 'volunteer', label: 'Voluntário' },
    ];

    const modules = [
        { key: 'bookings', label: 'Reservas', description: 'Gerenciar reservas e check-in/out' },
        { key: 'guests', label: 'Hóspedes', description: 'Ver e editar informações de hóspedes' },
        { key: 'rooms', label: 'Quartos', description: 'Gerenciar quartos e camas' },
        { key: 'finance', label: 'Finanças', description: 'Acessar relatórios e transações financeiras' },
        { key: 'tasks', label: 'Tarefas', description: 'Ver e gerenciar todas as tarefas' },
        { key: 'laundry', label: 'Lavanderia', description: 'Controlar estoque e ciclos de lavagem' },
        { key: 'areas', label: 'Áreas', description: 'Gerenciar áreas e checklists' },
    ];

    const actions = [
        { key: 'can_view', label: 'Ver' },
        { key: 'can_create', label: 'Criar' },
        { key: 'can_edit', label: 'Editar' },
        { key: 'can_delete', label: 'Excluir' },
    ];

    useEffect(() => {
        fetchPermissions();
    }, [selectedRole]);

    const fetchPermissions = async () => {
        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('*')
                .eq('role', selectedRole);

            if (error) throw error;

            // Transform to object for easier access
            const permMap = {};
            data.forEach(perm => {
                permMap[perm.module] = {
                    id: perm.id,
                    can_view: perm.can_view,
                    can_create: perm.can_create,
                    can_edit: perm.can_edit,
                    can_delete: perm.can_delete,
                };
            });

            // Initialize missing modules with defaults
            modules.forEach(mod => {
                if (!permMap[mod.key]) {
                    permMap[mod.key] = {
                        can_view: false,
                        can_create: false,
                        can_edit: false,
                        can_delete: false,
                    };
                }
            });

            setPermissions(permMap);
        } catch (err) {
            console.error('Error fetching permissions:', err);
            setError('Erro ao carregar permissões');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (module, action) => {
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                [action]: !prev[module]?.[action],
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Update or insert each module's permissions
            for (const mod of modules) {
                const perm = permissions[mod.key];

                if (perm.id) {
                    // Update existing
                    const { error } = await supabase
                        .from('role_permissions')
                        .update({
                            can_view: perm.can_view,
                            can_create: perm.can_create,
                            can_edit: perm.can_edit,
                            can_delete: perm.can_delete,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', perm.id);

                    if (error) throw error;
                } else {
                    // Insert new
                    const { error } = await supabase
                        .from('role_permissions')
                        .insert({
                            role: selectedRole,
                            module: mod.key,
                            can_view: perm.can_view,
                            can_create: perm.can_create,
                            can_edit: perm.can_edit,
                            can_delete: perm.can_delete,
                        });

                    if (error) throw error;
                }
            }

            setSuccess('Permissões salvas com sucesso!');
            await fetchPermissions();
        } catch (err) {
            console.error('Error saving permissions:', err);
            setError('Erro ao salvar permissões');
        } finally {
            setSaving(false);
        }
    };

    const handleSelectAll = (module) => {
        const allSelected = actions.every(action => permissions[module]?.[action.key]);
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                can_view: !allSelected,
                can_create: !allSelected,
                can_edit: !allSelected,
                can_delete: !allSelected,
            }
        }));
    };

    const handleSelectAllModule = (action) => {
        const allSelected = modules.every(mod => permissions[mod.key]?.[action]);
        const newPerms = { ...permissions };
        modules.forEach(mod => {
            newPerms[mod.key] = {
                ...newPerms[mod.key],
                [action]: !allSelected,
            };
        });
        setPermissions(newPerms);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="text-emerald-600" />
                        Configurar Permissões
                    </h1>
                    <p className="text-gray-600">Defina o que cada perfil pode acessar no sistema</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchPermissions}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Recarregar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                        <Save size={18} />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                    {success}
                </div>
            )}

            {/* Role Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione o Perfil
                </label>
                <div className="flex gap-2">
                    {roles.map(role => (
                        <button
                            key={role.value}
                            onClick={() => setSelectedRole(role.value)}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${selectedRole === role.value
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {role.label}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                    O perfil <strong>Administrador</strong> sempre tem acesso total ao sistema.
                </p>
            </div>

            {/* Permissions Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                Módulo
                            </th>
                            {actions.map(action => (
                                <th key={action.key} className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => handleSelectAllModule(action.key)}
                                        className="hover:text-emerald-600 transition-colors"
                                        title={`Marcar/Desmarcar todos - ${action.label}`}
                                    >
                                        {action.label}
                                    </button>
                                </th>
                            ))}
                            <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Todos
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {modules.map(mod => (
                            <tr key={mod.key} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium text-gray-900">{mod.label}</div>
                                        <div className="text-sm text-gray-500">{mod.description}</div>
                                    </div>
                                </td>
                                {actions.map(action => (
                                    <td key={action.key} className="px-6 py-4 text-center">
                                        <label className="inline-flex items-center justify-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={permissions[mod.key]?.[action.key] || false}
                                                onChange={() => handleToggle(mod.key, action.key)}
                                                className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                                            />
                                        </label>
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => handleSelectAll(mod.key)}
                                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${actions.every(a => permissions[mod.key]?.[a.key])
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {actions.every(a => permissions[mod.key]?.[a.key]) ? 'Remover' : 'Todos'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Legenda</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li><strong>Ver:</strong> Pode visualizar a lista e detalhes dos itens</li>
                    <li><strong>Criar:</strong> Pode adicionar novos itens</li>
                    <li><strong>Editar:</strong> Pode modificar itens existentes</li>
                    <li><strong>Excluir:</strong> Pode remover itens</li>
                </ul>
            </div>
        </div>
    );
};

export default Permissions;
