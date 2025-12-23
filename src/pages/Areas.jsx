import { useState, useEffect } from 'react';
import { MapPin, Plus, Search, Building2, Bath, ChefHat, Sofa, Wrench, Trees, Edit2, Trash2, BedDouble, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AreaModal from '../components/AreaModal';
import ConfirmModal from '../components/ConfirmModal';

const AREA_TYPES = {
  room: { label: 'Quarto', icon: Building2, color: 'bg-blue-100 text-blue-600' },
  bathroom: { label: 'Banheiro', icon: Bath, color: 'bg-cyan-100 text-cyan-600' },
  kitchen: { label: 'Cozinha', icon: ChefHat, color: 'bg-orange-100 text-orange-600' },
  common_area: { label: 'Área Comum', icon: Sofa, color: 'bg-purple-100 text-purple-600' },
  service: { label: 'Serviço', icon: Wrench, color: 'bg-gray-100 text-gray-600' },
  external: { label: 'Externo', icon: Trees, color: 'bg-green-100 text-green-600' },
};

const STATUS_LABELS = {
  active: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  maintenance: { label: 'Manutenção', color: 'bg-yellow-100 text-yellow-800' },
  inactive: { label: 'Inativo', color: 'bg-red-100 text-red-800' },
};

const Areas = () => {
  const [areas, setAreas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    loading: false,
  });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch areas and rooms in parallel
      const [areasRes, roomsRes] = await Promise.all([
        supabase
          .from('areas')
          .select('*, rooms(name, room_number, capacity), auto_checkout_task')
          .order('name'),
        supabase
          .from('rooms')
          .select('id, name, room_number, capacity, type, is_active')
          .eq('is_active', true)
          .order('room_number'),
      ]);

      if (areasRes.error) throw areasRes.error;
      if (roomsRes.error) throw roomsRes.error;

      setAreas(areasRes.data || []);
      setRooms(roomsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setMessage({ type: 'error', text: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  // Combine areas with rooms that don't have areas yet
  const getAllAreas = () => {
    const areasWithRoomIds = new Set(areas.filter(a => a.room_id).map(a => a.room_id));

    // Rooms without corresponding areas (virtual areas)
    const virtualAreas = rooms
      .filter(room => !areasWithRoomIds.has(room.id))
      .map(room => ({
        id: `room-${room.id}`,
        room_id: room.id,
        name: `Quarto ${room.room_number} - ${room.name}`,
        type: 'room',
        is_active: room.is_active,
        capacity: room.capacity,
        isVirtual: true, // Flag to indicate this is auto-generated from room
        originalRoom: room,
      }));

    return [...areas.map(a => ({ ...a, isVirtual: false })), ...virtualAreas];
  };

  const handleAddArea = () => {
    setSelectedArea(null);
    setIsModalOpen(true);
  };

  const handleEditArea = (area) => {
    if (area.isVirtual) {
      // For virtual areas, open modal to create a real area from room
      setSelectedArea(null);
      setIsModalOpen(true);
    } else {
      setSelectedArea(area);
      setIsModalOpen(true);
    }
  };

  const handleDeleteArea = (area) => {
    if (area.isVirtual) return; // Can't delete virtual areas

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Área',
      message: `Tem certeza que deseja excluir "${area.name}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const { error } = await supabase
            .from('areas')
            .delete()
            .eq('id', area.id);

          if (error) throw error;

          setMessage({ type: 'success', text: 'Área excluída com sucesso!' });
          fetchData();
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
        } catch (err) {
          console.error('Error deleting area:', err);
          setMessage({ type: 'error', text: 'Erro ao excluir área' });
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  const handleModalSuccess = () => {
    setMessage({ type: 'success', text: selectedArea ? 'Área atualizada!' : 'Área criada!' });
    fetchData();
    setIsModalOpen(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleToggleAutoTask = async (area) => {
    try {
      const newValue = area.auto_checkout_task === false ? true : false;
      const { error } = await supabase
        .from('areas')
        .update({ auto_checkout_task: newValue })
        .eq('id', area.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: newValue ? 'Tarefa automática ativada' : 'Tarefa automática desativada'
      });
      fetchData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error toggling auto task:', err);
      setMessage({ type: 'error', text: 'Erro ao atualizar configuração' });
    }
  };

  const allAreas = getAllAreas();

  const filteredAreas = allAreas.filter(area => {
    const matchesSearch = area.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || area.type === filterType;
    return matchesSearch && matchesType;
  });

  const getAreaTypeInfo = (type) => AREA_TYPES[type] || AREA_TYPES.room;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <MapPin size={24} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Áreas</h1>
            <p className="text-gray-500">Gerencie as áreas do hostel</p>
          </div>
        </div>
        <button
          onClick={handleAddArea}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={18} />
          Nova Área
        </button>
      </div>

      {/* Feedback Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar áreas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="all">Todos os tipos</option>
          {Object.entries(AREA_TYPES).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Areas Grid */}
      {filteredAreas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma área encontrada</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterType !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Comece cadastrando as áreas do seu hostel'}
          </p>
          {!searchTerm && filterType === 'all' && (
            <button
              onClick={handleAddArea}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus size={18} />
              Cadastrar primeira área
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAreas.map((area) => {
            const typeInfo = getAreaTypeInfo(area.type);
            const IconComponent = typeInfo.icon;
            const statusInfo = area.is_active !== false ? STATUS_LABELS.active : STATUS_LABELS.inactive;

            return (
              <div
                key={area.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
                  area.isVirtual ? 'border-dashed border-blue-200' : 'border-gray-100'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                      <IconComponent size={20} />
                    </div>
                    <div className="flex items-center gap-2">
                      {area.isVirtual && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600">
                          Auto
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1">{area.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{typeInfo.label}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    {area.floor && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        Andar {area.floor}
                      </span>
                    )}
                    {(area.capacity || area.rooms?.capacity) && (
                      <span className="flex items-center gap-1">
                        <BedDouble size={14} />
                        {area.capacity || area.rooms?.capacity} camas
                      </span>
                    )}
                  </div>

                  {/* Toggle for auto checkout task - only for room type areas */}
                  {area.type === 'room' && !area.isVirtual && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                      <ClipboardCheck size={16} className="text-gray-400" />
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={area.auto_checkout_task !== false}
                          onChange={() => handleToggleAutoTask(area)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-600">
                          Auto-criar tarefa no checkout
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-sm text-gray-500">
                      {area.isVirtual ? (
                        <span className="text-blue-600">Carregado do quarto</span>
                      ) : (
                        <span>Área cadastrada</span>
                      )}
                    </div>
                    {!area.isVirtual && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditArea(area)}
                          className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Editar área"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteArea(area)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir área"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {allAreas.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-gray-600">
              <strong>{allAreas.length}</strong> áreas total
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              <strong>{areas.length}</strong> cadastradas
            </span>
            <span className="text-gray-600">
              <strong>{allAreas.filter(a => a.isVirtual).length}</strong> de quartos
            </span>
          </div>
        </div>
      )}

      {/* Area Modal */}
      <AreaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        area={selectedArea}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmButtonColor="red"
        loading={confirmModal.loading}
      />
    </div>
  );
};

export default Areas;
