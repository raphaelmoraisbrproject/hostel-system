import { useState } from 'react';
import { MapPin, Calendar, User, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const priorityColors = {
  low: 'border-l-gray-300',
  normal: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

const KanbanCard = ({ task, onUpdate, canEdit, onEdit }) => {
  const { profile } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    if (!canEdit || isUpdating) return;
    setIsUpdating(true);

    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = profile?.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      await supabase.from('tasks').update(updateData).eq('id', task.id);
      onUpdate();
    } catch (err) {
      console.error('Error updating task:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isCompleted = task.status === 'completed';
  const checklistProgress = task.checklist_items?.length > 0
    ? {
        done: task.checklist_items.filter(i => i.done).length,
        total: task.checklist_items.length
      }
    : null;

  return (
    <div
      onClick={() => onEdit && onEdit(task)}
      className={`bg-white rounded-lg shadow-sm border-l-4 p-3 hover:shadow-md transition-all cursor-pointer ${
        priorityColors[task.priority] || priorityColors.normal
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={handleToggleComplete}
          disabled={!canEdit || isUpdating}
          className="mt-0.5 flex-shrink-0 disabled:opacity-50"
        >
          {isCompleted ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : (
            <Circle size={18} className="text-gray-300 hover:text-emerald-400 transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm leading-tight ${
            isCompleted ? 'line-through text-gray-400' : 'text-gray-900'
          }`}>
            {task.title}
          </h4>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-gray-500">
            {task.area && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {task.area.name}
              </span>
            )}
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(task.due_date).toLocaleDateString('pt-BR')}
              </span>
            )}
            {task.assigned_user && (
              <span className="flex items-center gap-1">
                <User size={12} />
                {task.assigned_user.full_name?.split(' ')[0]}
              </span>
            )}
          </div>

          {/* Checklist progress */}
          {checklistProgress && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${(checklistProgress.done / checklistProgress.total) * 100}%`
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {checklistProgress.done}/{checklistProgress.total}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;
