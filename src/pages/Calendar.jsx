import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, addDays, eachDayOfInterval, isSameDay, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Bed, User, Check, X, Mail, AlertCircle, Phone, ShowerHead, Lock } from 'lucide-react';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';
import { COUNTRIES, DOCUMENT_TYPES, GENDERS } from '../constants/countries';
import { formatCurrencyInput, parseCurrencyToNumber, numberToInputFormat } from '../utils/currency';
import { useCurrency } from '../hooks/useCurrency';
import { BookingBar, LockBar, DateCell, RowSidebar } from '../components/calendar';

// Convert countries to react-select format with popular countries first
const POPULAR_COUNTRIES = ['BR', 'AR', 'US', 'PT', 'ES', 'FR', 'DE', 'GB', 'IT', 'CL', 'CO', 'MX', 'UY', 'PY'];
const countryOptions = [
  {
    label: 'Mais comuns',
    options: COUNTRIES
      .filter(c => POPULAR_COUNTRIES.includes(c.code))
      .sort((a, b) => POPULAR_COUNTRIES.indexOf(a.code) - POPULAR_COUNTRIES.indexOf(b.code))
      .map(c => ({ value: c.name, label: c.name }))
  },
  {
    label: 'Todos os países',
    options: COUNTRIES.map(c => ({ value: c.name, label: c.name }))
  }
];

// Custom styles for react-select to match the design
const selectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'rgb(249, 250, 251)',
    borderColor: state.isFocused ? 'rgb(16, 185, 129)' : 'rgb(229, 231, 235)',
    borderRadius: '0.5rem',
    padding: '0',
    minHeight: '38px',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
    '&:hover': { borderColor: 'rgb(16, 185, 129)' }
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    zIndex: 50
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? 'rgb(16, 185, 129)' : state.isFocused ? 'rgb(236, 253, 245)' : 'white',
    color: state.isSelected ? 'white' : 'rgb(17, 24, 39)',
    fontSize: '0.875rem',
    padding: '8px 12px',
    cursor: 'pointer'
  }),
  groupHeading: (base) => ({
    ...base,
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'rgb(156, 163, 175)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '8px 12px 4px'
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: '0.875rem',
    color: 'rgb(17, 24, 39)'
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: '0.875rem',
    color: 'rgb(209, 213, 219)'
  }),
  input: (base) => ({
    ...base,
    fontSize: '0.875rem'
  })
};

// Responsive dimensions - will be used with CSS variables
const CELL_WIDTH = 120; // Width of each day column (desktop)
const CELL_WIDTH_MOBILE = 80; // Width of each day column (mobile)
const HEADER_HEIGHT = 96; // Height of the date header
const HEADER_HEIGHT_MOBILE = 72; // Height of the date header (mobile)
const SIDEBAR_WIDTH = 240; // Width of the room sidebar (desktop)
const SIDEBAR_WIDTH_MOBILE = 140; // Width of the room sidebar (mobile)

const Calendar = () => {
  const { formatCurrency } = useCurrency();
  const [today] = useState(new Date());
  // Start 2 days before today to show recent bookings
  const [startDate, setStartDate] = useState(addDays(today, -2));

  // Responsive dimensions
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const cellWidth = isMobile ? CELL_WIDTH_MOBILE : CELL_WIDTH;
  const headerHeight = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;
  const sidebarWidth = isMobile ? SIDEBAR_WIDTH_MOBILE : SIDEBAR_WIDTH;
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
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
    displayTotalAmount: '',
    paid_amount: 0,
    initial_payment: '',
    displayInitialPayment: '',
    payment_method: 'Cash',
    booking_notes: ''
  });

  // Currency input handlers
  const handleInitialPaymentChange = (e) => {
    const formatted = formatCurrencyInput(e.target.value);
    const numericValue = parseCurrencyToNumber(formatted);
    setFormData(prev => ({
      ...prev,
      displayInitialPayment: formatted,
      initial_payment: numericValue
    }));
  };

  const [conflictWarning, setConflictWarning] = useState(null);

  // Booking context - tracks which room/bed was clicked on calendar
  // null = new booking from button (show all rooms)
  // { roomId, roomType } = clicked from calendar (filter options)
  const [bookingContext, setBookingContext] = useState(null);

  // Price Edit Modal State
  const [priceModal, setPriceModal] = useState({
    isOpen: false,
    room: null,
    date: null,
    price: '',
    displayPrice: ''
  });

  const handlePriceChange = (e) => {
    const formatted = formatCurrencyInput(e.target.value);
    const numericValue = parseCurrencyToNumber(formatted);
    setPriceModal(prev => ({
      ...prev,
      displayPrice: formatted,
      price: numericValue
    }));
  };

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

  // Action popup after selecting dates
  const [actionPopup, setActionPopup] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    checkIn: null,
    checkOut: null,
    resourceId: null,
    resourceType: null,
    roomId: null
  });

  // Drag to extend booking state
  const [dragState, setDragState] = useState({
    isDragging: false,
    booking: null,
    originalEndDate: null,
    currentEndDate: null
  });

  // Cancel confirmation modal
  const [cancelConfirm, setCancelConfirm] = useState({
    isOpen: false,
    booking: null
  });

  // Date Locks state
  const [dateLocks, setDateLocks] = useState([]);
  const [lockModal, setLockModal] = useState({
    isOpen: false,
    lock: null, // null = new, object = editing
    roomId: null,
    bedId: null,
    startDate: '',
    endDate: '',
    lockType: 'Voluntariado',
    description: ''
  });

  // Generate dates for the view (3 months = ~90 days) - memoized to avoid recreation on every render
  const dates = useMemo(() => eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 89) // Show 90 days (3 months)
  }), [startDate]);

  useEffect(() => {
    fetchData();
  }, [startDate]);

  // Real-time conflict detection and price calculation
  useEffect(() => {
    if (isModalOpen) {
      checkConflicts();
      // Only calculate total for NEW bookings, not when editing existing ones
      if (!selectedBooking) {
        calculateTotal();
      }
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

  // Close modals on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (cancelConfirm.isOpen) {
          setCancelConfirm({ isOpen: false, booking: null });
        } else if (actionPopup.isOpen) {
          setActionPopup({ ...actionPopup, isOpen: false });
        } else if (lockModal.isOpen) {
          setLockModal({ ...lockModal, isOpen: false });
        } else if (priceModal.isOpen) {
          setPriceModal({ ...priceModal, isOpen: false });
        } else if (isModalOpen) {
          setIsModalOpen(false);
        } else if (alertModal.isOpen) {
          setAlertModal({ ...alertModal, isOpen: false });
        } else if (dateSelection.isSelecting) {
          setDateSelection({ isSelecting: false, startDate: null, endDate: null, rowId: null, rowType: null });
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, priceModal.isOpen, alertModal.isOpen, actionPopup.isOpen, lockModal.isOpen, dateSelection.isSelecting, cancelConfirm.isOpen]);

  // Ref for modal content (to detect clicks outside)
  const modalRef = useRef(null);

  // Handle click outside modal
  const handleBackdropClick = useCallback((e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      setIsModalOpen(false);
    }
  }, []);

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
        setConflictWarning(`Conflito: já reservado por ${data[0].guests?.full_name}`);
        return;
      }

      // Also check for date locks
      // For lock comparison, we need to check if booking period overlaps with lock period
      // Lock end_date is inclusive, so add 1 day for comparison
      let lockQuery = supabase
        .from('date_locks')
        .select('id, lock_type, start_date, end_date')
        .lt('start_date', check_out)
        .gte('end_date', check_in.substring(0, 10));

      if (targetBedId) {
        lockQuery = lockQuery.eq('bed_id', targetBedId);
      } else {
        lockQuery = lockQuery.eq('room_id', targetRoomId).is('bed_id', null);
      }

      const { data: lockData } = await lockQuery;
      if (lockData && lockData.length > 0) {
        const lockTypeLabel = lockData[0].lock_type === 'Outro' ? 'Bloqueado' : lockData[0].lock_type;
        setConflictWarning(`Conflito: período bloqueado (${lockTypeLabel})`);
        return;
      }

      setConflictWarning(null);
    } catch (e) {
      console.error("Conflict check error:", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const rangeStart = format(startDate, 'yyyy-MM-dd');
      const rangeEnd = format(addDays(startDate, 90), 'yyyy-MM-dd');

      // Execute all queries in parallel for faster loading
      const [roomsResult, bookingsResult, ratesResult, locksResult] = await Promise.all([
        // 1. Fetch Rooms and Beds (only active rooms)
        supabase
          .from('rooms')
          .select(`*, beds (*)`)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name'),

        // 2. Fetch Bookings for the date range (90 days)
        supabase
          .from('bookings')
          .select(`
            *,
            guests (
              id, full_name, email, phone, nationality, passport_id,
              document_type, gender, date_of_birth,
              emergency_contact_name, emergency_contact_phone, notes
            )
          `)
          .lt('check_in_date', rangeEnd)
          .gt('check_out_date', rangeStart),

        // 3. Fetch Daily Rates
        supabase
          .from('daily_rates')
          .select('*')
          .gte('date', rangeStart)
          .lte('date', rangeEnd),

        // 4. Fetch Date Locks
        supabase
          .from('date_locks')
          .select('*')
          .lt('start_date', rangeEnd)
          .gt('end_date', rangeStart)
      ]);

      // Check for errors
      if (roomsResult.error) throw roomsResult.error;
      if (bookingsResult.error) throw bookingsResult.error;
      if (ratesResult.error) throw ratesResult.error;
      if (locksResult.error) throw locksResult.error;

      // Filter out inactive beds (status !== 'Active')
      const roomsWithActiveBeds = (roomsResult.data || []).map(room => ({
        ...room,
        beds: room.beds?.filter(bed => bed.status === 'Active') || []
      }));

      // Update all states
      setRooms(roomsWithActiveBeds);
      setBookings(bookingsResult.data || []);
      setDailyRates(ratesResult.data || []);
      setDateLocks(locksResult.data || []);

    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save date lock
  const handleSaveLock = async () => {
    try {
      const { startDate, endDate, roomId, bedId } = lockModal;

      // Check for conflicts with existing bookings
      // Lock end_date is inclusive, so we need to add 1 day for comparison
      const lockEndForComparison = format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd');

      let conflictQuery = supabase
        .from('bookings')
        .select('id, guests(full_name)')
        .neq('status', 'Cancelled')
        .lt('check_in_date', lockEndForComparison)
        .gt('check_out_date', startDate);

      if (bedId) {
        conflictQuery = conflictQuery.eq('bed_id', bedId);
      } else {
        conflictQuery = conflictQuery.eq('room_id', roomId).is('bed_id', null);
      }

      const { data: conflictingBookings } = await conflictQuery;

      if (conflictingBookings && conflictingBookings.length > 0) {
        const guestName = conflictingBookings[0].guests?.full_name || 'Hóspede';
        setAlertModal({
          isOpen: true,
          title: 'Conflito de Datas',
          message: `Não é possível bloquear: já existe reserva de "${guestName}" neste período.`,
          type: 'error'
        });
        return;
      }

      // Check for conflicts with existing locks (excluding current lock if editing)
      let lockConflictQuery = supabase
        .from('date_locks')
        .select('id, lock_type')
        .lt('start_date', lockEndForComparison)
        .gte('end_date', startDate);

      if (bedId) {
        lockConflictQuery = lockConflictQuery.eq('bed_id', bedId);
      } else {
        lockConflictQuery = lockConflictQuery.eq('room_id', roomId).is('bed_id', null);
      }

      if (lockModal.lock) {
        lockConflictQuery = lockConflictQuery.neq('id', lockModal.lock.id);
      }

      const { data: conflictingLocks } = await lockConflictQuery;

      if (conflictingLocks && conflictingLocks.length > 0) {
        setAlertModal({
          isOpen: true,
          title: 'Conflito de Datas',
          message: `Já existe um bloqueio (${conflictingLocks[0].lock_type}) neste período.`,
          type: 'error'
        });
        return;
      }

      // No conflicts, proceed with save
      const lockData = {
        room_id: bedId ? null : roomId,
        bed_id: bedId || null,
        start_date: startDate,
        end_date: endDate,
        lock_type: lockModal.lockType,
        description: lockModal.lockType === 'Outro' ? lockModal.description : null
      };

      if (lockModal.lock) {
        const { error } = await supabase
          .from('date_locks')
          .update(lockData)
          .eq('id', lockModal.lock.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('date_locks')
          .insert([lockData]);
        if (error) throw error;
      }

      setLockModal({ ...lockModal, isOpen: false });
      fetchData();
      setAlertModal({
        isOpen: true,
        title: 'Sucesso',
        message: 'Bloqueio salvo com sucesso',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving lock:', error);
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao salvar bloqueio: ' + error.message,
        type: 'error'
      });
    }
  };

  // Delete date lock
  const handleDeleteLock = async (lockId) => {
    try {
      const { error } = await supabase
        .from('date_locks')
        .delete()
        .eq('id', lockId);
      if (error) throw error;

      setLockModal({ ...lockModal, isOpen: false });
      fetchData();
      setAlertModal({
        isOpen: true,
        title: 'Sucesso',
        message: 'Bloqueio removido',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting lock:', error);
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao remover bloqueio',
        type: 'error'
      });
    }
  };

  // Prepare rows for the calendar (Rooms and Beds) - memoized to avoid recreation on every render
  const rows = useMemo(() => {
    const result = [];
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
      result.push({
        id: room.id,
        name: roomDisplayName,
        type: 'room',
        capacity: room.capacity,
        isPrivate: room.type !== 'Dorm',
        room_id: room.id, // for pricing lookups
        has_bathroom: room.has_bathroom
      });

      // If NOT Dorm (Private, Family, Suite, Double, etc.), add a Row for the actual booking
      if (room.type !== 'Dorm') {
        result.push({
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
          result.push({
            id: bed.id,
            parentId: room.id,
            name: `Bed ${bed.bed_number}`,
            type: 'bed'
          });
        });
      }
    });
    return result;
  }, [rooms]);

  // ============================================================================
  // PHASE 2: Pre-computed Maps for O(1) lookups
  // ============================================================================

  // Bloco 2.1: Map de bookings por resource (bed_id ou room_id)
  // Substitui: bookings.filter(b => b.bed_id === row.id)
  const bookingsMap = useMemo(() => {
    const map = new Map();

    bookings.forEach(b => {
      // Skip cancelled bookings
      if (b.status === 'Cancelled') return;

      // Bookings com bed_id (camas específicas)
      if (b.bed_id) {
        const key = `bed-${b.bed_id}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(b);
      }

      // Bookings de quarto inteiro (sem bed_id)
      if (!b.bed_id && b.room_id) {
        const key = `room-${b.room_id}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(b);
      }
    });

    return map;
  }, [bookings]);

  // Bloco 2.2: Map de locks por resource
  // Substitui: dateLocks.filter(lock => lock.bed_id === row.id)
  const locksMap = useMemo(() => {
    const map = new Map();

    dateLocks.forEach(lock => {
      // Locks com bed_id (camas específicas)
      if (lock.bed_id) {
        const key = `bed-${lock.bed_id}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(lock);
      }

      // Locks de quarto inteiro (sem bed_id)
      if (!lock.bed_id && lock.room_id) {
        const key = `room-${lock.room_id}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(lock);
      }
    });

    return map;
  }, [dateLocks]);

  // Bloco 2.3: Map de rates por room/date
  // Substitui: dailyRates.find(r => r.room_id === roomId && r.date === date)
  const ratesMap = useMemo(() => {
    const map = new Map();

    dailyRates.forEach(rate => {
      map.set(`${rate.room_id}-${rate.date}`, rate.price);
    });

    return map;
  }, [dailyRates]);

  const getResourceBookings = (row, type) => {
    // Room Header rows (type 'room') never show bookings
    if (type === 'room') return [];

    // Determinar a chave baseada no tipo
    const key = type === 'bed' ? `bed-${row.id}` : `room-${row.parentId}`;

    // O(1) lookup no Map pré-computado
    return bookingsMap.get(key) || [];
  };

  const getResourceLocks = (row, type) => {
    // Room Header rows (type 'room') never show locks
    if (type === 'room') return [];

    // Determinar a chave baseada no tipo
    const key = type === 'bed' ? `bed-${row.id}` : `room-${row.parentId}`;

    // O(1) lookup no Map pré-computado
    return locksMap.get(key) || [];
  };

  const getLockBarStyle = (lock) => {
    const start = parseISO(lock.start_date);
    const end = addDays(parseISO(lock.end_date), 1); // end_date is inclusive

    const visibleRangeStart = startOfDay(startDate);
    const visibleRangeEnd = addDays(startDate, dates.length);

    const offsetDays = differenceInDays(startOfDay(start), visibleRangeStart);
    const durationDays = differenceInDays(end, start);

    const isClippedLeft = startOfDay(start) < visibleRangeStart;
    const isClippedRight = end > visibleRangeEnd;

    const visibleStartDays = isClippedLeft ? 0 : offsetDays;
    const clippedDaysStart = isClippedLeft ? Math.abs(offsetDays) : 0;
    const endOffsetDays = offsetDays + durationDays;
    const clippedDaysEnd = isClippedRight ? Math.max(0, endOffsetDays - dates.length) : 0;
    const visibleDurationDays = durationDays - clippedDaysStart - clippedDaysEnd;

    if (visibleDurationDays <= 0) {
      return { display: 'none' };
    }

    // Same positioning as bookings - start at middle of first day
    const leftPosition = isClippedLeft
      ? 0
      : (visibleStartDays * cellWidth) + (cellWidth / 2);

    // Same width calculation as bookings
    let width = visibleDurationDays * cellWidth;
    if (isClippedLeft) width += cellWidth / 2;
    if (isClippedRight) width += cellWidth / 2;

    // Same clip-path as bookings - adjust angle for short locks
    const isShortLock = visibleDurationDays <= 2;
    const slantSize = isShortLock ? '15px' : '25px';

    let clipPath;
    if (isClippedLeft && isClippedRight) {
      clipPath = 'none';
    } else if (isClippedLeft) {
      clipPath = `polygon(0 0, 100% 0, calc(100% - ${slantSize}) 100%, 0 100%)`;
    } else if (isClippedRight) {
      clipPath = `polygon(${slantSize} 0, 100% 0, 100% 100%, 0 100%)`;
    } else {
      clipPath = `polygon(${slantSize} 0, 100% 0, calc(100% - ${slantSize}) 100%, 0 100%)`;
    }

    const verticalPadding = isMobile ? '6px' : '8px';

    return {
      left: `${leftPosition}px`,
      width: `${width}px`,
      position: 'absolute',
      top: verticalPadding,
      bottom: verticalPadding,
      zIndex: 1,
      clipPath,
      isClippedLeft,
      isClippedRight,
      isShortLock
    };
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
      : (visibleStartDays * cellWidth) + (cellWidth / 2);

    // Calculate width
    // Normal: spans durationDays cells
    // Clipped left: add cellWidth/2 since we start at edge, not middle
    // Clipped right: add cellWidth/2 since we end at edge, not middle
    let width = visibleDurationDays * cellWidth;
    if (isClippedLeft) width += cellWidth / 2;
    if (isClippedRight) width += cellWidth / 2;

    // Adjust clip-path based on clipping and duration
    // Shorter stays get smaller slant angles to maximize text space
    const isVeryShortBooking = durationDays === 1;
    const isShortBooking = durationDays <= 2;
    const slantSize = isVeryShortBooking ? '12px' : isShortBooking ? '18px' : '25px';

    // Normal: / / (slanted both sides)
    // Clipped left: | / (flat left, slanted right)
    // Clipped right: / | (slanted left, flat right)
    // Both clipped: | | (flat both sides)
    let clipPath;
    if (isClippedLeft && isClippedRight) {
      clipPath = 'none'; // Rectangle
    } else if (isClippedLeft) {
      clipPath = `polygon(0 0, 100% 0, calc(100% - ${slantSize}) 100%, 0 100%)`; // Flat left
    } else if (isClippedRight) {
      clipPath = `polygon(${slantSize} 0, 100% 0, 100% 100%, 0 100%)`; // Flat right
    } else {
      clipPath = `polygon(${slantSize} 0, 100% 0, calc(100% - ${slantSize}) 100%, 0 100%)`; // Normal
    }

    // Responsive vertical positioning (smaller rows now)
    const verticalPadding = isMobile ? '6px' : '8px';

    return {
      left: `${leftPosition}px`,
      width: `${width}px`,
      position: 'absolute',
      top: verticalPadding,
      bottom: verticalPadding,
      zIndex: 1,
      clipPath,
      isClippedLeft,
      isClippedRight,
      isVeryShortBooking
    };
  };


  const getDailyRate = (roomId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // O(1) lookup no Map pré-computado
    return ratesMap.get(`${roomId}-${dateStr}`) || null;
  };

  const handlePriceEdit = (row, date, currentRate) => {
    const defaultPrice = rooms.find(r => r.id === row.id)?.price_per_night || 0;
    const price = currentRate || defaultPrice;
    setPriceModal({
      isOpen: true,
      room: row,
      date: date,
      price: parseFloat(price) || 0,
      displayPrice: numberToInputFormat(price)
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
        title: 'Sucesso',
        message: 'Preço atualizado com sucesso',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving daily rate:', error);
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível atualizar o preço',
        type: 'error'
      });
    }
  };

  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    setBookingContext(null); // Allow changing room when editing existing booking
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
      total_amount: parseFloat(booking.total_amount) || 0,
      displayTotalAmount: numberToInputFormat(booking.total_amount),
      paid_amount: parseFloat(booking.paid_amount || 0),
      initial_payment: parseFloat(booking.paid_amount) || 0,
      displayInitialPayment: numberToInputFormat(booking.paid_amount),
      payment_method: 'Cash',
      booking_notes: booking.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleNewBooking = () => {
    setSelectedBooking(null);
    setBookingContext(null); // Show all rooms when clicking "New Booking" button
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
      room_id: '',
      status: 'Confirmed',
      total_amount: '',
      displayTotalAmount: '',
      paid_amount: 0,
      initial_payment: '',
      displayInitialPayment: '',
      payment_method: 'Cash',
      booking_notes: ''
    });
    setConflictWarning(null);
    setIsModalOpen(true);
  };

  // Handle cell click for date selection
  const handleCellClick = (e, row, date) => {
    // Only allow selection on bed or room_booking rows (not room headers)
    if (row.type !== 'bed' && row.type !== 'room_booking') return;

    const dateStr = format(date, 'yyyy-MM-dd');
    const resourceId = row.type === 'bed' ? row.id : row.parentId;
    const parentRoomId = row.type === 'bed' ? row.parentId : row.parentId;

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

      // Reset selection state
      setDateSelection({
        isSelecting: false,
        startDate: null,
        endDate: null,
        rowId: null,
        rowType: null
      });

      // Show action popup
      const rect = e.currentTarget.getBoundingClientRect();
      setActionPopup({
        isOpen: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
        checkIn: checkIn,
        checkOut: format(addDays(parseISO(checkOut), 1), 'yyyy-MM-dd'), // checkout is next day
        resourceId: resourceId,
        resourceType: row.type,
        roomId: parentRoomId,
        bedId: row.type === 'bed' ? row.id : null
      });
    }
  };

  // Handle action from popup - create booking
  const handleActionBooking = () => {
    const { checkIn, checkOut, resourceId, roomId } = actionPopup;
    const parentRoom = rooms.find(r => r.id === roomId);

    setBookingContext({
      roomId: roomId,
      roomType: parentRoom?.type || 'Dorm',
      roomName: parentRoom?.name || ''
    });

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
      displayTotalAmount: '',
      paid_amount: 0,
      initial_payment: '',
      displayInitialPayment: '',
      payment_method: 'Cash',
      booking_notes: ''
    });
    setConflictWarning(null);
    setActionPopup({ ...actionPopup, isOpen: false });
    setIsModalOpen(true);
  };

  // Handle action from popup - create lock
  const handleActionLock = () => {
    const { checkIn, checkOut, roomId, bedId } = actionPopup;

    setLockModal({
      isOpen: true,
      lock: null,
      roomId: roomId,
      bedId: bedId,
      startDate: checkIn,
      endDate: format(addDays(parseISO(checkOut), -1), 'yyyy-MM-dd'), // end date is inclusive
      lockType: 'Voluntariado',
      description: ''
    });
    setActionPopup({ ...actionPopup, isOpen: false });
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
      const paidAmount = parseFloat(booking.paid_amount || 0);

      // Check if paid amount exceeds new total (constraint: paid_amount <= total_amount)
      // If reducing days and already paid more than new total, we need to adjust paid_amount
      let adjustedPaidAmount = paidAmount;
      let refundDue = 0;

      if (paidAmount > newTotal) {
        refundDue = paidAmount - newTotal;
        adjustedPaidAmount = newTotal; // Cap at total to satisfy constraint
      }

      // Update booking in database with new checkout, total, and adjusted paid amount
      const updateData = {
        check_out_date: currentEndDate,
        total_amount: newTotal.toFixed(2)
      };

      // Only update paid_amount if it needed adjustment
      if (refundDue > 0) {
        updateData.paid_amount = adjustedPaidAmount.toFixed(2);
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (error) throw error;

      // Refresh data
      fetchData();

      // Show alert with price difference info
      const newBalance = newTotal - adjustedPaidAmount;

      let message = `Check-out alterado para ${format(newCheckOutDate, 'dd/MM/yyyy')}\n`;
      message += `Novo total: ${formatCurrency(newTotal)}`;
      if (difference > 0) {
        message += ` (+${formatCurrency(difference)})`;
      } else if (difference < 0) {
        message += ` (-${formatCurrency(Math.abs(difference))})`;
      }
      if (refundDue > 0) {
        message += `\n⚠️ Reembolso devido: ${formatCurrency(refundDue)}`;
      } else if (newBalance > 0) {
        message += `\nSaldo pendente: ${formatCurrency(newBalance)}`;
      }

      let alertType = 'success';
      if (refundDue > 0) {
        alertType = 'warning';
      } else if (newBalance > 0) {
        alertType = 'warning';
      }

      setAlertModal({
        isOpen: true,
        title: 'Reserva Atualizada',
        message: message,
        type: alertType
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

  // Cancel booking - show confirmation modal
  const handleCancelBooking = () => {
    if (!selectedBooking) return;
    setCancelConfirm({
      isOpen: true,
      booking: selectedBooking
    });
  };

  // Confirm cancel booking (soft delete)
  const confirmCancelBooking = async () => {
    const booking = cancelConfirm.booking;
    if (!booking) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'Cancelled' })
        .eq('id', booking.id);

      if (error) throw error;

      setCancelConfirm({ isOpen: false, booking: null });
      setIsModalOpen(false);
      fetchData();
      setAlertModal({
        isOpen: true,
        title: 'Reserva Cancelada',
        message: `A reserva de ${booking.guests?.full_name || 'hóspede'} foi cancelada.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setCancelConfirm({ isOpen: false, booking: null });
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível cancelar a reserva',
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

      // Prepare guest data object with core fields only
      // Extended fields (document_type, gender, emergency_contact, etc.) need migration
      const guestData = {
        full_name: formData.guest_name,
        email: formData.email,
        phone: formData.phone,
        nationality: formData.nationality,
        passport_id: formData.passport
      };

      // Optional fields
      if (formData.guest_notes) guestData.notes = formData.guest_notes;
      if (formData.date_of_birth) guestData.date_of_birth = formData.date_of_birth;
      if (formData.document_type) guestData.document_type = formData.document_type;
      if (formData.gender) guestData.gender = formData.gender;
      if (formData.emergency_contact_name) guestData.emergency_contact_name = formData.emergency_contact_name;
      if (formData.emergency_contact_phone) guestData.emergency_contact_phone = formData.emergency_contact_phone;

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
        paid_amount: totalPaidValue,
        notes: formData.booking_notes || null
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
              const { error: updateTxError } = await supabase
                .from('transactions')
                .update({
                  amount: totalPaidValue,
                  payment_method: formData.payment_method,
                  date: format(new Date(), 'yyyy-MM-dd')
                })
                .eq('id', existingTransaction.id);

              if (updateTxError) {
                console.error('Transaction update error:', updateTxError);
                throw new Error(`Erro ao atualizar pagamento: ${updateTxError.message}`);
              }
            } else {
              // Create new transaction only if none exists
              const { error: insertTxError } = await supabase.from('transactions').insert([{
                booking_id: currentBookingId,
                type: 'Income',
                category: `Booking Payment - ${formData.guest_name}`,
                amount: totalPaidValue,
                payment_method: formData.payment_method,
                date: format(new Date(), 'yyyy-MM-dd')
              }]);

              if (insertTxError) {
                console.error('Transaction insert error:', insertTxError);
                throw new Error(`Erro ao registrar pagamento: ${insertTxError.message}`);
              }
            }
          } else if (existingTransaction) {
            // If payment is now 0, delete the transaction
            const { error: deleteTxError } = await supabase
              .from('transactions')
              .delete()
              .eq('id', existingTransaction.id);

            if (deleteTxError) {
              console.error('Transaction delete error:', deleteTxError);
            }
          }
        }
      }

      setIsModalOpen(false);
      fetchData();

      setAlertModal({
        isOpen: true,
        title: 'Sucesso',
        message: 'Reserva salva com sucesso',
        type: 'success'
      });
    } catch (error) {
      console.error('Save error:', error);
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao salvar reserva: ' + error.message,
        type: 'error'
      });
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
      {/* Toolbar */}
      <div className="p-2 sm:p-4 border-b border-gray-300 flex justify-between items-center bg-white z-20 relative shadow-sm gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 sm:p-2 bg-emerald-100 text-emerald-600 rounded-lg flex-shrink-0">
              <CalendarIcon size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight truncate">Reservas</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">{format(startDate, 'MMM yyyy')}</p>
            </div>
          </div>
          <div className="h-6 sm:h-8 w-px bg-gray-300 mx-1 sm:mx-2 hidden sm:block"></div>
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 sm:p-1 border border-gray-200">
            <button onClick={() => setStartDate(addDays(startDate, -7))} className="p-1 sm:p-1.5 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
              <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button onClick={() => setStartDate(addDays(today, -2))} className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold text-gray-700 hover:text-emerald-600 transition-colors">
              Hoje
            </button>
            <button onClick={() => setStartDate(addDays(startDate, 7))} className="p-1 sm:p-1.5 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
              <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </div>
        <button
          onClick={handleNewBooking}
          className="p-2 sm:px-4 sm:py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shadow-sm flex items-center gap-1 sm:gap-2 transition-all flex-shrink-0"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nova Reserva</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto relative custom-scrollbar">
          {/* Header Row */}
          <div className="sticky top-0 z-30 bg-white flex border-b border-gray-300" style={{ height: headerHeight, minWidth: 'max-content' }}>
            <div
              className="sticky left-0 z-40 bg-white border-r border-gray-300 flex flex-col justify-end p-2 sm:p-4 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]"
              style={{ width: sidebarWidth }}
            >
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Quartos</span>
              <span className="font-bold text-gray-800 text-sm sm:text-lg mt-0.5 sm:mt-1">Todos</span>
            </div>
            <div className="flex">
              {dates.map(date => {
                const isToday = isSameDay(date, today);
                return (
                  <div
                    key={date.toString()}
                    className={`flex-shrink-0 border-r flex flex-col text-center group ${isToday ? 'bg-emerald-100 border-emerald-300' : 'bg-white border-gray-300'}`}
                    style={{ width: cellWidth }}
                  >
                    <div className={`flex-1 flex items-end justify-center pb-1 sm:pb-2 border-b ${isToday ? 'border-emerald-200' : 'border-gray-200'}`}>
                      <span className={`text-[10px] sm:text-xs font-medium uppercase ${isToday ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                        {format(date, isMobile ? 'EEEEE' : 'EEE')}
                      </span>
                    </div>
                    <div className={`h-7 sm:h-10 flex items-center justify-center font-bold text-sm sm:text-lg ${isToday ? 'text-white bg-emerald-500' : 'text-gray-800 group-hover:bg-gray-50'}`}>
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
              <div className="p-10 text-center text-gray-500">Carregando...</div>
            ) : rows.map(row => {
              // Define row heights based on type
              const rowHeight = row.type === 'header'
                ? 'h-8 sm:h-10'
                : row.type === 'room'
                  ? 'h-10 sm:h-12'
                  : 'h-9 sm:h-11'; // bed and room_booking - smaller

              const rowBg = row.type === 'header'
                ? 'bg-gray-100/80'
                : row.type === 'room'
                  ? 'bg-slate-50/50'
                  : 'bg-white';

              return (
              <div
                key={row.id}
                className={`flex border-b border-gray-200 hover:bg-gray-50/50 transition-colors ${rowHeight} ${rowBg}`}
              >
                {/* Sidebar Cell */}
                <RowSidebar row={row} sidebarWidth={sidebarWidth} />

                {/* Timeline Cells */}
                <div className="flex relative isolate" onDragEnd={handleDragEnd}>
                  {dates.map(date => {
                    const roomId = row.type === 'room' ? row.id : row.parentId;
                    const rate = roomId ? getDailyRate(roomId, date) : null;
                    const isRoomHeader = row.type === 'room';
                    const isToday = isSameDay(date, today);
                    const isSelected = isCellInSelection(row, date);
                    const isClickable = row.type === 'bed' || row.type === 'room_booking';

                    const handleClick = (e) => {
                      if (isRoomHeader) {
                        handlePriceEdit(row, date, rate);
                      } else if (isClickable) {
                        handleCellClick(e, row, date);
                      }
                    };

                    return (
                      <div
                        key={date.toString()}
                        onDragOver={(e) => handleDragOver(e, date)}
                        onDrop={handleDrop}
                      >
                        <DateCell
                          date={date}
                          isToday={isToday}
                          isRoomHeader={isRoomHeader}
                          isClickable={isClickable}
                          isSelected={isSelected}
                          cellWidth={cellWidth}
                          rate={rate}
                          defaultPrice={rooms.find(r => r.id === row.id)?.price_per_night}
                          onCellClick={handleClick}
                        />
                      </div>
                    );
                  })}

                  {/* Bookings */}
                  {row.type !== 'header' && getResourceBookings(row, row.type).map(booking => (
                    <BookingBar
                      key={booking.id}
                      booking={booking}
                      barStyle={getBarStyle(booking)}
                      onBookingClick={handleBookingClick}
                      onDragStart={handleDragStart}
                      isMobile={isMobile}
                    />
                  ))}

                  {/* Date Locks */}
                  {row.type !== 'header' && getResourceLocks(row, row.type).map(lock => (
                    <LockBar
                      key={lock.id}
                      lock={lock}
                      lockStyle={getLockBarStyle(lock)}
                      onLockClick={(lock) => setLockModal({
                        isOpen: true,
                        lock: lock,
                        roomId: lock.room_id,
                        bedId: lock.bed_id,
                        startDate: lock.start_date,
                        endDate: lock.end_date,
                        lockType: lock.lock_type,
                        description: lock.description || ''
                      })}
                    />
                  ))}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
          onClick={handleBackdropClick}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-xl w-full max-w-2xl shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {selectedBooking ? 'Editar Reserva' : 'Novo Hóspede & Reserva'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveBooking} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
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
                    <User size={18} className="text-emerald-600" /> Dados Pessoais
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome Completo *</label>
                    <input
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                      placeholder="João Silva"
                      value={formData.guest_name}
                      onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">País *</label>
                      <Select
                        options={countryOptions}
                        value={formData.nationality ? { value: formData.nationality, label: formData.nationality } : null}
                        onChange={(option) => setFormData({ ...formData, nationality: option?.value || '' })}
                        placeholder="Digite para buscar..."
                        noOptionsMessage={() => "Nenhum país encontrado"}
                        isClearable
                        styles={selectStyles}
                        classNamePrefix="react-select"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Gênero</label>
                      <select
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {GENDERS.map(g => (
                          <option key={g.code} value={g.code}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tipo de Doc.</label>
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
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nº Doc. *</label>
                      <input
                        required
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono placeholder:text-gray-300"
                        placeholder="123.456.789-00"
                        value={formData.passport}
                        onChange={(e) => setFormData({ ...formData, passport: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data de Nasc.</label>
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
                    <Mail size={18} className="text-emerald-600" /> Contato
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                      placeholder="joao@email.com.br"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telefone / WhatsApp *</label>
                    <input
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                      placeholder="+55 11 98765-4321"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wider pt-2 flex items-center gap-2">
                    <Phone size={14} className="text-orange-500" /> Contato de Emergência
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome</label>
                      <input
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                        placeholder="Maria Santos"
                        value={formData.emergency_contact_name}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telefone</label>
                      <input
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                        placeholder="+55 11 99999-9999"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Details Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <CalendarIcon size={18} className="text-emerald-600" /> Detalhes da Reserva
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Room/Bed Selection - conditional based on context */}
                  {bookingContext && bookingContext.roomType !== 'Dorm' ? (
                    // Non-dorm room (Private, Double, Family, Suite) - show read-only
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Quarto</label>
                      <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
                        {bookingContext.roomName}
                      </div>
                    </div>
                  ) : bookingContext && bookingContext.roomType === 'Dorm' ? (
                    // Dorm room - show only beds from this room
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cama em {bookingContext.roomName}</label>
                      <select
                        required
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                        value={formData.room_id}
                        onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                      >
                        <option value="">Selecione uma cama...</option>
                        {rooms.find(r => r.id === bookingContext.roomId)?.beds?.map(bed => (
                          <option key={bed.id} value={bed.id}>Cama {bed.bed_number}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    // No context (new booking from button or editing) - show all rooms/beds
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Quarto / Cama</label>
                      <select
                        required
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                        value={formData.room_id}
                        onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                      >
                        <option value="">Selecione quarto ou cama...</option>
                        {rooms.map(room => (
                          <optgroup key={room.id} label={room.name}>
                            {room.type === 'Dorm' ? (
                              room.beds?.map(bed => (
                                <option key={bed.id} value={bed.id}>{room.name} - Cama {bed.bed_number}</option>
                              ))
                            ) : (
                              <option value={room.id}>{room.name}</option>
                            )}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  )}
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
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Confirmed">Reservado</option>
                      <option value="Checked-in">Check-in</option>
                      <option value="Checked-out">Check-out</option>
                      <option value="Cancelled">Cancelado</option>
                    </select>
                  </div>
                </div>
                {/* Booking Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Observações da Reserva</label>
                  <textarea
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none placeholder:text-gray-300"
                    rows={2}
                    placeholder="Pedidos especiais, horário de chegada, etc."
                    value={formData.booking_notes}
                    onChange={(e) => setFormData({ ...formData, booking_notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Payment Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-end border-b pb-2">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                    Pagamento
                  </h3>
                  <div className="text-right flex items-end gap-2">
                    {selectedBooking && (
                      <button
                        type="button"
                        onClick={calculateTotal}
                        className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                        title="Recalcular com preços atuais"
                      >
                        Recalcular
                      </button>
                    )}
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Total</span>
                      <span className="text-xl font-black text-emerald-600">{formatCurrency(formData.total_amount)}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor Pago (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold placeholder:text-gray-300"
                      placeholder="0,00"
                      value={formData.displayInitialPayment}
                      onChange={handleInitialPaymentChange}
                    />
                    {/* Show remaining balance */}
                    {(() => {
                      const totalAmount = parseFloat(formData.total_amount) || 0;
                      const totalPaid = parseFloat(formData.initial_payment) || 0;
                      const remaining = totalAmount - totalPaid;

                      if (remaining > 0 && totalAmount > 0) {
                        return (
                          <div className="mt-2 text-sm">
                            <span className="text-red-500">Pendente: </span>
                            <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
                          </div>
                        );
                      } else if (totalPaid >= totalAmount && totalAmount > 0) {
                        return (
                          <div className="mt-2 text-sm text-emerald-600 font-semibold flex items-center gap-1">
                            <Check size={14} /> Pago
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Forma de Pagamento</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    >
                      <option value="Cash">Dinheiro</option>
                      <option value="Credit Card">Cartão de Crédito</option>
                      <option value="Debit Card">Cartão de Débito</option>
                      <option value="Bank Transfer">Transferência</option>
                      <option value="Pix">Pix</option>
                    </select>
                  </div>
                </div>
              </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex justify-between gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-xl">
                {/* Cancel Booking Button - only show when editing existing booking */}
                {selectedBooking && selectedBooking.status !== 'Cancelled' ? (
                  <button
                    type="button"
                    onClick={handleCancelBooking}
                    className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancelar Reserva
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 sm:px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={!!conflictWarning}
                    className={`px-4 sm:px-8 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${conflictWarning ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}
                  >
                    {selectedBooking ? 'Salvar' : 'Confirmar'}
                  </button>
                </div>
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
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
          onClick={() => setPriceModal({ ...priceModal, isOpen: false })}
        >
          <div
            className="bg-white rounded-xl max-w-sm w-full p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">Ajustar Preço</h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              Preço para <span className="font-semibold text-gray-800">{priceModal.room.name}</span> em <span className="font-semibold text-gray-800">{format(priceModal.date, 'dd/MM/yyyy')}</span>
            </p>

            <div className="mb-4 sm:mb-6">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Preço por Noite</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={priceModal.displayPrice}
                  onChange={handlePriceChange}
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-800"
                  placeholder="0,00"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPriceModal({ ...priceModal, isOpen: false })}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveDailyRate}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-md"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Popup (Booking or Lock) */}
      {actionPopup.isOpen && (
        <div
          className="fixed inset-0 z-[70]"
          onClick={() => setActionPopup({ ...actionPopup, isOpen: false })}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[160px]"
            style={{
              left: `${actionPopup.x}px`,
              top: `${actionPopup.y - 10}px`,
              transform: 'translate(-50%, -100%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] text-gray-400 uppercase font-bold px-2 py-1 border-b mb-1">
              {format(parseISO(actionPopup.checkIn), 'dd/MM')} - {format(parseISO(actionPopup.checkOut), 'dd/MM')}
            </div>
            <button
              onClick={handleActionBooking}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-md transition-colors"
            >
              <User size={16} />
              Nova Reserva
            </button>
            <button
              onClick={handleActionLock}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors"
            >
              <Lock size={16} />
              Bloquear Datas
            </button>
          </div>
        </div>
      )}

      {/* Lock Modal */}
      {lockModal.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
          onClick={() => setLockModal({ ...lockModal, isOpen: false })}
        >
          <div
            className="bg-white rounded-xl max-w-sm w-full p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Lock size={20} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {lockModal.lock ? 'Editar Bloqueio' : 'Bloquear Datas'}
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Date fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data Início</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                    value={lockModal.startDate}
                    onChange={(e) => setLockModal({ ...lockModal, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data Fim</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                    value={lockModal.endDate}
                    onChange={(e) => setLockModal({ ...lockModal, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Motivo</label>
                <select
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium"
                  value={lockModal.lockType}
                  onChange={(e) => setLockModal({ ...lockModal, lockType: e.target.value })}
                >
                  <option value="Voluntariado">Voluntariado</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {lockModal.lockType === 'Outro' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Descrição</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm placeholder:text-gray-300"
                    placeholder="Descreva o motivo..."
                    value={lockModal.description}
                    onChange={(e) => setLockModal({ ...lockModal, description: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              {lockModal.lock && (
                <button
                  onClick={() => handleDeleteLock(lockModal.lock.id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
                >
                  Excluir
                </button>
              )}
              <div className="flex-1"></div>
              <button
                onClick={() => setLockModal({ ...lockModal, isOpen: false })}
                className="px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLock}
                className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 shadow-md"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Confirmation Modal */}
      {cancelConfirm.isOpen && cancelConfirm.booking && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200"
          onClick={() => setCancelConfirm({ isOpen: false, booking: null })}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with warning icon */}
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle size={32} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Cancelar Reserva?</h3>
              <p className="text-gray-500 text-sm">
                Esta ação não pode ser desfeita.
              </p>
            </div>

            {/* Booking Info Card */}
            <div className="px-6 pb-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <User size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{cancelConfirm.booking.guests?.full_name || 'Hóspede'}</p>
                    <p className="text-xs text-gray-500">{cancelConfirm.booking.guests?.email || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon size={14} className="text-gray-400" />
                    <span>{format(parseISO(cancelConfirm.booking.check_in_date), 'dd/MM')} - {format(parseISO(cancelConfirm.booking.check_out_date), 'dd/MM')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-emerald-600">{formatCurrency(cancelConfirm.booking.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setCancelConfirm({ isOpen: false, booking: null })}
                className="flex-1 px-4 py-3 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={confirmCancelBooking}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
              >
                Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
