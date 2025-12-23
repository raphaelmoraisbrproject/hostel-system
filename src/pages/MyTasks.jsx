import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    CheckCircle2, Clock, MapPin, Calendar, ChevronDown, ChevronUp,
    AlertTriangle, Play, Check, Camera
} from 'lucide-react';

const MyTasks = () => {
    const { profile } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedTask, setExpandedTask] = useState(null);
    const [filter, setFilter] = useState('today');

    useEffect(() => {
        if (profile?.id) {
            fetchMyTasks();
        }
    }, [profile?.id, filter]);

    const fetchMyTasks = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('tasks')
                .select(`
                    *,
                    area:areas(id, name)
                `)
                .eq('assigned_to', profile.id)
                .neq('status', 'cancelled')
                .order('due_date', { ascending: true })
                .order('due_time', { ascending: true });

            // Apply date filter
            const today = new Date().toISOString().split('T')[0];
            if (filter === 'today') {
                query = query.eq('due_date', today);
            } else if (filter === 'pending') {
                query = query.in('status', ['pending', 'in_progress']);
            } else if (filter === 'completed') {
                query = query.eq('status', 'completed');
            }

            const { data, error } = await query;

            if (error) throw error;
            setTasks(data || []);
        } catch (err) {
            console.error('Error fetching tasks:', err);
            setError('Erro ao carregar tarefas');
        } finally {
            setLoading(false);
        }
    };

    const handleStartTask = async (taskId) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    status: 'in_progress',
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId);

            if (error) throw error;
            await fetchMyTasks();
        } catch (err) {
            console.error('Error starting task:', err);
            setError('Erro ao iniciar tarefa');
        }
    };

    const handleCompleteTask = async (taskId) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    completed_by: profile.id,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId);

            if (error) throw error;
            await fetchMyTasks();
        } catch (err) {
            console.error('Error completing task:', err);
            setError('Erro ao concluir tarefa');
        }
    };

    const handleToggleChecklistItem = async (taskId, task, itemIndex) => {
        const updatedChecklist = [...(task.checklist_items || [])];
        updatedChecklist[itemIndex] = {
            ...updatedChecklist[itemIndex],
            done: !updatedChecklist[itemIndex].done
        };

        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    checklist_items: updatedChecklist,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId);

            if (error) throw error;
            await fetchMyTasks();
        } catch (err) {
            console.error('Error updating checklist:', err);
            setError('Erro ao atualizar checklist');
        }
    };

    const getPriorityColor = (priority) => {
        const colors = {
            low: 'border-gray-300',
            normal: 'border-blue-400',
            high: 'border-orange-400',
            urgent: 'border-red-500',
        };
        return colors[priority] || colors.normal;
    };

    const getPriorityBadge = (priority) => {
        const badges = {
            low: 'bg-gray-100 text-gray-600',
            normal: 'bg-blue-100 text-blue-600',
            high: 'bg-orange-100 text-orange-600',
            urgent: 'bg-red-100 text-red-600',
        };
        const labels = {
            low: 'Baixa',
            normal: 'Normal',
            high: 'Alta',
            urgent: 'Urgente',
        };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badges[priority]}`}>
                {labels[priority]}
            </span>
        );
    };

    const isOverdue = (task) => {
        if (task.status === 'completed') return false;
        const dueDate = new Date(task.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
    };

    const getCompletedCount = (checklist) => {
        if (!checklist || checklist.length === 0) return { done: 0, total: 0 };
        const done = checklist.filter(item => item.done).length;
        return { done, total: checklist.length };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Minhas Tarefas</h1>
                <p className="text-gray-600">
                    Olá, {profile?.full_name}! Veja suas tarefas abaixo.
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { value: 'today', label: 'Hoje' },
                    { value: 'pending', label: 'Pendentes' },
                    { value: 'completed', label: 'Concluídas' },
                    { value: 'all', label: 'Todas' },
                ].map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === tab.value
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tasks Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                        {tasks.filter(t => t.status === 'pending').length}
                    </p>
                    <p className="text-sm text-yellow-700">Pendentes</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                        {tasks.filter(t => t.status === 'in_progress').length}
                    </p>
                    <p className="text-sm text-blue-700">Em Andamento</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                        {tasks.filter(t => t.status === 'completed').length}
                    </p>
                    <p className="text-sm text-green-700">Concluídas</p>
                </div>
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                {tasks.map(task => {
                    const isExpanded = expandedTask === task.id;
                    const overdue = isOverdue(task);
                    const checklistProgress = getCompletedCount(task.checklist_items);

                    return (
                        <div
                            key={task.id}
                            className={`bg-white rounded-lg shadow border-l-4 ${getPriorityColor(task.priority)} ${overdue ? 'ring-2 ring-red-200' : ''
                                }`}
                        >
                            {/* Task Header */}
                            <div
                                className="p-4 cursor-pointer"
                                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        {/* Checkbox for quick completion */}
                                        <input
                                            type="checkbox"
                                            checked={task.status === 'completed'}
                                            onChange={() => task.status !== 'completed' && handleCompleteTask(task.id)}
                                            disabled={task.status === 'completed'}
                                            className="mt-1 w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div>
                                            <h3 className={`font-semibold transition-all ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'
                                                }`}>
                                                {task.title}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {getPriorityBadge(task.priority)}
                                                {overdue && (
                                                    <span className="flex items-center gap-1 text-xs text-red-600">
                                                        <AlertTriangle size={12} />
                                                        Atrasada
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {checklistProgress.total > 0 && (
                                            <span className="text-xs text-gray-500">
                                                {checklistProgress.done}/{checklistProgress.total}
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-2 ml-9 text-sm text-gray-500">
                                    {task.area && (
                                        <span className="flex items-center gap-1">
                                            <MapPin size={14} />
                                            {task.area.name}
                                        </span>
                                    )}
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
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="px-4 pb-4 border-t">
                                    {task.description && (
                                        <p className="text-gray-600 mt-3 text-sm">{task.description}</p>
                                    )}

                                    {/* Checklist */}
                                    {task.checklist_items?.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="font-medium text-gray-700 mb-2">Checklist</h4>
                                            <div className="space-y-2">
                                                {task.checklist_items.map((item, index) => (
                                                    <label
                                                        key={index}
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={item.done}
                                                            onChange={() => handleToggleChecklistItem(task.id, task, index)}
                                                            className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                                                            disabled={task.status === 'completed'}
                                                        />
                                                        <span className={item.done ? 'line-through text-gray-400' : 'text-gray-700'}>
                                                            {item.text}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {task.status !== 'completed' && (
                                        <div className="flex gap-2 mt-4 pt-4 border-t">
                                            {task.status === 'pending' && (
                                                <button
                                                    onClick={() => handleStartTask(task.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    <Play size={18} />
                                                    Iniciar Tarefa
                                                </button>
                                            )}
                                            {task.status === 'in_progress' && (
                                                <button
                                                    onClick={() => handleCompleteTask(task.id)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                                >
                                                    <Check size={18} />
                                                    Marcar como Concluída
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {task.status === 'completed' && task.completed_at && (
                                        <p className="mt-4 text-sm text-gray-500">
                                            Concluída em {new Date(task.completed_at).toLocaleString('pt-BR')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {tasks.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-lg shadow">
                        <CheckCircle2 className="mx-auto text-gray-300 mb-4" size={48} />
                        <p className="text-gray-500">
                            {filter === 'today' ? 'Nenhuma tarefa para hoje!' :
                                filter === 'pending' ? 'Nenhuma tarefa pendente!' :
                                    filter === 'completed' ? 'Nenhuma tarefa concluída ainda.' :
                                        'Nenhuma tarefa encontrada.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyTasks;
