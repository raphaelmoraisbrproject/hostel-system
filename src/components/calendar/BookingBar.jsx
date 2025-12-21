import { memo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { useCurrency } from '../../hooks/useCurrency';

/**
 * BookingBar Component
 * Renders a booking bar in the calendar grid.
 * Uses React.memo for performance optimization to prevent unnecessary re-renders.
 */
const BookingBar = memo(({
  booking,
  barStyle,
  onBookingClick,
  onDragStart,
  isMobile
}) => {
  const { formatCurrency } = useCurrency();

  const nights = differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
  const isVeryShort = nights === 1;
  const isShortStay = nights <= 2;
  const fullName = booking.guests?.full_name || 'Unknown';

  // Smart name display based on stay length
  const nameParts = fullName.split(' ').filter(p => p.length > 0);
  const firstName = nameParts[0] || fullName;
  const lastName = nameParts[nameParts.length - 1];
  const lastInitial = nameParts.length > 1 ? ` ${lastName[0]}.` : '';

  // 1-2 nights: first name only | 3+ nights: first name + last initial
  const displayName = isShortStay ? firstName : `${firstName}${lastInitial}`;

  const { clipPath, isClippedLeft, isClippedRight, ...wrapperStyle } = barStyle;

  // Don't render if hidden
  if (barStyle.display === 'none') return null;

  // Calculate pending balance
  const paidAmount = parseFloat(booking.paid_amount || 0);
  const totalAmount = parseFloat(booking.total_amount || 0);
  const pendingAmount = totalAmount - paidAmount;
  const hasPendingBalance = pendingAmount > 0;

  // Adjust padding based on stay length (responsive)
  const paddingLeft = isClippedLeft
    ? 'pl-1.5 sm:pl-3'
    : isVeryShort
      ? 'pl-2 sm:pl-4'
      : isShortStay
        ? 'pl-4 sm:pl-7'
        : 'pl-5 sm:pl-8';
  const paddingRight = isClippedRight
    ? 'pr-1.5 sm:pr-3'
    : isVeryShort
      ? 'pr-2 sm:pr-4'
      : isShortStay
        ? 'pr-4 sm:pr-7'
        : 'pr-6 sm:pr-10';

  // Status color mapping
  const getStatusColor = (status) => {
    const statusMap = {
      'Confirmed': 'bg-emerald-500',
      'Checked-in': 'bg-blue-500',
      'Checked-out': 'bg-gray-400',
      'Cancelled': 'bg-red-400'
    };
    return statusMap[status] || 'bg-gray-400';
  };

  return (
    <div
      style={{
        ...wrapperStyle,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))'
      }}
      onClick={() => onBookingClick(booking)}
      className="cursor-pointer group"
      title={`${fullName} (${booking.status}) - ${nights} noite${nights > 1 ? 's' : ''}${hasPendingBalance ? ` - Pendente: ${formatCurrency(pendingAmount)}` : ''}`}
    >
      {/* Inner bar with clip-path */}
      <div
        style={{ clipPath }}
        className={`h-full w-full ${getStatusColor(booking.status)} transition-all group-hover:brightness-110 relative`}
      >
        <div className={`h-full w-full flex items-center gap-1 sm:gap-1.5 relative ${paddingLeft} ${paddingRight}`}>
          <span className="font-bold text-[10px] sm:text-xs text-white drop-shadow-md truncate">
            {displayName}
          </span>
          {hasPendingBalance && (
            <>
              {/* Red bullet - always visible when has pending balance */}
              <span className="w-1.5 h-1.5 flex-shrink-0 bg-red-400 rounded-full shadow-[0_0_4px_rgba(248,113,113,0.9)] animate-pulse"></span>
              {/* Amount - show if 2+ nights, hide only for 1-night stays */}
              {!isVeryShort && (
                <span className="text-[9px] sm:text-[10px] text-red-100 italic font-medium truncate">
                  {formatCurrency(pendingAmount)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Drag handle on right edge to extend booking */}
        {!isClippedRight && !isMobile && (
          <div
            draggable
            onDragStart={(e) => onDragStart(e, booking)}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-6 cursor-ew-resize hover:bg-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Arrastar para estender"
          >
            <div className="w-1 h-6 bg-white/50 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
});

BookingBar.displayName = 'BookingBar';

export default BookingBar;
