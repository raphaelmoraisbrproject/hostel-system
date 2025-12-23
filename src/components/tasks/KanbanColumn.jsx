import { Plus, Sparkles, Shirt, Wrench, ClipboardList } from 'lucide-react';
import KanbanCard from './KanbanCard';
import { TASK_CATEGORIES } from '../../constants/taskCategories';

const iconMap = {
  Sparkles,
  Shirt,
  Wrench,
  ClipboardList
};

const KanbanColumn = ({ category, tasks, onUpdate, onAddTask, onEditTask, canEdit, canCreate }) => {
  const categoryInfo = TASK_CATEGORIES[category];
  const IconComponent = iconMap[categoryInfo.icon];
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="flex flex-col min-w-72 max-w-80 bg-gray-50 rounded-lg flex-shrink-0">
      {/* Column Header */}
      <div className={`${categoryInfo.headerColor} text-white px-4 py-3 rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconComponent size={18} />
            <span className="font-medium">{categoryInfo.label}</span>
          </div>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Cards Container */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {/* Pending tasks first */}
        {pendingTasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            onUpdate={onUpdate}
            onEdit={onEditTask}
            canEdit={canEdit}
          />
        ))}

        {/* Completed tasks with separator */}
        {completedTasks.length > 0 && pendingTasks.length > 0 && (
          <div className="border-t border-gray-200 pt-2 mt-2">
            <p className="text-xs text-gray-400 mb-2">Concluidas</p>
          </div>
        )}
        {completedTasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            onUpdate={onUpdate}
            onEdit={onEditTask}
            canEdit={canEdit}
          />
        ))}

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nenhuma tarefa
          </div>
        )}
      </div>

      {/* Add Button */}
      {canCreate && (
        <button
          onClick={() => onAddTask(category)}
          className="m-3 mt-0 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <Plus size={16} />
          <span className="text-sm">Nova Tarefa</span>
        </button>
      )}
    </div>
  );
};

export default KanbanColumn;
