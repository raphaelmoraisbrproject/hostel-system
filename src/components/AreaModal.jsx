import { useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AREA_TYPES = [
  { value: 'room', label: 'Quarto' },
  { value: 'bathroom', label: 'Banheiro' },
  { value: 'kitchen', label: 'Cozinha' },
  { value: 'common_area', label: 'Área Comum' },
  { value: 'service', label: 'Serviço' },
  { value: 'external', label: 'Externo' },
  { value: 'custom', label: 'Personalizado' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'maintenance', label: 'Em Manutenção' },
  { value: 'inactive', label: 'Inativo' },
];

const AreaModal = ({ isOpen, onClose, onSuccess, area }) => {
  const [formData, setFormData] = useState({
    selectedType: 'room',
    customName: '',
    selectedRoomId: '',
    floor: '',
    status: 'active',
    description: '',
  });
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState('');

  const isCustomType = formData.selectedType === 'custom';
  const isRoomType = formData.selectedType === 'room';

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, type, capacity, room_number')
        .eq('is_active', true)
        .order('room_number');

      if (error) throw error;
      setRooms(data || []);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (area) {
        const predefinedType = AREA_TYPES.find(t => t.value !== 'custom' && area.name.startsWith(t.label));
        const isCustom = !predefinedType && !area.room_id;

        setFormData({
          selectedType: area.room_id ? 'room' : (isCustom ? 'custom' : area.type),
          customName: isCustom ? area.name : '',
          selectedRoomId: area.room_id || '',
          floor: area.floor || '',
          status: area.is_active === false ? 'inactive' : 'active',
          description: '',
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, area]);

  const resetForm = () => {
    setFormData({
      selectedType: 'room',
      customName: '',
      selectedRoomId: '',
      floor: '',
      status: 'active',
      description: '',
    });
    setError('');
  };

  const handleRoomSelect = (roomId) => {
    setFormData(prev => ({
      ...prev,
      selectedRoomId: roomId,
    }));
  };

  const generateAreaName = () => {
    if (isCustomType) {
      return formData.customName;
    }

    if (isRoomType && formData.selectedRoomId) {
      const selectedRoom = rooms.find(r => r.id === formData.selectedRoomId);
      if (selectedRoom) {
        return `Quarto ${selectedRoom.room_number} - ${selectedRoom.name}`;
      }
    }

    const typeLabel = AREA_TYPES.find(t => t.value === formData.selectedType)?.label || '';
    const floorSuffix = formData.floor ? ` - Andar ${formData.floor}` : '';
    return `${typeLabel}${floorSuffix}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isCustomType && !formData.customName.trim()) {
      setError('Digite o nome da instalação personalizada');
      return;
    }

    if (isRoomType && !formData.selectedRoomId) {
      setError('Selecione um quarto');
      return;
    }

    setLoading(true);

    try {
      const areaName = generateAreaName();
      const areaType = isCustomType ? 'common_area' : formData.selectedType;

      const areaData = {
        name: areaName,
        type: areaType,
        floor: formData.floor || null,
        room_id: isRoomType ? formData.selectedRoomId : null,
        is_active: formData.status === 'active',
      };

      if (area) {
        const { error } = await supabase
          .from('areas')
          .update(areaData)
          .eq('id', area.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('areas')
          .insert(areaData);

        if (error) throw error;
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving area:', err);
      setError(err.message || 'Erro ao salvar área');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <MapPin size={20} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {area ? 'Editar Área' : 'Nova Área'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Instalação *
              </label>
              <select
                value={formData.selectedType}
                onChange={(e) => setFormData({ ...formData, selectedType: e.target.value, customName: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={!!area}
              >
                {AREA_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {area && (
                <p className="text-xs text-gray-500 mt-1">Tipo não pode ser alterado</p>
              )}
            </div>

            {/* Room selector - only shows when "Quarto" is selected */}
            {isRoomType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecione o Quarto *
                </label>
                {loadingRooms ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                    <span className="text-sm text-gray-500">Carregando quartos...</span>
                  </div>
                ) : rooms.length === 0 ? (
                  <p className="text-sm text-red-600 py-2">Nenhum quarto cadastrado. Cadastre quartos primeiro.</p>
                ) : (
                  <select
                    value={formData.selectedRoomId}
                    onChange={(e) => handleRoomSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    disabled={!!area}
                  >
                    <option value="">Selecione um quarto...</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        Quarto {room.room_number} - {room.name} ({room.capacity} camas)
                      </option>
                    ))}
                  </select>
                )}
                {area && (
                  <p className="text-xs text-gray-500 mt-1">Quarto não pode ser alterado</p>
                )}
              </div>
            )}

            {/* Custom Name - only shows when "Personalizado" is selected */}
            {isCustomType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Instalação *
                </label>
                <input
                  type="text"
                  value={formData.customName}
                  onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Ex: Lavanderia, Depósito, Recepção..."
                  required
                />
              </div>
            )}

            {/* Floor and Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Andar
                </label>
                <input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            {!area && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <strong>Nome da área:</strong> {generateAreaName() || 'Selecione um tipo'}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Salvando...
                  </>
                ) : (
                  area ? 'Salvar' : 'Criar Área'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AreaModal;
