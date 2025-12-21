import { memo } from 'react';
import { Lock } from 'lucide-react';

/**
 * LockBar Component
 * Renders a date lock bar in the calendar grid.
 * Uses React.memo for performance optimization.
 */
const LockBar = memo(({
  lock,
  lockStyle,
  onLockClick
}) => {
  const { clipPath, isClippedLeft, isClippedRight, isShortLock, ...wrapperStyle } = lockStyle;

  // Don't render if hidden
  if (lockStyle.display === 'none') return null;

  const lockLabel = lock.lock_type === 'Outro'
    ? (lock.description || 'Bloqueado')
    : lock.lock_type;

  const paddingLeft = isClippedLeft ? 'pl-1.5 sm:pl-3' : (isShortLock ? 'pl-3 sm:pl-5' : 'pl-5 sm:pl-8');
  const paddingRight = isClippedRight ? 'pr-1.5 sm:pr-3' : (isShortLock ? 'pr-3 sm:pr-5' : 'pr-6 sm:pr-10');

  // Lock type color mapping
  const getLockColor = (lockType) => {
    const colorMap = {
      'Voluntariado': 'bg-purple-500',
      'Manutenção': 'bg-orange-500',
      'Outro': 'bg-gray-500'
    };
    return colorMap[lockType] || 'bg-gray-500';
  };

  return (
    <div
      style={{
        ...wrapperStyle,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))'
      }}
      onClick={() => onLockClick(lock)}
      className="cursor-pointer group"
      title={`${lockLabel} (${lock.start_date} - ${lock.end_date})`}
    >
      <div
        style={{ clipPath }}
        className={`h-full w-full ${getLockColor(lock.lock_type)} text-white transition-all group-hover:brightness-110`}
      >
        <div className={`h-full w-full flex items-center gap-1.5 ${paddingLeft} ${paddingRight}`}>
          <Lock size={12} className="flex-shrink-0" />
          <span className="font-bold text-[10px] sm:text-xs truncate">
            {lockLabel}
          </span>
        </div>
      </div>
    </div>
  );
});

LockBar.displayName = 'LockBar';

export default LockBar;
