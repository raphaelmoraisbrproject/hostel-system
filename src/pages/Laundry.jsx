import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import {
    Shirt, Plus, Minus, Play, Check, Package, AlertTriangle,
    Droplets, Wind, Archive, X, RefreshCw
} from 'lucide-react';

const Laundry = () => {
    const { profile } = useAuth();
    const { canCreate, canEdit } = usePermissions();
    const [items, setItems] = useState([]);
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stock');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        type: 'sheet',
        clean_count: 0,
        dirty_count: 0,
        in_wash_count: 0,
        min_stock: 10,
    });

    const [cycleData, setCycleData] = useState({
        items: [],
        notes: '',
    });

    const itemTypes = [
        { value: 'sheet', label: 'Lençol' },
        { value: 'pillowcase', label: 'Fronha' },
        { value: 'towel', label: 'Toalha' },
        { value: 'blanket', label: 'Cobertor' },
        { value: 'other', label: 'Outro' },
    ];

    const cycleStatuses = [
        { value: 'washing', label: 'Lavando', color: 'bg-blue-100 text-blue-700', icon: Droplets },
        { value: 'drying', label: 'Secando', color: 'bg-yellow-100 text-yellow-700', icon: Wind },
        { value: 'ready', label: 'Pronto', color: 'bg-green-100 text-green-700', icon: Check },
        { value: 'stored', label: 'Guardado', color: 'bg-gray-100 text-gray-700', icon: Archive },
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [itemsRes, cyclesRes] = await Promise.all([
                supabase.from('laundry_items').select('*').order('type').order('name'),
                supabase.from('laundry_cycles').select('*').neq('status', 'stored').order('started_at', { ascending: false }),
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (cyclesRes.error) throw cyclesRes.error;

            setItems(itemsRes.data || []);
            setCycles(cyclesRes.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                type: item.type,
                clean_count: item.clean_count,
                dirty_count: item.dirty_count,
                in_wash_count: item.in_wash_count,
                min_stock: item.min_stock,
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                type: 'sheet',
                clean_count: 0,
                dirty_count: 0,
                in_wash_count: 0,
                min_stock: 10,
            });
        }
        setError('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('laundry_items')
                    .update({
                        name: formData.name,
                        type: formData.type,
                        clean_count: formData.clean_count,
                        dirty_count: formData.dirty_count,
                        in_wash_count: formData.in_wash_count,
                        min_stock: formData.min_stock,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingItem.id);

                if (error) throw error;
                setSuccess('Item atualizado!');
            } else {
                const { error } = await supabase
                    .from('laundry_items')
                    .insert(formData);

                if (error) throw error;
                setSuccess('Item criado!');
            }

            await fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving item:', err);
            setError(err.message || 'Erro ao salvar item');
        }
    };

    const handleUpdateCount = async (itemId, field, delta) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const newValue = Math.max(0, item[field] + delta);

        try {
            const { error } = await supabase
                .from('laundry_items')
                .update({ [field]: newValue, updated_at: new Date().toISOString() })
                .eq('id', itemId);

            if (error) throw error;
            await fetchData();
        } catch (err) {
            console.error('Error updating count:', err);
            setError('Erro ao atualizar quantidade');
        }
    };

    const handleMoveToDirty = async (itemId, quantity) => {
        const item = items.find(i => i.id === itemId);
        if (!item || item.clean_count < quantity) return;

        try {
            const { error } = await supabase
                .from('laundry_items')
                .update({
                    clean_count: item.clean_count - quantity,
                    dirty_count: item.dirty_count + quantity,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);

            if (error) throw error;
            await fetchData();
        } catch (err) {
            console.error('Error moving to dirty:', err);
            setError('Erro ao atualizar');
        }
    };

    const handleStartCycle = async () => {
        if (cycleData.items.length === 0) {
            setError('Selecione pelo menos um item');
            return;
        }

        try {
            // Create cycle
            const { data: cycle, error: cycleError } = await supabase
                .from('laundry_cycles')
                .insert({
                    items: cycleData.items,
                    status: 'washing',
                    notes: cycleData.notes,
                    created_by: profile?.id,
                })
                .select()
                .single();

            if (cycleError) throw cycleError;

            // Update item counts (move from dirty to in_wash)
            for (const cycleItem of cycleData.items) {
                const item = items.find(i => i.id === cycleItem.item_id);
                if (item) {
                    await supabase
                        .from('laundry_items')
                        .update({
                            dirty_count: Math.max(0, item.dirty_count - cycleItem.quantity),
                            in_wash_count: item.in_wash_count + cycleItem.quantity,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', cycleItem.item_id);
                }
            }

            setSuccess('Ciclo de lavagem iniciado!');
            setCycleData({ items: [], notes: '' });
            setIsCycleModalOpen(false);
            await fetchData();
        } catch (err) {
            console.error('Error starting cycle:', err);
            setError('Erro ao iniciar ciclo');
        }
    };

    const handleUpdateCycleStatus = async (cycleId, newStatus) => {
        const cycle = cycles.find(c => c.id === cycleId);
        if (!cycle) return;

        try {
            const updateData = {
                status: newStatus,
            };

            if (newStatus === 'stored') {
                updateData.completed_at = new Date().toISOString();

                // Move items from in_wash to clean
                for (const cycleItem of cycle.items) {
                    const item = items.find(i => i.id === cycleItem.item_id);
                    if (item) {
                        await supabase
                            .from('laundry_items')
                            .update({
                                in_wash_count: Math.max(0, item.in_wash_count - cycleItem.quantity),
                                clean_count: item.clean_count + cycleItem.quantity,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', cycleItem.item_id);
                    }
                }
            }

            const { error } = await supabase
                .from('laundry_cycles')
                .update(updateData)
                .eq('id', cycleId);

            if (error) throw error;

            if (newStatus === 'stored') {
                setSuccess('Roupa guardada! Estoque atualizado.');
            }
            await fetchData();
        } catch (err) {
            console.error('Error updating cycle:', err);
            setError('Erro ao atualizar ciclo');
        }
    };

    const addItemToCycle = (itemId) => {
        const existing = cycleData.items.find(i => i.item_id === itemId);
        if (existing) {
            setCycleData(prev => ({
                ...prev,
                items: prev.items.map(i =>
                    i.item_id === itemId ? { ...i, quantity: i.quantity + 1 } : i
                )
            }));
        } else {
            setCycleData(prev => ({
                ...prev,
                items: [...prev.items, { item_id: itemId, quantity: 1 }]
            }));
        }
    };

    const removeItemFromCycle = (itemId) => {
        setCycleData(prev => ({
            ...prev,
            items: prev.items.filter(i => i.item_id !== itemId)
        }));
    };

    const getTypeLabel = (type) => itemTypes.find(t => t.value === type)?.label || type;
    const getStatusInfo = (status) => cycleStatuses.find(s => s.value === status) || cycleStatuses[0];

    const lowStockItems = items.filter(i => i.clean_count < i.min_stock);

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
                        <Shirt className="text-emerald-600" />
                        Lavanderia
                    </h1>
                    <p className="text-gray-600">Controle de estoque e ciclos de lavagem</p>
                </div>
                <div className="flex gap-2">
                    {canCreate('laundry') && (
                        <>
                            <button
                                onClick={() => setIsCycleModalOpen(true)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Play size={20} />
                                Iniciar Lavagem
                            </button>
                            <button
                                onClick={() => handleOpenModal()}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                <Plus size={20} />
                                Novo Item
                            </button>
                        </>
                    )}
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

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-700 font-medium mb-2">
                        <AlertTriangle size={20} />
                        Estoque Baixo
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStockItems.map(item => (
                            <span key={item.id} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                                {item.name}: {item.clean_count}/{item.min_stock}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('stock')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'stock'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    <Package className="inline mr-2" size={18} />
                    Estoque
                </button>
                <button
                    onClick={() => setActiveTab('cycles')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'cycles'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    <RefreshCw className="inline mr-2" size={18} />
                    Ciclos Ativos ({cycles.length})
                </button>
            </div>

            {/* Stock Tab */}
            {activeTab === 'stock' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => {
                        const isLowStock = item.clean_count < item.min_stock;

                        return (
                            <div
                                key={item.id}
                                className={`bg-white rounded-lg shadow p-4 ${isLowStock ? 'ring-2 ring-orange-300' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                        <span className="text-sm text-gray-500">{getTypeLabel(item.type)}</span>
                                    </div>
                                    {canEdit('laundry') && (
                                        <button
                                            onClick={() => handleOpenModal(item)}
                                            className="text-gray-400 hover:text-emerald-600"
                                        >
                                            Editar
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {/* Clean */}
                                    <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                                        <span className="text-green-700 font-medium">Limpos</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleUpdateCount(item.id, 'clean_count', -1)}
                                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                disabled={item.clean_count === 0}
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className={`font-bold text-lg ${isLowStock ? 'text-orange-600' : 'text-green-700'}`}>
                                                {item.clean_count}
                                            </span>
                                            <button
                                                onClick={() => handleUpdateCount(item.id, 'clean_count', 1)}
                                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Dirty */}
                                    <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                                        <span className="text-red-700 font-medium">Sujos</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleUpdateCount(item.id, 'dirty_count', -1)}
                                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                                disabled={item.dirty_count === 0}
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="font-bold text-lg text-red-700">{item.dirty_count}</span>
                                            <button
                                                onClick={() => handleUpdateCount(item.id, 'dirty_count', 1)}
                                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* In Wash */}
                                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                                        <span className="text-blue-700 font-medium">Lavando</span>
                                        <span className="font-bold text-lg text-blue-700">{item.in_wash_count}</span>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                                    Estoque mínimo: {item.min_stock}
                                </div>
                            </div>
                        );
                    })}

                    {items.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
                            <Shirt className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-500">Nenhum item cadastrado</p>
                        </div>
                    )}
                </div>
            )}

            {/* Cycles Tab */}
            {activeTab === 'cycles' && (
                <div className="space-y-4">
                    {cycles.map(cycle => {
                        const statusInfo = getStatusInfo(cycle.status);
                        const StatusIcon = statusInfo.icon;
                        const currentStatusIndex = cycleStatuses.findIndex(s => s.value === cycle.status);
                        const nextStatus = cycleStatuses[currentStatusIndex + 1];

                        return (
                            <div key={cycle.id} className="bg-white rounded-lg shadow p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${statusInfo.color}`}>
                                            <StatusIcon size={20} />
                                        </div>
                                        <div>
                                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Iniciado em {new Date(cycle.started_at).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                    {nextStatus && canEdit('laundry') && (
                                        <button
                                            onClick={() => handleUpdateCycleStatus(cycle.id, nextStatus.value)}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                        >
                                            <nextStatus.icon size={18} />
                                            Marcar como {nextStatus.label}
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {cycle.items.map((cycleItem, index) => {
                                        const item = items.find(i => i.id === cycleItem.item_id);
                                        return (
                                            <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                                {item?.name || 'Item'} x{cycleItem.quantity}
                                            </span>
                                        );
                                    })}
                                </div>

                                {cycle.notes && (
                                    <p className="mt-2 text-sm text-gray-600">
                                        Obs: {cycle.notes}
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {cycles.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-lg shadow">
                            <Droplets className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-500">Nenhum ciclo de lavagem ativo</p>
                        </div>
                    )}
                </div>
            )}

            {/* Item Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">
                                {editingItem ? 'Editar Item' : 'Novo Item'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                >
                                    {itemTypes.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                                <input
                                    type="number"
                                    value={formData.min_stock}
                                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    min="0"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                >
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cycle Modal */}
            {isCycleModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">Iniciar Ciclo de Lavagem</h2>
                            <button onClick={() => setIsCycleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <p className="text-gray-600 mb-4">Selecione os itens sujos para lavar:</p>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {items.filter(i => i.dirty_count > 0).map(item => {
                                    const cycleItem = cycleData.items.find(i => i.item_id === item.id);

                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <span className="font-medium">{item.name}</span>
                                                <span className="text-sm text-gray-500 ml-2">
                                                    ({item.dirty_count} sujos)
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {cycleItem ? (
                                                    <>
                                                        <button
                                                            onClick={() => setCycleData(prev => ({
                                                                ...prev,
                                                                items: prev.items.map(i =>
                                                                    i.item_id === item.id
                                                                        ? { ...i, quantity: Math.max(1, i.quantity - 1) }
                                                                        : i
                                                                )
                                                            }))}
                                                            className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                                                        >
                                                            <Minus size={16} />
                                                        </button>
                                                        <span className="w-8 text-center font-medium">{cycleItem.quantity}</span>
                                                        <button
                                                            onClick={() => setCycleData(prev => ({
                                                                ...prev,
                                                                items: prev.items.map(i =>
                                                                    i.item_id === item.id
                                                                        ? { ...i, quantity: Math.min(item.dirty_count, i.quantity + 1) }
                                                                        : i
                                                                )
                                                            }))}
                                                            className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                                                            disabled={cycleItem.quantity >= item.dirty_count}
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => removeItemFromCycle(item.id)}
                                                            className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => addItemToCycle(item.id)}
                                                        className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                                                    >
                                                        Adicionar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {items.filter(i => i.dirty_count > 0).length === 0 && (
                                    <p className="text-center text-gray-500 py-4">
                                        Nenhum item sujo disponível
                                    </p>
                                )}
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                                <textarea
                                    value={cycleData.notes}
                                    onChange={(e) => setCycleData({ ...cycleData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    rows={2}
                                    placeholder="Opcional..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                                <button
                                    onClick={() => setIsCycleModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleStartCycle}
                                    disabled={cycleData.items.length === 0}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <Play className="inline mr-2" size={18} />
                                    Iniciar Lavagem
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Laundry;
