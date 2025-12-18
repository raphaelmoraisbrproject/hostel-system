import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Bed,
    Users,
    Trash2,
    Edit,
    BedDouble,
    Home,
    User,
    X,
    ChevronDown,
    ChevronUp,
    Wrench,
    CheckCircle,
    XCircle,
    Crown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConfirmationModal from '../components/ConfirmationModal';

const ROOM_TYPES = [
    { value: 'Dorm', label: 'Dormitório', icon: Users, color: 'blue', description: 'Quarto compartilhado - reserva por cama' },
    { value: 'Private', label: 'Privativo', icon: User, color: 'purple', description: 'Quarto individual para 1 pessoa' },
    { value: 'Double', label: 'Matrimonial', icon: BedDouble, color: 'pink', description: 'Quarto com cama de casal' },
    { value: 'Family', label: 'Familiar', icon: Home, color: 'green', description: 'Quarto para família - múltiplas camas' },
    { value: 'Suite', label: 'Suíte', icon: Crown, color: 'amber', description: 'Quarto premium com amenidades extras' },
];

const GENDER_OPTIONS = [
    { value: 'Mixed', label: 'Misto' },
    { value: 'Female', label: 'Feminino' },
    { value: 'Male', label: 'Masculino' },
];

const BED_TYPES = [
    { value: 'Single', label: 'Solteiro' },
    { value: 'Double', label: 'Casal' },
    { value: 'Queen', label: 'Queen' },
    { value: 'King', label: 'King' },
    { value: 'Bunk', label: 'Beliche' },
];

const BED_STATUS_CONFIG = {
    'Active': { label: 'Disponível', color: 'green', icon: CheckCircle },
    'Maintenance': { label: 'Manutenção', color: 'yellow', icon: Wrench },
    'Out of Service': { label: 'Fora de Serviço', color: 'red', icon: XCircle },
};

const Rooms = () => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [beds, setBeds] = useState({});
    const [loading, setLoading] = useState(true);
    const [expandedRooms, setExpandedRooms] = useState({});
    const [filterType, setFilterType] = useState('all');
    const [deleteModal, setDeleteModal] = useState({ open: false, room: null });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'Dorm',
        capacity: 4,
        price_per_night: '',
        description: '',
        gender_restriction: 'Mixed',
        bed_type: 'Single',
        room_number: '',
        is_active: true,
    });

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('*')
                .is('deleted_at', null)
                .order('name');

            if (roomsError) throw roomsError;

            const { data: bedsData, error: bedsError } = await supabase
                .from('beds')
                .select('*')
                .is('deleted_at', null);

            if (bedsError) throw bedsError;

            // Agrupar camas por room_id
            const bedsGrouped = bedsData.reduce((acc, bed) => {
                if (!acc[bed.room_id]) acc[bed.room_id] = [];
                acc[bed.room_id].push(bed);
                return acc;
            }, {});

            setRooms(roomsData || []);
            setBeds(bedsGrouped);
        } catch (error) {
            console.error('Error fetching rooms:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'Dorm',
            capacity: 4,
            price_per_night: '',
            description: '',
            gender_restriction: 'Mixed',
            bed_type: 'Single',
            floor: 1,
            room_number: '',
            is_active: true,
        });
        setIsEditMode(false);
        setSelectedRoom(null);
    };

    const openAddModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (room) => {
        setFormData({
            name: room.name || '',
            type: room.type || 'Dorm',
            capacity: room.capacity || 4,
            price_per_night: room.price_per_night || '',
            description: room.description || '',
            gender_restriction: room.gender_restriction || 'Mixed',
            bed_type: room.bed_type || 'Single',
            room_number: room.room_number || '',
            is_active: room.is_active !== false,
        });
        setSelectedRoom(room);
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const roomPayload = {
                name: formData.name,
                type: formData.type,
                capacity: parseInt(formData.capacity),
                price_per_night: parseFloat(formData.price_per_night),
                description: formData.description || null,
                gender_restriction: formData.type === 'Dorm' ? formData.gender_restriction : null,
                bed_type: formData.type !== 'Dorm' ? formData.bed_type : null,
                room_number: formData.room_number || null,
                is_active: formData.is_active,
            };

            if (isEditMode && selectedRoom) {
                // Atualizar quarto existente
                const { error } = await supabase
                    .from('rooms')
                    .update(roomPayload)
                    .eq('id', selectedRoom.id);

                if (error) throw error;

                // Se mudou a capacidade do dormitório, ajustar camas
                if (formData.type === 'Dorm') {
                    const currentBeds = beds[selectedRoom.id] || [];
                    const newCapacity = parseInt(formData.capacity);

                    if (newCapacity > currentBeds.length) {
                        // Adicionar camas
                        const newBeds = Array.from({ length: newCapacity - currentBeds.length }).map((_, i) => ({
                            room_id: selectedRoom.id,
                            bed_number: `${currentBeds.length + i + 1}`,
                            status: 'Active'
                        }));
                        await supabase.from('beds').insert(newBeds);
                    } else if (newCapacity < currentBeds.length) {
                        // Remover camas excedentes (soft delete)
                        const bedsToRemove = currentBeds.slice(newCapacity);
                        for (const bed of bedsToRemove) {
                            await supabase.from('beds').update({ deleted_at: new Date().toISOString() }).eq('id', bed.id);
                        }
                    }
                }
            } else {
                // Criar novo quarto
                const { data: room, error: roomError } = await supabase
                    .from('rooms')
                    .insert([roomPayload])
                    .select()
                    .single();

                if (roomError) throw roomError;

                // Criar camas se for dormitório
                if (formData.type === 'Dorm' && room) {
                    const bedsToCreate = Array.from({ length: parseInt(formData.capacity) }).map((_, i) => ({
                        room_id: room.id,
                        bed_number: `${i + 1}`,
                        status: 'Active'
                    }));

                    const { error: bedsError } = await supabase.from('beds').insert(bedsToCreate);
                    if (bedsError) throw bedsError;
                }
            }

            fetchRooms();
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            alert('Erro ao salvar quarto: ' + error.message);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.room) return;

        try {
            // Soft delete
            const { error } = await supabase
                .from('rooms')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', deleteModal.room.id);

            if (error) throw error;

            // Soft delete das camas associadas
            await supabase
                .from('beds')
                .update({ deleted_at: new Date().toISOString() })
                .eq('room_id', deleteModal.room.id);

            fetchRooms();
            setDeleteModal({ open: false, room: null });
        } catch (error) {
            alert('Erro ao deletar quarto: ' + error.message);
        }
    };

    const toggleRoomExpand = (roomId) => {
        setExpandedRooms(prev => ({
            ...prev,
            [roomId]: !prev[roomId]
        }));
    };

    const updateBedStatus = async (bedId, newStatus) => {
        try {
            const { error } = await supabase
                .from('beds')
                .update({ status: newStatus })
                .eq('id', bedId);

            if (error) throw error;
            fetchRooms();
        } catch (error) {
            alert('Erro ao atualizar status da cama: ' + error.message);
        }
    };

    const getRoomTypeConfig = (type) => {
        return ROOM_TYPES.find(t => t.value === type) || ROOM_TYPES[0];
    };

    const filteredRooms = filterType === 'all'
        ? rooms
        : rooms.filter(r => r.type === filterType);

    const getColorClasses = (color) => {
        const colors = {
            blue: 'bg-blue-100 text-blue-600 border-blue-200',
            purple: 'bg-purple-100 text-purple-600 border-purple-200',
            pink: 'bg-pink-100 text-pink-600 border-pink-200',
            green: 'bg-green-100 text-green-600 border-green-200',
            amber: 'bg-amber-100 text-amber-600 border-amber-200',
        };
        return colors[color] || colors.blue;
    };

    const getStatusColorClasses = (status) => {
        const config = BED_STATUS_CONFIG[status] || BED_STATUS_CONFIG['Active'];
        const colors = {
            green: 'bg-green-100 text-green-700 border-green-300',
            yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
            red: 'bg-red-100 text-red-700 border-red-300',
        };
        return colors[config.color] || colors.green;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('rooms')}</h1>
                    <p className="text-gray-500">Gerencie quartos e camas do seu hostel</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} />
                    Novo Quarto
                </button>
            </div>

            {/* Filtros por tipo */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterType === 'all'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    Todos ({rooms.length})
                </button>
                {ROOM_TYPES.map((type) => {
                    const count = rooms.filter(r => r.type === type.value).length;
                    const Icon = type.icon;
                    return (
                        <button
                            key={type.value}
                            onClick={() => setFilterType(type.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                filterType === type.value
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <Icon size={16} />
                            {type.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Lista de Quartos */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">Carregando quartos...</div>
            ) : filteredRooms.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Bed size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Nenhum quarto encontrado</p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        Adicionar primeiro quarto
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredRooms.map((room) => {
                        const typeConfig = getRoomTypeConfig(room.type);
                        const Icon = typeConfig.icon;
                        const roomBeds = beds[room.id] || [];
                        const isExpanded = expandedRooms[room.id];
                        const activeBeds = roomBeds.filter(b => b.status === 'Active').length;

                        return (
                            <div
                                key={room.id}
                                className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all ${
                                    !room.is_active ? 'opacity-60' : ''
                                }`}
                            >
                                {/* Header do Card */}
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${getColorClasses(typeConfig.color)}`}>
                                            <Icon size={24} />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {!room.is_active && (
                                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full mr-2">
                                                    Inativo
                                                </span>
                                            )}
                                            <button
                                                onClick={() => openEditModal(room)}
                                                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-gray-50 rounded-lg transition-colors"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteModal({ open: true, room })}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="text-lg font-bold text-gray-900">{room.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${getColorClasses(typeConfig.color)}`}>
                                                {typeConfig.label}
                                            </span>
                                            {room.type === 'Dorm' && room.gender_restriction && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                    {GENDER_OPTIONS.find(g => g.value === room.gender_restriction)?.label || room.gender_restriction}
                                                </span>
                                            )}
                                        </div>
                                        {room.description && (
                                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{room.description}</p>
                                        )}
                                    </div>

                                    {/* Info do Quarto */}
                                    <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5 text-gray-600">
                                                {room.type === 'Dorm' ? (
                                                    <>
                                                        <Bed size={16} />
                                                        <span>{activeBeds}/{room.capacity} camas</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Users size={16} />
                                                        <span>{room.capacity} {room.capacity === 1 ? 'hóspede' : 'hóspedes'}</span>
                                                    </>
                                                )}
                                            </div>
                                            {room.type !== 'Dorm' && room.bed_type && (
                                                <span className="text-gray-400 text-xs">
                                                    Cama {BED_TYPES.find(b => b.value === room.bed_type)?.label || room.bed_type}
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-bold text-emerald-600">
                                            R$ {parseFloat(room.price_per_night).toFixed(2)}
                                            <span className="text-gray-400 font-normal text-xs">/noite</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Seção de Camas (apenas para Dormitórios) */}
                                {room.type === 'Dorm' && roomBeds.length > 0 && (
                                    <div className="border-t border-gray-100">
                                        <button
                                            onClick={() => toggleRoomExpand(room.id)}
                                            className="w-full px-5 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Bed size={16} />
                                                Ver camas ({roomBeds.length})
                                            </span>
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>

                                        {isExpanded && (
                                            <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {roomBeds.sort((a, b) => parseInt(a.bed_number) - parseInt(b.bed_number)).map((bed) => {
                                                    const statusConfig = BED_STATUS_CONFIG[bed.status] || BED_STATUS_CONFIG['Active'];
                                                    const StatusIcon = statusConfig.icon;

                                                    return (
                                                        <div
                                                            key={bed.id}
                                                            className={`p-2 rounded-lg border text-center ${getStatusColorClasses(bed.status)}`}
                                                        >
                                                            <div className="flex items-center justify-center gap-1 text-xs font-medium">
                                                                <StatusIcon size={12} />
                                                                Cama {bed.bed_number}
                                                            </div>
                                                            <select
                                                                value={bed.status}
                                                                onChange={(e) => updateBedStatus(bed.id, e.target.value)}
                                                                className="mt-1 w-full text-xs bg-transparent border-0 p-0 text-center cursor-pointer focus:ring-0"
                                                            >
                                                                <option value="Active">Disponível</option>
                                                                <option value="Maintenance">Manutenção</option>
                                                                <option value="Out of Service">Fora de Serviço</option>
                                                            </select>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Adicionar/Editar */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="text-xl font-bold">
                                {isEditMode ? 'Editar Quarto' : 'Novo Quarto'}
                            </h2>
                            <button
                                onClick={() => { setIsModalOpen(false); resetForm(); }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-5">
                            {/* Tipo de Quarto */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Quarto</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {ROOM_TYPES.map((type) => {
                                        const Icon = type.icon;
                                        return (
                                            <button
                                                key={type.value}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                                    formData.type === type.value
                                                        ? 'border-emerald-500 bg-emerald-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <Icon size={20} className={`mx-auto mb-1 ${formData.type === type.value ? 'text-emerald-600' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium ${formData.type === type.value ? 'text-emerald-700' : 'text-gray-600'}`}>
                                                    {type.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {ROOM_TYPES.find(t => t.value === formData.type)?.description}
                                </p>
                            </div>

                            {/* Nome e Número */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Quarto *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="Ex: Dormitório Vista Mar"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Número/Código</label>
                                    <input
                                        type="text"
                                        value={formData.room_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, room_number: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="Ex: 101"
                                    />
                                </div>
                            </div>

                            {/* Capacidade e Preço */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {formData.type === 'Dorm' ? 'Nº de Camas *' : 'Capacidade *'}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.capacity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                                        required
                                        min="1"
                                        max="20"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Preço/Noite (R$) *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.price_per_night}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price_per_night: e.target.value }))}
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Opções específicas por tipo */}
                            {formData.type === 'Dorm' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Restrição de Gênero</label>
                                    <select
                                        value={formData.gender_restriction}
                                        onChange={(e) => setFormData(prev => ({ ...prev, gender_restriction: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        {GENDER_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {formData.type !== 'Dorm' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cama</label>
                                    <select
                                        value={formData.bed_type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, bed_type: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        {BED_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Descrição */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Detalhes do quarto, amenidades, etc."
                                />
                            </div>

                            {/* Status Ativo */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                />
                                <label htmlFor="is_active" className="text-sm text-gray-700">
                                    Quarto ativo e disponível para reservas
                                </label>
                            </div>

                            {/* Botões */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); resetForm(); }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    {isEditMode ? 'Salvar Alterações' : 'Criar Quarto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Delete */}
            <ConfirmationModal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, room: null })}
                onConfirm={handleDelete}
                title="Excluir Quarto"
                message={`Tem certeza que deseja excluir o quarto "${deleteModal.room?.name}"? Esta ação irá remover também todas as camas associadas.`}
                confirmText="Excluir"
                confirmStyle="danger"
            />
        </div>
    );
};

export default Rooms;
