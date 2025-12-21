import { memo } from 'react';
import { Bed, ShowerHead } from 'lucide-react';

/**
 * RowSidebar Component
 * Renders the left sidebar cell for each row in the calendar.
 * Displays room/bed information.
 * Uses React.memo for performance optimization.
 */
const RowSidebar = memo(({
  row,
  sidebarWidth
}) => {
  const rowType = row.type;

  // Determine background color based on row type
  const getBgClass = () => {
    if (rowType === 'header') return 'bg-gray-100 text-gray-600';
    if (rowType === 'room') return 'bg-slate-50';
    return 'bg-white';
  };

  return (
    <div
      className={`sticky left-0 z-20 border-r border-gray-200 flex-shrink-0 flex items-center px-2 sm:px-3 justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] ${getBgClass()}`}
      style={{ width: sidebarWidth }}
    >
      <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
        {rowType === 'header' && (
          <span className="font-bold text-xs sm:text-sm truncate">{row.name}</span>
        )}
        {rowType === 'room' && (
          <>
            <div className="w-1 h-5 sm:h-6 bg-purple-500 rounded-full flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-gray-800 text-[11px] sm:text-sm truncate">{row.name}</span>
                {row.has_bathroom && <ShowerHead size={11} className="text-blue-500 flex-shrink-0" />}
              </div>
            </div>
          </>
        )}
        {rowType === 'room_booking' && (
          <>
            <div className="w-4 sm:w-5 ml-2 sm:ml-3 flex justify-center opacity-50">
              <Bed size={11} className="text-gray-400" />
            </div>
            <span className="text-[9px] sm:text-[11px] font-medium text-gray-400 italic truncate">{row.name}</span>
          </>
        )}
        {rowType === 'bed' && (
          <>
            <div className="w-4 sm:w-5 ml-2 sm:ml-3 flex justify-center">
              <Bed size={12} className="text-gray-400" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-gray-600 truncate">{row.name}</span>
          </>
        )}
      </div>
    </div>
  );
});

RowSidebar.displayName = 'RowSidebar';

export default RowSidebar;
