import { useState, useEffect } from 'react';
import { X, MapPin, Plus, Trash2, GripVertical, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AREA_TYPES = [
  { value: 'bedroom', label: 'Quarto' },
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

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diária' },
  { value: 'on_checkout', label: 'No Checkout' },
  { value: 'weekly', label: 'Semanal' },
];

const AreaModal = ({ isOpen, onClose, onSuccess, area }) => {
  const [formData, setFormData] = useState({
    selectedType: 'bedroom',
    customName: '',
    selectedRoomId: '',
    floor: '',
    capacity: '',
    status: 'active',
    cleaning_frequency: 'on_checkout',
    description: '',
  });
  const [rooms, setRooms] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  const isCustomType = formData.selectedType === 'custom';
  const isBedroomType = formData.selectedType === 'bedroom';

  // Fetch rooms when modal opens
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
        // Determine if it's a custom type by checking if name doesn't match any predefined type
        const predefinedType = AREA_TYPES.find(t => t.value !== 'custom' && area.name.startsWith(t.label));
        const isCustom = !predefinedType && !area.room_id;

        setFormData({
          selectedType: area.room_id ? 'bedroom' : (isCustom ? 'custom' : area.type),
          customName: isCustom ? area.name : '',
          selectedRoomId: area.room_id || '',
          floor: area.floor || '',
          capacity: area.capacity || '',
          status: area.status || 'active',
          cleaning_frequency: area.cleaning_frequency || 'on_checkout',
          description: area.description || '',
        });
        fetchChecklistItems(area.id);
      } else {
        resetForm();
      }
    }
  }, [isOpen, area]);

  const resetForm = () => {
    setFormData({
      selectedType: 'bedroom',
      customName: '',
      selectedRoomId: '',
      floor: '',
      capacity: '',
      status: 'active',
      cleaning_frequency: 'on_checkout',
      description: '',
    });
    setChecklistItems([]);
    setNewItemText('');
    setError('');
    setActiveTab('info');
  };

  const handleRoomSelect = (roomId) => {
    const selectedRoom = rooms.find(r => r.id === roomId);
    if (selectedRoom) {
      setFormData(prev => ({
        ...prev,
        selectedRoomId: roomId,
        capacity: selectedRoom.capacity?.toString() || '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        selectedRoomId: '',
        capacity: '',
      }));
    }
  };

  const fetchChecklistItems = async (areaId) => {
    setLoadingChecklist(true);
    try {
      const { data, error } = await supabase
        .from('area_checklist_items')
        .select('*')
        .eq('area_id', areaId)
        .order('item_order');

      if (error) throw error;
      setChecklistItems(data || []);
    } catch (err) {
      console.error('Error fetching checklist items:', err);
    } finally {
      setLoadingChecklist(false);
    }
  };

  const generateAreaName = () => {
    if (isCustomType) {
      return formData.customName;
    }

    if (isBedroomType && formData.selectedRoomId) {
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

    if (isBedroomType && !formData.selectedRoomId) {
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
        description: formData.description || null,
        floor: formData.floor ? parseInt(formData.floor) : null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        status: formData.status,
        cleaning_frequency: formData.cleaning_frequency,
        room_id: isBedroomType ? formData.selectedRoomId : null,
      };

      let areaId = area?.id;

      if (area) {
        const { error } = await supabase
          .from('areas')
          .update(areaData)
          .eq('id', area.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('areas')
          .insert(areaData)
          .select('id')
          .single();

        if (error) throw error;
        areaId = data.id;

        // Copy template checklist items for new area (use common_area for custom)
        await supabase.rpc('copy_checklist_template_to_area', {
          p_area_id: areaId,
          p_area_type: areaType,
        });
      }

      if (area && checklistItems.length > 0) {
        for (const item of checklistItems) {
          if (item.id && !item.id.startsWith('new-')) {
            await supabase
              .from('area_checklist_items')
              .update({
                description: item.description,
                item_order: item.item_order,
                is_required: item.is_required,
                category: item.category,
              })
              .eq('id', item.id);
          }
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Error saving area:', err);
      setError(err.message || 'Erro ao salvar área');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newItemText.trim() || !area) return;

    try {
      const newOrder = checklistItems.length;
      const { data, error } = await supabase
        .from('area_checklist_items')
        .insert({
          area_id: area.id,
          description: newItemText.trim(),
          item_order: newOrder,
          is_required: true,
          category: 'cleaning',
        })
        .select()
        .single();

      if (error) throw error;

      setChecklistItems([...checklistItems, data]);
      setNewItemText('');
    } catch (err) {
      console.error('Error adding checklist item:', err);
      setError('Erro ao adicionar item');
    }
  };

  const handleRemoveChecklistItem = async (itemId) => {
    try {
      const { error } = await supabase
        .from('area_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setChecklistItems(checklistItems.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Error removing checklist item:', err);
      setError('Erro ao remover item');
    }
  };

  const handleToggleRequired = async (itemId, currentValue) => {
    try {
      const { error } = await supabase
        .from('area_checklist_items')
        .update({ is_required: !currentValue })
        .eq('id', itemId);

      if (error) throw error;

      setChecklistItems(checklistItems.map(item =>
        item.id === itemId ? { ...item, is_required: !currentValue } : item
      ));
    } catch (err) {
      console.error('Error updating checklist item:', err);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden animate-scaleIn">
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

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            disabled={!area}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'checklist'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
            } ${!area ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="flex items-center justify-center gap-2">
              <CheckSquare size={16} />
              Checklist {checklistItems.length > 0 && `(${checklistItems.length})`}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {activeTab === 'info' ? (
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
              {isBedroomType && (
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

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequência de Limpeza
                </label>
                <select
                  value={formData.cleaning_frequency}
                  onChange={(e) => setFormData({ ...formData, cleaning_frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {FREQUENCY_OPTIONS.map(freq => (
                    <option key={freq.value} value={freq.value}>{freq.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                  placeholder="Observações opcionais..."
                />
              </div>

              {/* Preview */}
              {!area && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    <strong>Nome da área:</strong> {generateAreaName() || 'Selecione um tipo'}
                  </p>
                </div>
              )}

              {/* Info about checklist */}
              {!area && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Um checklist padrão será adicionado automaticamente. Você poderá personalizá-lo depois.
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
          ) : (
            /* Checklist Tab */
            <div className="space-y-4">
              {loadingChecklist ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <>
                  {/* Add new item */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Novo item do checklist..."
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      disabled={!newItemText.trim()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Checklist items */}
                  {checklistItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckSquare size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>Nenhum item no checklist</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {checklistItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <GripVertical size={16} className="text-gray-400 cursor-move" />
                          <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                          <span className="flex-1 text-gray-700">{item.description}</span>
                          <button
                            onClick={() => handleToggleRequired(item.id, item.is_required)}
                            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                              item.is_required
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {item.is_required ? 'Obrigatório' : 'Opcional'}
                          </button>
                          <button
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                    <strong>Dica:</strong> Itens obrigatórios devem ser concluídos para finalizar uma tarefa de limpeza.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AreaModal;
