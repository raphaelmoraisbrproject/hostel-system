import KanbanColumn from './KanbanColumn';
import { TASK_CATEGORIES } from '../../constants/taskCategories';
import { usePermissions } from '../../contexts/PermissionsContext';

const KanbanBoard = ({ tasks, onRefresh, onAddTask, onEditTask }) => {
  const { canEdit, canCreate } = usePermissions();

  // Group tasks by category
  const tasksByCategory = Object.keys(TASK_CATEGORIES).reduce((acc, category) => {
    acc[category] = tasks.filter(task =>
      (task.category || 'geral') === category &&
      task.status !== 'cancelled'
    );
    return acc;
  }, {});

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
      {Object.keys(TASK_CATEGORIES).map(category => (
        <KanbanColumn
          key={category}
          category={category}
          tasks={tasksByCategory[category]}
          onUpdate={onRefresh}
          onAddTask={onAddTask}
          onEditTask={onEditTask}
          canEdit={canEdit('tasks')}
          canCreate={canCreate('tasks')}
        />
      ))}
    </div>
  );
};

export default KanbanBoard;
