import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import {
    Plus, Search, Filter, Calendar, Clock, User, MapPin,
    CheckCircle, Circle, AlertCircle, X, Edit2, Trash2
} from 'lucide-react';

const Tasks = () => {
    const { profile } = useAuth();
    const { canCreate, canEdit, canDelete } = usePermissions();
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [areas, setAreas] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        area_id: '',
        type: 'manual',
        priority: 'normal',
        assigned_to: '',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '',
        checklist_items: [],
    });

    const statusOptions = [
        { value: 'pending', label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'in_progress', label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
        { value: 'completed', label: 'Concluída', color: 'bg-green-100 text-green-800' },
        { value: 'cancelled', label: 'Cancelada', color: 'bg-gray-100 text-gray-800' },
    ];

    const priorityOptions = [
        { value: 'low', label: 'Baixa', color: 'bg-gray-100 text-gray-600' },
        { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-600' },
        { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-600' },
        { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-600' },
    ];

    const typeOptions = [
        { value: 'checkout', label: 'Check-out' },
        { value: 'daily', label: 'Diária' },
        { value: 'weekly', label: 'Semanal' },
        { value: 'manual', label: 'Manual' },
        { value: 'urgent', label: 'Urgente' },
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tasksRes, usersRes, areasRes, roomsRes] = await Promise.all([
                supabase
                    .from('tasks')
                    .select(`
                        *,
                        assigned_user:profiles!tasks_assigned_to_fkey(id, full_name),
                        area:areas(id, name, room_id),
                        bed:beds(id, bed_number)
                    `)
                    .order('due_date', { ascending: true }),
                supabase.from('profiles').select('id, full_name, role').eq('is_active', true),
                supabase.from('areas').select('id, name, type, room_id').eq('is_active', true),
                supabase.from('rooms').select('id, name, room_number, type').eq('is_active', true).order('room_number'),
            ]);

            if (tasksRes.error) {
                console.error('Tasks query error:', tasksRes.error);
                throw tasksRes.error;
            }
            if (usersRes.error) {
                console.error('Users query error:', usersRes.error);
                throw usersRes.error;
            }
            if (areasRes.error) {
                console.error('Areas query error:', areasRes.error);
                throw areasRes.error;
            }
            if (roomsRes.error) {
                console.error('Rooms query error:', roomsRes.error);
                throw roomsRes.error;
            }

            setTasks(tasksRes.data || []);
            setUsers(usersRes.data || []);
            setAreas(areasRes.data || []);
            setRooms(roomsRes.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (task = null) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description || '',
                area_id: task.area_id || '',
                type: task.type,
                priority: task.priority,
                assigned_to: task.assigned_to || '',
                due_date: task.due_date,
                due_time: task.due_time || '',
                checklist_items: task.checklist_items || [],
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: '',
                description: '',
                area_id: '',
                type: 'manual',
                priority: 'normal',
                assigned_to: '',
                due_date: new Date().toISOString().split('T')[0],
                due_time: '',
                checklist_items: [],
            });
        }
        setError('');
        setSuccess('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTask(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            let areaId = formData.area_id || null;

            // If a virtual area (room) was selected, create a real area first
            if (areaId && areaId.startsWith('room-')) {
                const roomId = areaId.replace('room-', '');
                const selectedRoom = rooms.find(r => r.id === roomId);

                if (selectedRoom) {
                    // Create a real area for this room
                    const { data: newArea, error: areaError } = await supabase
                        .from('areas')
                        .insert({
                            name: `Quarto ${selectedRoom.room_number} - ${selectedRoom.name}`,
                            type: 'room',
                            room_id: roomId,
                            is_active: true,
                        })
                        .select('id')
                        .single();

                    if (areaError) throw areaError;
                    areaId = newArea.id;
                }
            }

            const taskData = {
                title: formData.title,
                description: formData.description || null,
                area_id: areaId,
                type: formData.type,
                priority: formData.priority,
                assigned_to: formData.assigned_to || null,
                due_date: ['daily', 'checkout'].includes(formData.type) ? null : formData.due_date,
                due_time: ['daily', 'checkout'].includes(formData.type) ? null : (formData.due_time || null),
                checklist_items: formData.checklist_items,
            };

            if (editingTask) {
                const { error } = await supabase
                    .from('tasks')
                    .update({ ...taskData, updated_at: new Date().toISOString() })
                    .eq('id', editingTask.id);

                if (error) throw error;
                setSuccess('Tarefa atualizada com sucesso!');
            } else {
                const { error } = await supabase
                    .from('tasks')
                    .insert({
                        ...taskData,
                        status: 'pending',
                        created_by: profile?.id,
                    });

                if (error) throw error;
                setSuccess('Tarefa criada com sucesso!');
            }

            await fetchData();
            setTimeout(handleCloseModal, 1000);
        } catch (err) {
            console.error('Error saving task:', err);
            setError(err.message || 'Erro ao salvar tarefa');
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const updateData = {
                status: newStatus,
                updated_at: new Date().toISOString(),
            };

            if (newStatus === 'completed') {
                updateData.completed_at = new Date().toISOString();
                updateData.completed_by = profile?.id;
            }

            const { error } = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId);

            if (error) throw error;
            await fetchData();
        } catch (err) {
            console.error('Error updating status:', err);
            setError('Erro ao atualizar status');
        }
    };

    const handleDelete = async (task) => {
        if (!confirm(`Excluir tarefa "${task.title}"?`)) return;

        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', task.id);

            if (error) throw error;
            await fetchData();
            setSuccess('Tarefa excluída');
        } catch (err) {
            console.error('Error deleting task:', err);
            setError('Erro ao excluir tarefa');
        }
    };

    const addChecklistItem = () => {
        setFormData(prev => ({
            ...prev,
            checklist_items: [...prev.checklist_items, { text: '', done: false }]
        }));
    };

    const updateChecklistItem = (index, text) => {
        setFormData(prev => ({
            ...prev,
            checklist_items: prev.checklist_items.map((item, i) =>
                i === index ? { ...item, text } : item
            )
        }));
    };

    const removeChecklistItem = (index) => {
        setFormData(prev => ({
            ...prev,
            checklist_items: prev.checklist_items.filter((_, i) => i !== index)
        }));
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch =
            task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
        const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
        return matchesSearch && matchesStatus && matchesPriority;
    });

    const getStatusInfo = (status) => statusOptions.find(s => s.value === status) || statusOptions[0];
    const getPriorityInfo = (priority) => priorityOptions.find(p => p.value === priority) || priorityOptions[1];

    // Combine registered areas with rooms that don't have areas
    const getAllAreas = () => {
        const areasWithRoomIds = new Set(areas.filter(a => a.room_id).map(a => a.room_id));

        // Rooms without corresponding areas (virtual areas)
        const virtualAreas = rooms
            .filter(room => !areasWithRoomIds.has(room.id))
            .map(room => ({
                id: `room-${room.id}`,
                name: `Quarto ${room.room_number} - ${room.name}`,
                type: 'room',
                isVirtual: true,
            }));

        return [...areas, ...virtualAreas];
    };

    const allAreas = getAllAreas();

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
                    <h1 className="text-2xl font-bold text-gray-900">Todas as Tarefas</h1>
                    <p className="text-gray-600">Gerencie as tarefas de todos os colaboradores</p>
                </div>
                {canCreate('tasks') && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Plus size={20} />
                        Nova Tarefa
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
                            placeholder="Buscar tarefas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="all">Todos os Status</option>
                    {statusOptions.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
                <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="all">Todas as Prioridades</option>
                    {priorityOptions.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                {filteredTasks.map(task => {
                    const statusInfo = getStatusInfo(task.status);
                    const priorityInfo = getPriorityInfo(task.priority);
                    const isOverdue = task.due_date && !['daily', 'checkout'].includes(task.type) && new Date(task.due_date) < new Date() && task.status !== 'completed';

                    return (
                        <div
                            key={task.id}
                            className={`bg-white rounded-lg shadow p-4 border-l-4 ${isOverdue ? 'border-red-500' : task.status === 'completed' ? 'border-green-500' : 'border-emerald-500'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                    {/* Checkbox for quick completion */}
                                    <input
                                        type="checkbox"
                                        checked={task.status === 'completed'}
                                        onChange={() => handleStatusChange(
                                            task.id,
                                            task.status === 'completed' ? 'pending' : 'completed'
                                        )}
                                        disabled={!canEdit('tasks')}
                                        className="mt-1 w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className={`font-semibold transition-all ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                {task.title}
                                            </h3>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityInfo.color}`}>
                                            {priorityInfo.label}
                                        </span>
                                    </div>

                                    {task.description && (
                                        <p className="text-gray-600 text-sm mb-2">{task.description}</p>
                                    )}

                                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                        {task.area && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={14} />
                                                {task.area.name}
                                                {task.bed && ` - Cama ${task.bed.bed_number}`}
                                            </span>
                                        )}
                                        {task.type === 'daily' ? (
                                            <span className="flex items-center gap-1 text-blue-600">
                                                <Calendar size={14} />
                                                Recorrente diária
                                            </span>
                                        ) : task.type === 'checkout' ? (
                                            <span className="flex items-center gap-1 text-orange-600">
                                                <Calendar size={14} />
                                                Gerada no check-out
                                            </span>
                                        ) : task.due_date && (
                                            <>
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={14} />
                                                    {new Date(task.due_date).toLocaleDateString('pt-BR')}
                                                </span>
                                                {task.due_time && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {task.due_time}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {task.assigned_user && (
                                            <span className="flex items-center gap-1">
                                                <User size={14} />
                                                {task.assigned_user.full_name}
                                            </span>
                                        )}
                                    </div>

                                        {/* Checklist Preview */}
                                        {task.checklist_items?.length > 0 && (
                                            <div className="mt-2 text-sm text-gray-500">
                                                {task.checklist_items.filter(i => i.done).length} / {task.checklist_items.length} itens concluídos
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {task.status !== 'completed' && canEdit('tasks') && (
                                        <select
                                            value={task.status}
                                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                            className="text-sm border border-gray-300 rounded px-2 py-1"
                                        >
                                            {statusOptions.filter(s => s.value !== 'cancelled').map(s => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    )}
                                    {canEdit('tasks') && (
                                        <button
                                            onClick={() => handleOpenModal(task)}
                                            className="p-2 text-gray-400 hover:text-emerald-600"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    )}
                                    {canDelete('tasks') && (
                                        <button
                                            onClick={() => handleDelete(task)}
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

                {filteredTasks.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg shadow">
                        <p className="text-gray-500">Nenhuma tarefa encontrada</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 my-8">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-semibold">
                                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    >
                                        {priorityOptions.map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Área / Quarto</label>
                                <select
                                    value={formData.area_id}
                                    onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">Selecione uma área</option>
                                    {allAreas.map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}{a.isVirtual ? ' (Quarto)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                                <select
                                    value={formData.assigned_to}
                                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value="">Sem responsável</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Date/Time - Hidden for daily and checkout tasks */}
                            {!['daily', 'checkout'].includes(formData.type) ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                                        <input
                                            type="date"
                                            value={formData.due_date}
                                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                                        <input
                                            type="time"
                                            value={formData.due_time}
                                            onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>
                            ) : formData.type === 'daily' ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-sm text-blue-700">
                                        Tarefas diárias são recorrentes e aparecem todos os dias automaticamente.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                    <p className="text-sm text-orange-700">
                                        Tarefas de check-out são geradas automaticamente quando um hóspede faz check-out.
                                    </p>
                                </div>
                            )}

                            {/* Checklist */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Checklist</label>
                                    <button
                                        type="button"
                                        onClick={addChecklistItem}
                                        className="text-sm text-emerald-600 hover:text-emerald-700"
                                    >
                                        + Adicionar item
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.checklist_items.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item.text}
                                                onChange={(e) => updateChecklistItem(index, e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                placeholder="Item do checklist"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeChecklistItem(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
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
                                    {editingTask ? 'Salvar' : 'Criar Tarefa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tasks;
