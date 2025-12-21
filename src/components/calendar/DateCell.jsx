import { memo } from 'react';

/**
 * DateCell Component
 * Renders a single date cell in the calendar timeline.
 * Uses React.memo for performance optimization.
 */
const DateCell = memo(({
  isToday,
  isRoomHeader,
  isClickable,
  isSelected,
  cellWidth,
  rate,
  defaultPrice,
  onCellClick
}) => {
  return (
    <div
      className={`flex-shrink-0 border-r h-full flex items-center justify-center transition-all
        ${isRoomHeader ? 'hover:bg-emerald-50 cursor-pointer' : ''}
        ${isClickable ? 'hover:bg-blue-50 cursor-pointer' : ''}
        ${isToday ? 'bg-emerald-50 border-emerald-200' : 'border-gray-300'}
        ${isSelected ? 'bg-blue-200 ring-2 ring-blue-400 ring-inset' : ''}
      `}
      style={{ width: cellWidth }}
      onClick={onCellClick}
    >
      {isRoomHeader && (
        <span className="text-[9px] sm:text-[11px] font-bold text-emerald-700">
          ${rate || defaultPrice || '--'}
        </span>
      )}
    </div>
  );
});

DateCell.displayName = 'DateCell';

export default DateCell;
