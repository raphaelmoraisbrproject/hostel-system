import { useState, useEffect } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, Calendar, User, Bed, X, Eye, Edit2, FileText, Mail, Phone, DollarSign, AlertCircle, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';
import { formatCurrencyInput, parseCurrencyToNumber, numberToInputFormat } from '../utils/currency';
import { useCurrency } from '../hooks/useCurrency';

const Bookings = () => {
  const { formatCurrency } = useCurrency();
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('name'); // name, document, email
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, paid, pending
  const [roomFilter, setRoomFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editModal, setEditModal] = useState({ isOpen: false, booking: null });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  // Edit form data
  const [editForm, setEditForm] = useState({
    status: '',
    total_amount: '',
    displayTotalAmount: '',
    paid_amount: '',
    displayPaidAmount: '',
    notes: ''
  });

  // Currency input handlers for Bookings
  const handleTotalAmountChange = (e) => {
    const formatted = formatCurrencyInput(e.target.value);
    const numericValue = parseCurrencyToNumber(formatted);
    setEditForm(prev => ({
      ...prev,
      displayTotalAmount: formatted,
      total_amount: numericValue
    }));
  };

  const handlePaidAmountChange = (e) => {
    const formatted = formatCurrencyInput(e.target.value);
    const numericValue = parseCurrencyToNumber(formatted);
    setEditForm(prev => ({
      ...prev,
      displayPaidAmount: formatted,
      paid_amount: numericValue
    }));
  };

  useEffect(() => {
    fetchBookings();
    fetchRooms();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (
            id,
            full_name,
            email,
            phone,
            nationality,
            passport_id
          ),
          rooms (
            id,
            name,
            type
          ),
          beds (
            id,
            bed_number
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('id, name').eq('is_active', true);
    setRooms(data || []);
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Confirmed': 'bg-blue-100 text-blue-700',
      'Checked-in': 'bg-emerald-100 text-emerald-700',
      'Checked-out': 'bg-gray-100 text-gray-700',
      'Cancelled': 'bg-red-100 text-red-700',
      'No-show': 'bg-orange-100 text-orange-700'
    };
    const labels = {
      'Confirmed': 'Reservado',
      'Checked-in': 'Check-in',
      'Checked-out': 'Check-out',
      'Cancelled': 'Cancelado',
      'No-show': 'Não Compareceu'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentBadge = (booking) => {
    const total = parseFloat(booking.total_amount) || 0;
    const paid = parseFloat(booking.paid_amount) || 0;

    if (total === 0) return null;

    if (paid >= total) {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Pago</span>;
    } else if (paid > 0) {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pago Parcial</span>;
    } else {
      return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Não Pago</span>;
    }
  };

  const filteredBookings = bookings.filter(booking => {
    // Search filter based on type
    let matchesSearch = true;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      switch (searchType) {
        case 'name':
          matchesSearch = booking.guests?.full_name?.toLowerCase().includes(term);
          break;
        case 'document':
          matchesSearch = booking.guests?.passport_id?.toLowerCase().includes(term);
          break;
        case 'email':
          matchesSearch = booking.guests?.email?.toLowerCase().includes(term);
          break;
        default:
          matchesSearch = true;
      }
    }

    // Status filter
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

    // Payment filter
    let matchesPayment = true;
    if (paymentFilter !== 'all') {
      const total = parseFloat(booking.total_amount) || 0;
      const paid = parseFloat(booking.paid_amount) || 0;
      if (paymentFilter === 'paid') {
        matchesPayment = paid >= total && total > 0;
      } else if (paymentFilter === 'pending') {
        matchesPayment = paid < total && total > 0;
      } else if (paymentFilter === 'partial') {
        matchesPayment = paid > 0 && paid < total && total > 0;
      }
    }

    // Room filter
    const matchesRoom = roomFilter === 'all' || booking.room_id === roomFilter;

    // Date filter
    let matchesDate = true;
    if (dateFilter.start) {
      matchesDate = matchesDate && booking.check_in_date >= dateFilter.start;
    }
    if (dateFilter.end) {
      matchesDate = matchesDate && booking.check_in_date <= dateFilter.end;
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesRoom && matchesDate;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchType('name');
    setStatusFilter('all');
    setPaymentFilter('all');
    setRoomFilter('all');
    setDateFilter({ start: '', end: '' });
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || paymentFilter !== 'all' || roomFilter !== 'all' || dateFilter.start || dateFilter.end;

  // Open edit modal
  const openEditModal = (booking) => {
    setEditForm({
      status: booking.status,
      total_amount: parseFloat(booking.total_amount) || 0,
      displayTotalAmount: numberToInputFormat(booking.total_amount),
      paid_amount: parseFloat(booking.paid_amount) || 0,
      displayPaidAmount: numberToInputFormat(booking.paid_amount),
      notes: booking.notes || ''
    });
    setEditModal({ isOpen: true, booking });
  };

  // Save booking changes
  const handleSaveBooking = async () => {
    const totalAmount = parseFloat(editForm.total_amount) || 0;
    const paidAmount = parseFloat(editForm.paid_amount) || 0;

    // Validate paid_amount <= total_amount
    if (paidAmount > totalAmount && totalAmount > 0) {
      setAlertModal({
        isOpen: true,
        title: 'Erro de Validação',
        message: 'O valor pago não pode ser maior que o valor total',
        type: 'error'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: editForm.status,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          notes: editForm.notes || null
        })
        .eq('id', editModal.booking.id);

      if (error) throw error;

      setEditModal({ isOpen: false, booking: null });
      fetchBookings();
      setAlertModal({
        isOpen: true,
        title: 'Sucesso',
        message: 'Reserva atualizada com sucesso',
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating booking:', error);
      setAlertModal({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível atualizar a reserva',
        type: 'error'
      });
    }
  };

  const searchPlaceholders = {
    name: 'Buscar por nome...',
    document: 'Buscar por documento...',
    email: 'Buscar por e-mail...'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reservas</h1>
              <p className="text-sm text-gray-500 mt-1">
                {filteredBookings.length} reserva{filteredBookings.length !== 1 ? 's' : ''} encontrada{filteredBookings.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={18} />
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              )}
            </button>
          </div>

          {/* Search Bar with Type Selector */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={searchPlaceholders[searchType]}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-gray-700"
            >
              <option value="name">Nome</option>
              <option value="document">Documento</option>
              <option value="email">E-mail</option>
            </select>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="all">Todos</option>
                  <option value="Confirmed">Reservado</option>
                  <option value="Checked-in">Check-in</option>
                  <option value="Checked-out">Check-out</option>
                  <option value="Cancelled">Cancelado</option>
                </select>
              </div>

              {/* Payment Filter */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pagamento</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="all">Todos</option>
                  <option value="paid">Pago</option>
                  <option value="partial">Parcial</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>

              {/* Room Filter */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quarto</label>
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="all">Todos</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Check-in de</label>
                <input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Check-in até</label>
                <input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium border border-red-200"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="p-4 sm:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {hasActiveFilters ? 'Nenhuma reserva encontrada com os filtros aplicados' : 'Nenhuma reserva encontrada'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Hóspede</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase hidden sm:table-cell">Quarto</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Período</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase hidden lg:table-cell">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map((booking) => {
                    const pendingAmount = (booking.total_amount || 0) - (booking.paid_amount || 0);
                    return (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User size={16} className="text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{booking.guests?.full_name || 'N/A'}</p>
                              <p className="text-xs text-gray-500 truncate">{booking.guests?.passport_id || booking.guests?.email || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Bed size={14} />
                            <span className="truncate">
                              {booking.rooms?.name || 'N/A'}
                              {booking.beds?.bed_number && ` #${booking.beds.bed_number}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <span className="text-gray-900">{formatDate(booking.check_in_date)}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="text-gray-600">{formatDate(booking.check_out_date)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{formatCurrency(booking.total_amount)}</p>
                            {pendingAmount > 0 && (
                              <p className="text-xs text-red-600">Pend: {formatCurrency(pendingAmount)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {getStatusBadge(booking.status)}
                            {getPaymentBadge(booking)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => openEditModal(booking)}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Editar reserva"
                            >
                              <Edit2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Booking Detail Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedBooking(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Detalhes da Reserva</h3>
                <p className="text-sm text-gray-500">#{selectedBooking.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedBooking.status)}
                {getPaymentBadge(selectedBooking)}
              </div>

              {/* Guest Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Hóspede</h4>
                <p className="font-medium text-gray-900">{selectedBooking.guests?.full_name || 'N/A'}</p>
                {selectedBooking.guests?.passport_id && (
                  <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                    <FileText size={14} /> {selectedBooking.guests.passport_id}
                  </p>
                )}
                {selectedBooking.guests?.email && (
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Mail size={14} /> {selectedBooking.guests.email}
                  </p>
                )}
                {selectedBooking.guests?.phone && (
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Phone size={14} /> {selectedBooking.guests.phone}
                  </p>
                )}
              </div>

              {/* Booking Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Check-in</h4>
                  <p className="font-medium text-gray-900">{formatDate(selectedBooking.check_in_date)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Check-out</h4>
                  <p className="font-medium text-gray-900">{formatDate(selectedBooking.check_out_date)}</p>
                </div>
              </div>

              {/* Room Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Acomodação</h4>
                <p className="font-medium text-gray-900">
                  {selectedBooking.rooms?.name || 'N/A'}
                  {selectedBooking.beds?.bed_number && ` - Cama ${selectedBooking.beds.bed_number}`}
                </p>
              </div>

              {/* Payment Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Pagamento</h4>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="font-bold text-gray-900">{formatCurrency(selectedBooking.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Pago</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(selectedBooking.paid_amount)}</span>
                </div>
                {(selectedBooking.total_amount - selectedBooking.paid_amount) > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm font-medium text-red-600">Pendente</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(selectedBooking.total_amount - selectedBooking.paid_amount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Observações</h4>
                  <p className="text-sm text-gray-700">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Edit Button */}
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  openEditModal(selectedBooking);
                }}
                className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 size={18} />
                Editar Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editModal.isOpen && editModal.booking && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setEditModal({ isOpen: false, booking: null })}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Editar Reserva</h3>
                  <p className="text-sm text-gray-500">{editModal.booking.guests?.full_name}</p>
                </div>
                <button
                  onClick={() => setEditModal({ isOpen: false, booking: null })}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium bg-gray-50"
                >
                  <option value="Confirmed">Reservado</option>
                  <option value="Checked-in">Check-in</option>
                  <option value="Checked-out">Check-out</option>
                  <option value="Cancelled">Cancelado</option>
                </select>
              </div>

              {/* Total Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Total (R$)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.displayTotalAmount}
                  onChange={handleTotalAmountChange}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50"
                />
              </div>

              {/* Paid Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Pago (R$)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.displayPaidAmount}
                  onChange={handlePaidAmountChange}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50"
                />
                {/* Balance indicator */}
                {(() => {
                  const total = parseFloat(editForm.total_amount) || 0;
                  const paid = parseFloat(editForm.paid_amount) || 0;
                  const diff = total - paid;
                  if (diff > 0) {
                    return <p className="text-xs text-red-600 mt-1">Pendente: {formatCurrency(diff)}</p>;
                  } else if (diff < 0) {
                    return <p className="text-xs text-amber-600 mt-1">Excedente: {formatCurrency(Math.abs(diff))}</p>;
                  } else if (total > 0) {
                    return <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check size={12} /> Pago integralmente</p>;
                  }
                  return null;
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Observações</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50 resize-none"
                  placeholder="Anotações sobre a reserva..."
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-b-xl flex gap-3">
              <button
                onClick={() => setEditModal({ isOpen: false, booking: null })}
                className="flex-1 px-4 py-2.5 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBooking}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Salvar
              </button>
            </div>
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
    </div>
  );
};

export default Bookings;
