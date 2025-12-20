import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../contexts/PermissionsContext';
import { Plus, Edit2, Trash2, Search, MapPin, X, Home, Bath, Users, Wrench, TreeDeciduous } from 'lucide-react';

const Areas = () => {
    const { canCreate, canEdit, canDelete } = usePermissions();
    const [areas, setAreas] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        type: 'common',
        floor: '',
        room_id: '',
        cleaning_frequency: 'daily',
    });

    const typeOptions = [
        { value: 'room', label: 'Quarto', icon: Home },
        { value: 'bathroom', label: 'Banheiro', icon: Bath },
        { value: 'common', label: 'Área Comum', icon: Users },
        { value: 'service', label: 'Serviço', icon: Wrench },
        { value: 'external', label: 'Área Externa', icon: TreeDeciduous },
    ];

    const frequencyOptions = [
        { value: 'daily', label: 'Diária' },
        { value: 'checkout', label: 'Check-out' },
        { value: 'weekly', label: 'Semanal' },
        { value: 'monthly', label: 'Mensal' },
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [areasRes, roomsRes] = await Promise.all([
                supabase.from('areas').select('*').order('name'),
                supabase.from('rooms').select('id, name'),
            ]);

            if (areasRes.error) throw areasRes.error;
            if (roomsRes.error) throw roomsRes.error;

            setAreas(areasRes.data || []);
            setRooms(roomsRes.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (area = null) => {
        if (area) {
            setEditingArea(area);
            setFormData({
                name: area.name,
                type: area.type,
                floor: area.floor || '',
                room_id: area.room_id || '',
                cleaning_frequency: area.cleaning_frequency || 'daily',
            });
        } else {
            setEditingArea(null);
            setFormData({
                name: '',
                type: 'common',
                floor: '',
                room_id: '',
                cleaning_frequency: 'daily',
            });
        }
        setError('');
        setSuccess('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingArea(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const areaData = {
                name: formData.name,
                type: formData.type,
                floor: formData.floor || null,
                room_id: formData.room_id || null,
                cleaning_frequency: formData.cleaning_frequency,
            };

            if (editingArea) {
                const { error } = await supabase
                    .from('areas')
                    .update(areaData)
                    .eq('id', editingArea.id);

                if (error) throw error;
                setSuccess('Área atualizada com sucesso!');
            } else {
                const { error } = await supabase
                    .from('areas')
                    .insert(areaData);

                if (error) throw error;
                setSuccess('Área criada com sucesso!');
            }

            await fetchData();
            setTimeout(handleCloseModal, 1000);
        } catch (err) {
            console.error('Error saving area:', err);
            setError(err.message || 'Erro ao salvar área');
        }
    };

    const handleToggleActive = async (area) => {
        try {
            const { error } = await supabase
                .from('areas')
                .update({ is_active: !area.is_active })
                .eq('id', area.id);

            if (error) throw error;
            await fetchData();
        } catch (err) {
            console.error('Error toggling area status:', err);
            setError('Erro ao alterar status da área');
        }
    };

    const handleDelete = async (area) => {
        if (!confirm(`Excluir área "${area.name}"?`)) return;

        try {
            const { error } = await supabase
                .from('areas')
                .delete()
                .eq('id', area.id);

            if (error) throw error;
            await fetchData();
            setSuccess('Área excluída');
        } catch (err) {
            console.error('Error deleting area:', err);
            setError('Erro ao excluir área. Verifique se não há tarefas vinculadas.');
        }
    };

    const filteredAreas = areas.filter(area => {
        const matchesSearch = area.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || area.type === filterType;
        return matchesSearch && matchesType;
    });

    const getTypeInfo = (type) => typeOptions.find(t => t.value === type) || typeOptions[2];
    const getFrequencyLabel = (freq) => frequencyOptions.find(f => f.value === freq)?.label || freq;

    const getTypeColor = (type) => {
        const colors = {
            room: 'bg-blue-100 text-blue-700',
            bathroom: 'bg-cyan-100 text-cyan-700',
            common: 'bg-green-100 text-green-700',
            service: 'bg-orange-100 text-orange-700',
            external: 'bg-emerald-100 text-emerald-700',
        };
        return colors[type] || colors.common;
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
                        <MapPin className="text-emerald-600" />
                        Áreas do Hostel
                    </h1>
                    <p className="text-gray-600">Gerencie as áreas e locais do hostel</p>
                </div>
                {canCreate('areas') && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Plus size={20} />
                        Nova Área
                    </button>
                )}
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

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-64">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar áreas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="all">Todos os Tipos</option>
                    {typeOptions.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* Areas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAreas.map(area => {
                    const typeInfo = getTypeInfo(area.type);
                    const TypeIcon = typeInfo.icon;

                    return (
                        <div
                            key={area.id}
                            className={`bg-white rounded-lg shadow p-4 ${!area.is_active ? 'opacity-60' : ''}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${getTypeColor(area.type)}`}>
                                        <TypeIcon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{area.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(area.type)}`}>
                                            {typeInfo.label}
                                        </span>
                                    </div>
                                </div>
                                {!area.is_active && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        Inativa
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1 text-sm text-gray-600 mb-4">
                                {area.floor && (
                                    <p>Andar: {area.floor}</p>
                                )}
                                <p>Limpeza: {getFrequencyLabel(area.cleaning_frequency)}</p>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t">
                                <button
                                    onClick={() => handleToggleActive(area)}
                                    className={`text-xs px-3 py-1 rounded-full ${area.is_active
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {area.is_active ? 'Ativa' : 'Inativa'}
                                </button>
                                <div className="flex gap-2">
                                    {canEdit('areas') && (
                                        <button
                                            onClick={() => handleOpenModal(area)}
                                            className="p-2 text-gray-400 hover:text-emerald-600"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    )}
                                    {canDelete('areas') && (
                                        <button
                                            onClick={() => handleDelete(area)}
                                            className="p-2 text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredAreas.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <MapPin className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500">Nenhuma área encontrada</p>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">
                                {editingArea ? 'Editar Área' : 'Nova Área'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Ex: Cozinha, Banheiro Térreo, Quarto 101"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                >
                                    {typeOptions.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Andar</label>
                                <input
                                    type="text"
                                    value={formData.floor}
                                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Ex: Térreo, 1º Andar, Subsolo"
                                />
                            </div>

                            {formData.type === 'room' && rooms.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a Quarto</label>
                                    <select
                                        value={formData.room_id}
                                        onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="">Nenhum</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Frequência de Limpeza</label>
                                <select
                                    value={formData.cleaning_frequency}
                                    onChange={(e) => setFormData({ ...formData, cleaning_frequency: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                >
                                    {frequencyOptions.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
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
                                    {editingArea ? 'Salvar' : 'Criar Área'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Areas;
