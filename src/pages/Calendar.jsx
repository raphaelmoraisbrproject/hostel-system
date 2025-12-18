import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, differenceInDays, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Bed, User, Check, X, Mail, AlertCircle, Phone, ShowerHead } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';
import { COUNTRIES, DOCUMENT_TYPES, GENDERS } from '../constants/countries';

const CELL_WIDTH = 120; // Width of each day column
const HEADER_HEIGHT = 96; // Height of the date header
const SIDEBAR_WIDTH = 240; // Width of the room sidebar

const Calendar = () => {
  const { t } = useTranslation();
  const [today] = useState(new Date());
  // Start 2 days before today to show recent bookings
  const [startDate, setStartDate] = useState(addDays(today, -2));
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyRates, setDailyRates] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [formData, setFormData] = useState({
    // Guest info
    guest_id: null,
    guest_name: '',
    email: '',
    phone: '',
    nationality: '',
    passport: '',
    document_type: 'PASSPORT',
    gender: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    guest_notes: '',
    // Booking info
    check_in: format(new Date(), 'yyyy-MM-dd'),
    check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    room_id: '',
    status: 'Confirmed',
    total_amount: '',
    paid_amount: 0,
    initial_payment: '',
    payment_method: 'Cash'
  });

  const [conflictWarning, setConflictWarning] = useState(null);

  // Price Edit Modal State
  const [priceModal, setPriceModal] = useState({
    isOpen: false,
    room: null,
    date: null,
    price: ''
  });

  // Alert Modal State
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Date Selection State (for click-to-select booking dates)
  const [dateSelection, setDateSelection] = useState({
    isSelecting: false,
    startDate: null,
    endDate: null,
    rowId: null,
    rowType: null
  });

  // Drag to extend booking state
  const [dragState, setDragState] = useState({
    isDragging: false,
    booking: null,
    originalEndDate: null,
    currentEndDate: null
  });

  // Generate dates for the view (3 months = ~90 days)
  const dates = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 89) // Show 90 days (3 months)
  });

  useEffect(() => {
    fetchData();
  }, [startDate]);

  // Real-time conflict detection and price calculation
  useEffect(() => {
    if (isModalOpen) {
      checkConflicts();
      calculateTotal();
    }
  }, [formData.check_in, formData.check_out, formData.room_id, isModalOpen]);

  // Auto-lookup guest by passport or email
  useEffect(() => {
    if (isModalOpen && !selectedBooking) {
      const lookupGuest = async () => {
        const identifier = formData.passport || formData.email;
        if (!identifier || identifier.length < 3) return;

        const { data, error } = await supabase
          .from('guests')
          .select('*')
          .or(`passport_id.eq."${identifier}",email.eq."${identifier}"`)
          .maybeSingle();

        if (data) {
          setFormData(prev => ({
            ...prev,
            guest_id: data.id,
            guest_name: data.full_name,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
            nationality: data.nationality || prev.nationality,
            passport: data.passport_id || prev.passport,
            document_type: data.document_type || prev.document_type,
            gender: data.gender || prev.gender,
            date_of_birth: data.date_of_birth || prev.date_of_birth,
            emergency_contact_name: data.emergency_contact_name || prev.emergency_contact_name,
            emergency_contact_phone: data.emergency_contact_phone || prev.emergency_contact_phone,
            guest_notes: data.notes || prev.guest_notes
          }));
        }
      };

      const timer = setTimeout(lookupGuest, 500);
      return () => clearTimeout(timer);
    }
  }, [formData.passport, formData.email, isModalOpen]);

  const calculateTotal = () => {
    if (!formData.check_in || !formData.check_out || !formData.room_id) return;

    if (!rooms || rooms.length === 0 || !formData.room_id) return;

    // Find room_id (if selected value is a bed)
    let targetRoomId = formData.room_id;
    const isBed = rooms.some(r => r.beds?.some(b => b.id === formData.room_id));
    if (isBed) {
      const room = rooms.find(r => r.beds?.some(b => b.id === formData.room_id));
      if (!room) return;
      targetRoomId = room.id;
    }

    const start = parseISO(formData.check_in);
    const end = parseISO(formData.check_out);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      if (formData.total_amount !== '0.00') {
        setFormData(prev => ({ ...prev, total_amount: '0.00' }));
      }
      return;
    }

    const interval = eachDayOfInterval({ start, end: addDays(end, -1) });

    let total = 0;
    const room = rooms.find(r => r.id === targetRoomId);
    if (!room) return;

    interval.forEach(date => {
      const rate = getDailyRate(targetRoomId, date);
      total += parseFloat(rate || room.price_per_night || 0);
    });

    const newTotal = total.toFixed(2);
    if (formData.total_amount !== newTotal) {
      setFormData(prev => ({ ...prev, total_amount: newTotal }));
    }
  };

  const checkConflicts = async () => {
    const { check_in, check_out, room_id } = formData;
    if (!check_in || !check_out || !room_id || !rooms || rooms.length === 0) {
      setConflictWarning(null);
      return;
    }

    const start = parseISO(check_in);
    const end = parseISO(check_out);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      setConflictWarning(null);
      return;
    }

    let targetRoomId = room_id;
    let targetBedId = null;
    const isBed = rooms.some(r => r.beds?.some(b => b.id === room_id));

    if (isBed) {
      targetBedId = room_id;
      const parentRoom = rooms.find(r => r.beds?.some(b => b.id === room_id));
      if (parentRoom) {
        targetRoomId = parentRoom.id;
      }
    }

    let query = supabase
      .from('bookings')
      .select('id, guests(full_name)')
      .neq('status', 'Cancelled')
      .lt('check_in_date', check_out)
      .gt('check_out_date', check_in);

    if (targetBedId) {
      query = query.eq('bed_id', targetBedId);
    } else {
      query = query.eq('room_id', targetRoomId).is('bed_id', null);
    }

    if (selectedBooking) {
      query = query.neq('id', selectedBooking.id);
    }

    try {
      const { data } = await query;
      if (data && data.length > 0) {
        setConflictWarning(`Overlap detected: already booked by ${data[0].guests?.full_name}`);
      } else {
        setConflictWarning(null);
      }
    } catch (e) {
      console.error("Conflict check error:", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Rooms and Beds (only active rooms)
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          beds (*)
        `)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (roomsError) throw roomsError;

      // Filter out inactive beds (status !== 'Active')
      const roomsWithActiveBeds = (roomsData || []).map(room => ({
        ...room,
        beds: room.beds?.filter(bed => bed.status === 'Active') || []
      }));

      setRooms(roomsWithActiveBeds);

      // 2. Fetch Bookings for the date range (90 days)
      const rangeStart = format(startDate, 'yyyy-MM-dd');
      const rangeEnd = format(addDays(startDate, 90), 'yyyy-MM-dd');

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (
            id,
            full_name,
            email,
            phone,
            nationality,
            passport_id,
            document_type,
            gender,
            date_of_birth,
            emergency_contact_name,
            emergency_contact_phone,
            notes
          )
        `)
        .lt('check_in_date', rangeEnd)
        .gt('check_out_date', rangeStart);

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

      // 3. Fetch Daily Rates
      const { data: ratesData, error: ratesError } = await supabase
        .from('daily_rates')
        .select('*')
        .gte('date', rangeStart)
        .lte('date', rangeEnd);

      if (ratesError) throw ratesError;
      setDailyRates(ratesData || []);

    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare rows for the calendar (Rooms and Beds)
  const rows = [];
  (rooms || []).forEach(room => {
    // Build room display name with gender and bathroom info
    let roomDisplayName = room.name;
    // Add gender tag: (F) for Female, (M) for Male, nothing for Mixed
    if (room.gender_restriction === 'Female') {
      roomDisplayName = `${room.name} (F)`;
    } else if (room.gender_restriction === 'Male') {
      roomDisplayName = `${room.name} (M)`;
    }
    // Bathroom icon will be shown separately in the row

    // Add Room Header (Price only, no bookings)
    rows.push({
      id: room.id,
      name: roomDisplayName,
      type: 'room',
      capacity: room.capacity,
      isPrivate: room.type === 'Private',
      room_id: room.id, // for pricing lookups
      has_bathroom: room.has_bathroom
    });

    // If Private, add a Row for the actual booking
    if (room.type === 'Private') {
      rows.push({
        id: `booking-${room.id}`,
        parentId: room.id,
        name: `${room.type} • ${room.capacity} Pers`,
        type: 'room_booking',
        isPrivate: true
      });
    }

    // If Dorm, add Beds as sub-rows
    if (room.type === 'Dorm' && room.beds) {
      room.beds.sort((a, b) => {
        // Human sort for bed numbers
        return a.bed_number.localeCompare(b.bed_number, undefined, { numeric: true, sensitivity: 'base' });
      }).forEach(bed => {
        rows.push({
          id: bed.id,
          parentId: room.id,
          name: `Bed ${bed.bed_number}`,
          type: 'bed'
        });
      });
    }
  });

  const getResourceBookings = (row, type) => {
    return bookings.filter(b => {
      // Room Header rows (type 'room') never show bookings
      if (type === 'room') return false;

      // Bed rows show bookings linked to that bed
      if (type === 'bed') return b.bed_id === row.id;

      // room_booking rows show bookings linked to the room (without a specific bed)
      if (type === 'room_booking') return b.room_id === row.parentId && !b.bed_id;

      return false;
    });
  };

  const getBarStyle = (booking) => {
    const start = parseISO(booking.check_in_date);
    const end = parseISO(booking.check_out_date);

    const visibleRangeStart = startOfDay(startDate);
    const visibleRangeEnd = addDays(startDate, dates.length);

    // Calculate offset and duration
    const offsetDays = differenceInDays(startOfDay(start), visibleRangeStart);
    const durationDays = differenceInDays(end, start);

    // Check if booking is clipped on either end
    const isClippedLeft = startOfDay(start) < visibleRangeStart;
    const isClippedRight = end > visibleRangeEnd;

    // Calculate visible portion
    const visibleStartDays = isClippedLeft ? 0 : offsetDays;
    const clippedDaysStart = isClippedLeft ? Math.abs(offsetDays) : 0;
    const endOffsetDays = offsetDays + durationDays;
    const clippedDaysEnd = isClippedRight ? Math.max(0, endOffsetDays - dates.length) : 0;
    const visibleDurationDays = durationDays - clippedDaysStart - clippedDaysEnd;

    // If completely outside visible range, hide
    if (visibleDurationDays <= 0) {
      return { display: 'none' };
    }

    // Calculate left position
    // Normal: starts at middle of check-in day
    // Clipped left: starts at left edge (0)
    const leftPosition = isClippedLeft
      ? 0
      : (visibleStartDays * CELL_WIDTH) + (CELL_WIDTH / 2);

    // Calculate width
    // Normal: spans durationDays cells
    // Clipped left: add CELL_WIDTH/2 since we start at edge, not middle
    // Clipped right: add CELL_WIDTH/2 since we end at edge, not middle
    let width = visibleDurationDays * CELL_WIDTH;
    if (isClippedLeft) width += CELL_WIDTH / 2;
    if (isClippedRight) width += CELL_WIDTH / 2;

    // Adjust clip-path based on clipping
    // Normal: / / (slanted both sides)
    // Clipped left: | / (flat left, slanted right)
    // Clipped right: / | (slanted left, flat right)
    // Both clipped: | | (flat both sides)
    let clipPath;
    if (isClippedLeft && isClippedRight) {
      clipPath = 'none'; // Rectangle
    } else if (isClippedLeft) {
      clipPath = 'polygon(0 0, 100% 0, calc(100% - 25px) 100%, 0 100%)'; // Flat left
    } else if (isClippedRight) {
      clipPath = 'polygon(25px 0, 100% 0, 100% 100%, 0 100%)'; // Flat right
    } else {
      clipPath = 'polygon(25px 0, 100% 0, calc(100% - 25px) 100%, 0 100%)'; // Normal
    }

    return {
      left: `${leftPosition}px`,
      width: `${width}px`,
      position: 'absolute',
      top: '12px',
      bottom: '12px',
      zIndex: 10,
      clipPath,
      isClippedLeft,
      isClippedRight
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white'; // Reserved
      case 'Checked-in': return 'bg-blue-500 hover:bg-blue-600 border-blue-600 text-white';
      case 'Checked-out': return 'bg-gray-400 hover:bg-gray-500 border-gray-500 text-white';
      case 'Cancelled': return 'bg-red-400 hover:bg-red-500 border-red-500 text-white';
      default: return 'bg-emerald-500 text-white';
    }
  };

  const getDailyRate = (roomId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const rate = dailyRates.find(r => r.room_id === roomId && r.date === dateStr);
    return rate ? rate.price : null;
  };

  const handlePriceEdit = (row, date, currentRate) => {
    const defaultPrice = rooms.find(r => r.id === row.id)?.price_per_night || '';
    setPriceModal({
      isOpen: true,
      room: row,
      date: date,
      price: currentRate || defaultPrice
    });
  };

  const saveDailyRate = async () => {
    try {
      const { room, date, price } = priceModal;
      const dateStr = format(date, 'yyyy-MM-dd');

      // Update or Insert using upsert
      const { error } = await supabase
        .from('daily_rates')
        .upsert({
          room_id: room.id,
          date: dateStr,
          price: parseFloat(price)
        }, {
          onConflict: 'room_id,date'
        });

      if (error) throw error;

      // Close modal and refresh data
      setPriceModal({ ...priceModal, isOpen: false });
      fetchData();

      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Price updated successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving daily rate:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Could not update price',
        type: 'error'
      });
    }
  };

  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    // Populate form with all guest info
    setFormData({
      // Guest info
      guest_id: booking.guests?.id || null,
      guest_name: booking.guests?.full_name || '',
      email: booking.guests?.email || '',
      phone: booking.guests?.phone || '',
      nationality: booking.guests?.nationality || '',
      passport: booking.guests?.passport_id || '',
      document_type: booking.guests?.document_type || 'PASSPORT',
      gender: booking.guests?.gender || '',
      date_of_birth: booking.guests?.date_of_birth || '',
      emergency_contact_name: booking.guests?.emergency_contact_name || '',
      emergency_contact_phone: booking.guests?.emergency_contact_phone || '',
      guest_notes: booking.guests?.notes || '',
      // Booking info
      check_in: booking.check_in_date,
      check_out: booking.check_out_date,
      room_id: booking.bed_id || booking.room_id || '',
      status: booking.status,
      total_amount: booking.total_amount,
      paid_amount: parseFloat(booking.paid_amount || 0),
      initial_payment: booking.paid_amount || '',
      payment_method: 'Cash'
    });
    setIsModalOpen(true);
  };

  const handleNewBooking = () => {
    setSelectedBooking(null);
    setFormData({
      // Guest info
      guest_id: null,
      guest_name: '',
      email: '',
      phone: '',
      nationality: '',
      passport: '',
      document_type: 'PASSPORT',
      gender: '',
      date_of_birth: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      guest_notes: '',
      // Booking info
      check_in: format(today, 'yyyy-MM-dd'),
      check_out: format(addDays(today, 1), 'yyyy-MM-dd'),
      room_id: rooms[0]?.id || '',
      status: 'Confirmed',
      total_amount: '',
      paid_amount: 0,
      initial_payment: '',
      payment_method: 'Cash'
    });
    setConflictWarning(null);
    setIsModalOpen(true);
  };

  // Handle cell click for date selection
  const handleCellClick = (row, date) => {
    // Only allow selection on bed or room_booking rows (not room headers)
    if (row.type !== 'bed' && row.type !== 'room_booking') return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const resourceId = row.type === 'bed' ? row.id : row.parentId;

    if (!dateSelection.isSelecting) {
      // First click - start selection
      setDateSelection({
        isSelecting: true,
        startDate: dateStr,
        endDate: null,
        rowId: resourceId,
        rowType: row.type
      });
    } else {
      // Second click - complete selection
      if (dateSelection.rowId !== resourceId) {
        // Different row clicked, reset and start new selection
        setDateSelection({
          isSelecting: true,
          startDate: dateStr,
          endDate: null,
          rowId: resourceId,
          rowType: row.type
        });
        return;
      }

      // Same row - complete selection
      let checkIn = dateSelection.startDate;
      let checkOut = dateStr;

      // Ensure check_in is before check_out
      if (parseISO(checkIn) > parseISO(checkOut)) {
        [checkIn, checkOut] = [checkOut, checkIn];
      }

      // Add one day to checkout (checkout is the day they leave)
      checkOut = format(addDays(parseISO(checkOut), 1), 'yyyy-MM-dd');

      // Reset selection state
      setDateSelection({
        isSelecting: false,
        startDate: null,
        endDate: null,
        rowId: null,
        rowType: null
      });

      // Open booking modal with pre-filled dates
      setSelectedBooking(null);
      setFormData({
        guest_id: null,
        guest_name: '',
        email: '',
        phone: '',
        nationality: '',
        passport: '',
        document_type: 'PASSPORT',
        gender: '',
        date_of_birth: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        guest_notes: '',
        check_in: checkIn,
        check_out: checkOut,
        room_id: resourceId,
        status: 'Confirmed',
        total_amount: '',
        paid_amount: 0,
        initial_payment: '',
        payment_method: 'Cash'
      });
      setConflictWarning(null);
      setIsModalOpen(true);
    }
  };

  // Check if a cell is in the current selection range
  const isCellInSelection = (row, date) => {
    if (!dateSelection.isSelecting || !dateSelection.startDate) return false;

    const resourceId = row.type === 'bed' ? row.id : row.parentId;
    if (dateSelection.rowId !== resourceId) return false;

    const dateStr = format(date, 'yyyy-MM-dd');
    return dateStr === dateSelection.startDate;
  };

  // Handle drag start on booking (right edge)
  const handleDragStart = (e, booking) => {
    e.stopPropagation();
    setDragState({
      isDragging: true,
      booking: booking,
      originalEndDate: booking.check_out_date,
      currentEndDate: booking.check_out_date
    });
  };

  // Handle drag over cell
  const handleDragOver = (e, date) => {
    e.preventDefault();
    if (!dragState.isDragging) return;

    const newEndDate = format(addDays(date, 1), 'yyyy-MM-dd');
    const checkIn = parseISO(dragState.booking.check_in_date);

    // Don't allow end date before or equal to start date
    if (parseISO(newEndDate) <= checkIn) return;

    setDragState(prev => ({
      ...prev,
      currentEndDate: newEndDate
    }));
  };

  // Handle drop - update booking
  const handleDrop = async (e) => {
    e.preventDefault();
    if (!dragState.isDragging || !dragState.booking) return;

    const { booking, originalEndDate, currentEndDate } = dragState;

    // Reset drag state
    setDragState({
      isDragging: false,
      booking: null,
      originalEndDate: null,
      currentEndDate: null
    });

    // If no change, do nothing
    if (originalEndDate === currentEndDate) return;

    try {
      // Calculate new total amount based on the new dates
      const checkInDate = parseISO(booking.check_in_date);
      const newCheckOutDate = parseISO(currentEndDate);
      const interval = eachDayOfInterval({ start: checkInDate, end: addDays(newCheckOutDate, -1) });

      // Find room ID for price lookup
      const roomId = booking.room_id;
      const room = rooms.find(r => r.id === roomId);
      const basePrice = room?.price_per_night || 0;

      // Calculate total with daily rates
      let newTotal = 0;
      interval.forEach(date => {
        const rate = getDailyRate(roomId, date);
        newTotal += parseFloat(rate || basePrice);
      });

      const previousTotal = parseFloat(booking.total_amount || 0);
      const difference = newTotal - previousTotal;

      // Update booking in database with new checkout and total
      const { error } = await supabase
        .from('bookings')
        .update({
          check_out_date: currentEndDate,
          total_amount: newTotal.toFixed(2)
        })
        .eq('id', booking.id);

      if (error) throw error;

      // Refresh data
      fetchData();

      // Show alert with price difference info
      const paidAmount = parseFloat(booking.paid_amount || 0);
      const newBalance = newTotal - paidAmount;

      let message = `Check-out alterado para ${format(newCheckOutDate, 'dd/MM/yyyy')}\n`;
      message += `Novo total: R$ ${newTotal.toFixed(2)}`;
      if (difference > 0) {
        message += ` (+R$ ${difference.toFixed(2)})`;
      } else if (difference < 0) {
        message += ` (-R$ ${Math.abs(difference).toFixed(2)})`;
      }
      if (newBalance > 0) {
        message += `\nSaldo pendente: R$ ${newBalance.toFixed(2)}`;
      }

      setAlertModal({
        isOpen: true,
        title: 'Reserva Atualizada',
        message: message,
        type: newBalance > 0 ? 'warning' : 'success'
      });
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível atualizar a reserva',
        type: 'error'
      });
    }
  };

  // Cancel drag on mouse up outside valid drop zone
  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      booking: null,
      originalEndDate: null,
      currentEndDate: null
    });
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    try {
      // 0. Check for conflicts
      const checkIn = formData.check_in;
      const checkOut = formData.check_out;
      const selectedValue = formData.room_id;

      // Determine room_id and bed_id for conflict check
      let targetRoomId = selectedValue;
      let targetBedId = null;

      const isBed = rooms.some(r => r.beds?.some(b => b.id === selectedValue));
      if (isBed) {
        targetBedId = selectedValue;
        const room = rooms.find(r => r.beds?.some(b => b.id === selectedValue));
        targetRoomId = room.id;
      }

      let query = supabase
        .from('bookings')
        .select('id')
        .neq('status', 'Cancelled')
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn);

      if (targetBedId) {
        query = query.eq('bed_id', targetBedId);
      } else {
        query = query.eq('room_id', targetRoomId).is('bed_id', null); // Only check room bookings if it's a private room
      }

      if (selectedBooking) {
        query = query.neq('id', selectedBooking.id);
      }

      const { data: conflicts, error: conflictError } = await query;

      if (conflictError) throw conflictError;

      if (conflicts && conflicts.length > 0) {
        setAlertModal({
          isOpen: true,
          title: 'Overbooking Detected',
          message: 'Habitación o cama reservada. Escolha outra data ou habitacao.',
          type: 'error'
        });
        return;
      }

      // 1. Create/Update Guest
      let guestId = formData.guest_id || selectedBooking?.guest_id;

      // Prepare guest data object with all fields
      // Note: Convert empty strings to null for optional fields
      const guestData = {
        full_name: formData.guest_name,
        email: formData.email,
        phone: formData.phone,
        nationality: formData.nationality,
        passport_id: formData.passport
      };

      // Only include optional fields if they have values
      if (formData.document_type) guestData.document_type = formData.document_type;
      if (formData.gender) guestData.gender = formData.gender;
      if (formData.date_of_birth) guestData.date_of_birth = formData.date_of_birth;
      if (formData.emergency_contact_name) guestData.emergency_contact_name = formData.emergency_contact_name;
      if (formData.emergency_contact_phone) guestData.emergency_contact_phone = formData.emergency_contact_phone;
      if (formData.guest_notes) guestData.notes = formData.guest_notes;

      if (!guestId) {
        // Create new guest
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert([guestData])
          .select()
          .single();
        if (guestError) throw guestError;
        guestId = newGuest.id;
      } else {
        // Update existing guest with new data
        const { error: updateGuestError } = await supabase
          .from('guests')
          .update(guestData)
          .eq('id', guestId);
        if (updateGuestError) {
          console.error('Error updating guest:', updateGuestError);
        }
      }

      // 2. Prepare Booking Data
      const totalPaidValue = parseFloat(formData.initial_payment) || 0;
      let bookingData = {
        guest_id: guestId,
        check_in_date: formData.check_in,
        check_out_date: formData.check_out,
        status: formData.status,
        total_amount: formData.total_amount || 0,
        paid_amount: totalPaidValue
      };

      if (isBed) {
        bookingData.bed_id = targetBedId;
        bookingData.room_id = targetRoomId;
      } else {
        bookingData.room_id = targetRoomId;
        bookingData.bed_id = null;
      }

      let currentBookingId = selectedBooking?.id;

      if (selectedBooking) {
        // For updates, also include paid_amount
        const updateData = {
          ...bookingData,
          paid_amount: totalPaidValue
        };
        const { error } = await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', selectedBooking.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select()
          .single();
        if (error) throw error;
        currentBookingId = data.id;
      }

      // 3. Handle transaction - avoid duplicates
      // Only create/update transaction if payment amount changed
      if (currentBookingId) {
        const previouslyPaid = parseFloat(formData.paid_amount) || 0;

        if (totalPaidValue !== previouslyPaid) {
          // Check if a transaction already exists for this booking
          const { data: existingTransaction } = await supabase
            .from('transactions')
            .select('id, amount')
            .eq('booking_id', currentBookingId)
            .eq('type', 'Income')
            .maybeSingle();

          if (totalPaidValue > 0) {
            if (existingTransaction) {
              // Update existing transaction with new total
              await supabase
                .from('transactions')
                .update({
                  amount: totalPaidValue,
                  payment_method: formData.payment_method,
                  date: format(new Date(), 'yyyy-MM-dd')
                })
                .eq('id', existingTransaction.id);
            } else {
              // Create new transaction only if none exists
              await supabase.from('transactions').insert([{
                booking_id: currentBookingId,
                type: 'Income',
                category: `Booking Payment - ${formData.guest_name}`,
                amount: totalPaidValue,
                payment_method: formData.payment_method,
                date: format(new Date(), 'yyyy-MM-dd')
              }]);
            }
          } else if (existingTransaction) {
            // If payment is now 0, delete the transaction
            await supabase
              .from('transactions')
              .delete()
              .eq('id', existingTransaction.id);
          }
        }
      }

      setIsModalOpen(false);
      fetchData();

      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Booking saved successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Save error:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error saving booking: ' + error.message,
        type: 'error'
      });
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-300 flex justify-between items-center bg-white z-20 relative shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Reservations</h1>
              <p className="text-xs text-gray-500">{format(startDate, 'MMMM yyyy')}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-300 mx-2"></div>
          <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
            <button onClick={() => setStartDate(addDays(startDate, -7))} className="p-1.5 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setStartDate(addDays(today, -2))} className="px-3 py-1 text-sm font-semibold text-gray-700 hover:text-emerald-600 transition-colors">
              Today
            </button>
            <button onClick={() => setStartDate(addDays(startDate, 7))} className="p-1.5 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <button
          onClick={handleNewBooking}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition-all"
        >
          <Plus size={16} />
          New Booking
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto relative custom-scrollbar">
          {/* Header Row */}
          <div className="sticky top-0 z-10 bg-white flex border-b border-gray-300" style={{ height: HEADER_HEIGHT, minWidth: 'max-content' }}>
            <div
              className="sticky left-0 z-20 bg-white border-r border-gray-300 flex flex-col justify-end p-4 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]"
              style={{ width: SIDEBAR_WIDTH }}
            >
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rooms & Beds</span>
              <span className="font-bold text-gray-800 text-lg mt-1">All Rooms</span>
            </div>
            <div className="flex">
              {dates.map(date => {
                const isToday = isSameDay(date, today);
                return (
                  <div
                    key={date.toString()}
                    className={`flex-shrink-0 border-r flex flex-col text-center group ${isToday ? 'bg-emerald-100 border-emerald-300' : 'bg-white border-gray-300'}`}
                    style={{ width: CELL_WIDTH }}
                  >
                    <div className={`flex-1 flex items-end justify-center pb-2 border-b ${isToday ? 'border-emerald-200' : 'border-gray-200'}`}>
                      <span className={`text-xs font-medium uppercase ${isToday ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {format(date, 'EEE')}
                      </span>
                    </div>
                    <div className={`h-10 flex items-center justify-center font-bold text-lg ${isToday ? 'text-white bg-emerald-500' : 'text-gray-800 group-hover:bg-gray-50'}`}>
                      {format(date, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body Rows */}
          <div className="relative" style={{ minWidth: 'max-content' }}>
            {loading ? (
              <div className="p-10 text-center text-gray-500">Loading calendar data...</div>
            ) : rows.map(row => (
              <div
                key={row.id}
                className={`flex border-b border-gray-300 hover:bg-gray-50/50 transition-colors ${row.type === 'header' ? 'bg-gray-100/80 h-10' : 'h-16'}`}
              >
                {/* Sidebar Cell */}
                <div
                  className={`sticky left-0 z-20 border-r border-gray-300 flex-shrink-0 flex items-center px-4 justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)] ${row.type === 'header' ? 'bg-gray-100 text-gray-600' : 'bg-white'}`}
                  style={{ width: SIDEBAR_WIDTH }}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {row.type === 'header' && (
                      <span className="font-bold text-sm truncate">{row.name}</span>
                    )}
                    {row.type === 'room' && (
                      <>
                        <div className="w-1 h-8 bg-purple-500 rounded-full"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800 text-sm truncate">{row.name}</span>
                            {row.has_bathroom && <ShowerHead size={14} className="text-blue-500 flex-shrink-0" />}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Manage Prices</div>
                        </div>
                      </>
                    )}
                    {row.type === 'room_booking' && (
                      <>
                        <div className="w-8 flex justify-center opacity-50">
                          <Bed size={14} className="text-gray-400" />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 italic truncate opacity-70">{row.name}</span>
                      </>
                    )}
                    {row.type === 'bed' && (
                      <>
                        <div className="w-8 flex justify-center">
                          <Bed size={16} className="text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 truncate">{row.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Timeline Cells */}
                <div className="flex relative" onDragEnd={handleDragEnd}>
                  {dates.map(date => {
                    const roomId = row.type === 'room' ? row.id : row.parentId;
                    const rate = roomId ? getDailyRate(roomId, date) : null;
                    const isRoomHeader = row.type === 'room';
                    const isToday = isSameDay(date, today);
                    const isSelected = isCellInSelection(row, date);
                    const isClickable = row.type === 'bed' || row.type === 'room_booking';

                    return (
                      <div
                        key={date.toString()}
                        className={`flex-shrink-0 border-r h-full flex items-center justify-center transition-all
                          ${isRoomHeader ? 'hover:bg-emerald-50 cursor-pointer' : ''}
                          ${isClickable ? 'hover:bg-blue-50 cursor-pointer' : ''}
                          ${isToday ? 'bg-emerald-50 border-emerald-200' : 'border-gray-300'}
                          ${isSelected ? 'bg-blue-200 ring-2 ring-blue-400 ring-inset' : ''}
                        `}
                        style={{ width: CELL_WIDTH }}
                        onClick={() => {
                          if (isRoomHeader) {
                            handlePriceEdit(row, date, rate);
                          } else if (isClickable) {
                            handleCellClick(row, date);
                          }
                        }}
                        onDragOver={(e) => handleDragOver(e, date)}
                        onDrop={handleDrop}
                      >
                        {isRoomHeader && (
                          <span className="text-[11px] font-bold text-emerald-700">
                            ${rate || rooms.find(r => r.id === row.id)?.price_per_night || '--'}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Bookings */}
                  {row.type !== 'header' && getResourceBookings(row, row.type).map(booking => {
                    const nights = differenceInDays(parseISO(booking.check_out_date), parseISO(booking.check_in_date));
                    const isShortStay = nights <= 2;
                    const fullName = booking.guests?.full_name || 'Unknown';
                    // For short stays, show first name only or initials
                    const displayName = isShortStay
                      ? (fullName.split(' ')[0] || fullName.substring(0, 8))
                      : fullName;

                    const barStyle = getBarStyle(booking);
                    const { clipPath, isClippedLeft, isClippedRight, ...wrapperStyle } = barStyle;

                    // Don't render if hidden
                    if (barStyle.display === 'none') return null;

                    // Adjust padding based on clipping
                    const paddingLeft = isClippedLeft ? 'pl-3' : (isShortStay ? 'pl-7' : 'pl-8');
                    const paddingRight = isClippedRight ? 'pr-3' : (isShortStay ? 'pr-7' : 'pr-10');

                    return (
                      // Shadow wrapper - applies drop-shadow to the clipped child
                      <div
                        key={booking.id}
                        style={{
                          ...wrapperStyle,
                          filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.25))'
                        }}
                        onClick={() => handleBookingClick(booking)}
                        className="cursor-pointer group z-10"
                        title={`${fullName} (${booking.status}) - ${nights} night${nights > 1 ? 's' : ''}`}
                      >
                        {/* Inner bar with clip-path */}
                        <div
                          style={{ clipPath }}
                          className={`h-full w-full ${getStatusColor(booking.status)} transition-all group-hover:brightness-110 relative`}
                        >
                          <div className={`h-full w-full flex items-center gap-1 relative ${paddingLeft} ${paddingRight}`}>
                            <span className="font-bold text-xs text-white truncate drop-shadow-md">
                              {displayName}
                            </span>

                            {/* Status Indicators */}
                            <div className={`flex items-center gap-1 ml-auto ${isShortStay && !isClippedRight ? '' : 'pr-2'}`}>
                              {parseFloat(booking.paid_amount || 0) < parseFloat(booking.total_amount || 0) && (
                                <div
                                  className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse flex-shrink-0"
                                  title={`Pending Payment: $${(parseFloat(booking.total_amount) - parseFloat(booking.paid_amount || 0)).toFixed(2)}`}
                                />
                              )}
                            </div>
                          </div>

                          {/* Drag handle on right edge to extend booking */}
                          {!isClippedRight && (
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, booking)}
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
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedBooking ? 'Edit Booking' : 'New Guest & Booking'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveBooking} className="space-y-6">
              {/* Conflict Warning */}
              {conflictWarning && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                  <AlertCircle size={20} className="flex-shrink-0" />
                  <span className="text-sm font-semibold">{conflictWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Personal Info */}
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <User size={18} className="text-emerald-600" /> Personal Info
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name *</label>
                    <input
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="John Doe"
                      value={formData.guest_name}
                      onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Country *</label>
                      <select
                        required
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        value={formData.nationality}
                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {COUNTRIES.map(country => (
                          <option key={country.code} value={country.name}>{country.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Gender</label>
                      <select
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {GENDERS.map(g => (
                          <option key={g.code} value={g.code}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Document Type</label>
                      <select
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        value={formData.document_type}
                        onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                      >
                        {DOCUMENT_TYPES.map(doc => (
                          <option key={doc.code} value={doc.code}>{doc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Document # *</label>
                      <input
                        required
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                        placeholder="A12345678"
                        value={formData.passport}
                        onChange={(e) => setFormData({ ...formData, passport: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>

                {/* Right Column - Contact Info */}
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Mail size={18} className="text-emerald-600" /> Contact Info
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone / WhatsApp *</label>
                    <input
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="+1 234 567 890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider pt-2 flex items-center gap-2">
                    <Phone size={14} className="text-orange-500" /> Emergency Contact
                  </h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contact Name</label>
                    <input
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="Jane Doe"
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contact Phone</label>
                    <input
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="+1 234 567 890"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Booking Details Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <CalendarIcon size={18} className="text-emerald-600" /> Booking Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Room / Bed Selection</label>
                    <select
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                      value={formData.room_id}
                      onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    >
                      <option value="">Select a room or bed...</option>
                      {rooms.map(room => (
                        <optgroup key={room.id} label={room.name}>
                          {room.type === 'Private' ? (
                            <option value={room.id}>{room.name} (Private Room)</option>
                          ) : (
                            room.beds?.map(bed => (
                              <option key={bed.id} value={bed.id}>{room.name} - Bed {bed.bed_number}</option>
                            ))
                          )}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Check-in</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      value={formData.check_in}
                      onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Check-out</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      value={formData.check_out}
                      onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Booking Status</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Confirmed">Confirmed</option>
                      <option value="Checked-in">Checked-in</option>
                      <option value="Checked-out">Checked-out</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Payment Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-end border-b pb-2">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                    Initial Payment & Totals
                  </h3>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Estimated Total</span>
                    <span className="text-xl font-black text-emerald-600">${formData.total_amount}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Total Paid ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                      placeholder="0.00"
                      value={formData.initial_payment}
                      onChange={(e) => setFormData({ ...formData, initial_payment: e.target.value })}
                    />
                    {/* Show remaining balance */}
                    {(() => {
                      const totalAmount = parseFloat(formData.total_amount) || 0;
                      const totalPaid = parseFloat(formData.initial_payment) || 0;
                      const remaining = totalAmount - totalPaid;

                      if (remaining > 0 && totalAmount > 0) {
                        return (
                          <div className="mt-2 text-sm">
                            <span className="text-red-500">Remaining: </span>
                            <span className="font-bold text-red-600">${remaining.toFixed(2)}</span>
                          </div>
                        );
                      } else if (totalPaid >= totalAmount && totalAmount > 0) {
                        return (
                          <div className="mt-2 text-sm text-emerald-600 font-semibold flex items-center gap-1">
                            <Check size={14} /> Fully Paid
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Payment Method</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Pix">Pix</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!!conflictWarning}
                  className={`px-8 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${conflictWarning ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}
                >
                  {selectedBooking ? 'Save Changes' : 'Confirm Registration & Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      {/* Price Edit Modal */}
      {priceModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Adjust Price</h3>
            <p className="text-sm text-gray-500 mb-4">
              Setting price for <span className="font-semibold text-gray-800">{priceModal.room.name}</span> on <span className="font-semibold text-gray-800">{format(priceModal.date, 'MMMM d, yyyy')}</span>
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">New Price per Night</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={priceModal.price}
                  onChange={(e) => setPriceModal({ ...priceModal, price: e.target.value })}
                  className="w-full pl-7 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPriceModal({ ...priceModal, isOpen: false })}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveDailyRate}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-md"
              >
                Save Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
