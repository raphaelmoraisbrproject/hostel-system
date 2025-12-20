import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Mail, Phone, MapPin, User, FileText, Calendar, X, AlertCircle, Edit2, Eye, BedDouble, DollarSign, Clock, CheckCircle, LogOut, XCircle, Save } from 'lucide-react';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COUNTRIES, DOCUMENT_TYPES, GENDERS } from '../constants/countries';
import { formatCurrencyInput, parseCurrencyToNumber, formatCurrency, numberToInputFormat } from '../utils/currency';

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

const initialFormData = {
    name: '',
    email: '',
    phone: '',
    nationality: '',
    document_type: 'CPF',
    passport: '',
    gender: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    room_id: '',
    check_in: format(new Date(), 'yyyy-MM-dd'),
    check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    amount: '',
    displayAmount: '',
    payment_method: 'Pix'
};

const Guests = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [guests, setGuests] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState(initialFormData);
    const [conflictWarning, setConflictWarning] = useState(null);
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [guestBookings, setGuestBookings] = useState([]);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const modalRef = useRef(null);
    const detailModalRef = useRef(null);

    // Handle click outside modal
    const handleBackdropClick = useCallback((e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            setIsModalOpen(false);
        }
    }, []);

    const handleDetailBackdropClick = useCallback((e) => {
        if (detailModalRef.current && !detailModalRef.current.contains(e.target)) {
            setSelectedGuest(null);
        }
    }, []);

    // Currency input handler for guest payment
    const handleAmountChange = (e) => {
        const formatted = formatCurrencyInput(e.target.value);
        const numericValue = parseCurrencyToNumber(formatted);
        setFormData(prev => ({
            ...prev,
            displayAmount: formatted,
            amount: numericValue
        }));
    };

    useEffect(() => {
        fetchGuests();
        fetchRooms();
    }, []);

    useEffect(() => {
        if (isModalOpen) {
            checkConflicts();
        }
    }, [formData.check_in, formData.check_out, formData.room_id, isModalOpen]);

    const checkConflicts = async () => {
        const { check_in, check_out, room_id } = formData;
        if (!check_in || !check_out || !room_id) return;

        let targetRoomId = room_id;
        let targetBedId = null;
        const isBed = rooms.some(r => r.beds?.some(b => b.id === room_id));

        if (isBed) {
            targetBedId = room_id;
            targetRoomId = rooms.find(r => r.beds?.some(b => b.id === room_id)).id;
        }

        const { data } = await supabase
            .from('bookings')
            .select('id, guests(full_name)')
            .neq('status', 'Cancelled')
            .lt('check_in_date', check_out)
            .gt('check_out_date', check_in)
            .match(targetBedId ? { bed_id: targetBedId } : { room_id: targetRoomId });

        if (data && data.length > 0) {
            setConflictWarning(`Conflito: já reservado por ${data[0].guests?.full_name}`);
        } else {
            setConflictWarning(null);
        }
    };

    const fetchGuests = async () => {
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setGuests(data || []);
        } catch (error) {
            console.error('Error fetching guests:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRooms = async () => {
        const { data } = await supabase.from('rooms').select('*, beds(*)').eq('is_active', true);
        setRooms(data || []);
    };

    const openGuestDetail = async (guest) => {
        setSelectedGuest(guest);
        setIsEditing(false);
        setEditFormData(null);
        setLoadingBookings(true);

        try {
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select(`
                    *,
                    rooms (id, name, type),
                    beds (id, bed_number)
                `)
                .eq('guest_id', guest.id)
                .order('check_in_date', { ascending: false });

            if (error) throw error;
            setGuestBookings(bookings || []);
        } catch (error) {
            console.error('Error fetching bookings:', error.message);
            setGuestBookings([]);
        } finally {
            setLoadingBookings(false);
        }
    };

    const startEditing = () => {
        setEditFormData({
            full_name: selectedGuest.full_name || '',
            email: selectedGuest.email || '',
            phone: selectedGuest.phone || '',
            nationality: selectedGuest.nationality || '',
            document_type: selectedGuest.document_type || 'CPF',
            passport_id: selectedGuest.passport_id || '',
            gender: selectedGuest.gender || '',
            date_of_birth: selectedGuest.date_of_birth || '',
            emergency_contact_name: selectedGuest.emergency_contact_name || '',
            emergency_contact_phone: selectedGuest.emergency_contact_phone || '',
            notes: selectedGuest.notes || ''
        });
        setIsEditing(true);
    };

    const saveGuestEdit = async () => {
        if (!editFormData || !selectedGuest) return;

        setSavingEdit(true);
        try {
            const { data, error } = await supabase
                .from('guests')
                .update({
                    full_name: editFormData.full_name,
                    email: editFormData.email,
                    phone: editFormData.phone,
                    nationality: editFormData.nationality,
                    document_type: editFormData.document_type,
                    passport_id: editFormData.passport_id,
                    gender: editFormData.gender,
                    date_of_birth: editFormData.date_of_birth || null,
                    emergency_contact_name: editFormData.emergency_contact_name || null,
                    emergency_contact_phone: editFormData.emergency_contact_phone || null,
                    notes: editFormData.notes || null
                })
                .eq('id', selectedGuest.id)
                .select()
                .single();

            if (error) throw error;

            // Update local state
            setSelectedGuest(data);
            setGuests(prev => prev.map(g => g.id === data.id ? data : g));
            setIsEditing(false);
            setEditFormData(null);
        } catch (error) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const closeGuestDetail = () => {
        setSelectedGuest(null);
        setGuestBookings([]);
        setIsEditing(false);
        setEditFormData(null);
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Confirmed': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Confirmado' },
            'Checked-in': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle, label: 'Hospedado' },
            'Checked-out': { bg: 'bg-gray-100', text: 'text-gray-600', icon: LogOut, label: 'Finalizado' },
            'Cancelled': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Cancelado' }
        };
        const style = styles[status] || styles['Confirmed'];
        const Icon = style.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                <Icon size={12} />
                {style.label}
            </span>
        );
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const addGuest = async () => {
        try {
            // 1. Insert Guest
            const { data: guest, error: guestError } = await supabase
                .from('guests')
                .insert([{
                    full_name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    nationality: formData.nationality,
                    passport_id: formData.passport,
                    document_type: formData.document_type,
                    gender: formData.gender,
                    date_of_birth: formData.date_of_birth || null,
                    emergency_contact_name: formData.emergency_contact_name || null,
                    emergency_contact_phone: formData.emergency_contact_phone || null
                }])
                .select()
                .single();

            if (guestError) throw guestError;

            // 2. Insert Booking (if room selected)
            let bookingId = null;
            if (formData.room_id) {
                const isBed = rooms.some(r => r.beds?.some(b => b.id === formData.room_id));
                let bookingData = {
                    guest_id: guest.id,
                    check_in_date: formData.check_in,
                    check_out_date: formData.check_out,
                    status: 'Confirmed',
                    total_amount: 0
                };

                if (isBed) {
                    bookingData.bed_id = formData.room_id;
                    bookingData.room_id = rooms.find(r => r.beds?.some(b => b.id === formData.room_id)).id;
                } else {
                    bookingData.room_id = formData.room_id;
                }

                const { data: booking, error: bookingError } = await supabase
                    .from('bookings')
                    .insert([bookingData])
                    .select()
                    .single();

                if (bookingError) throw bookingError;
                bookingId = booking.id;
            }

            // 3. Insert Transaction (if amount > 0)
            const amount = parseFloat(formData.amount);
            if (amount > 0) {
                await supabase
                    .from('transactions')
                    .insert([{
                        booking_id: bookingId,
                        type: 'Income',
                        category: 'Hospedagem - ' + guest.full_name,
                        amount: amount,
                        payment_method: formData.payment_method,
                        date: new Date().toISOString().split('T')[0]
                    }]);

                if (bookingId) {
                    await supabase.rpc('increment_paid_amount', {
                        booking_id: bookingId,
                        amount: amount
                    });
                }
            }

            fetchGuests();
            setIsModalOpen(false);
            setFormData(initialFormData);
        } catch (error) {
            alert('Erro ao cadastrar hóspede: ' + error.message);
        }
    };

    const filteredGuests = guests.filter(guest => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (guest.full_name && guest.full_name.toLowerCase().includes(term)) ||
            (guest.email && guest.email.toLowerCase().includes(term)) ||
            (guest.passport_id && guest.passport_id.toLowerCase().includes(term)) ||
            (guest.phone && guest.phone.toLowerCase().includes(term)) ||
            (guest.nationality && guest.nationality.toLowerCase().includes(term))
        );
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
        } catch {
            return '-';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hóspedes</h1>
                    <p className="text-gray-500">Gerencie os perfis e histórico dos hóspedes</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Novo Hóspede
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="relative max-w-md">
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email, documento, telefone..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-300"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Guests List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                                <th className="px-6 py-4">Hóspede</th>
                                <th className="px-6 py-4 hidden sm:table-cell">Contato</th>
                                <th className="px-6 py-4 hidden md:table-cell">País</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="4" className="text-center py-8 text-gray-500">Carregando...</td></tr>
                            ) : filteredGuests.map((guest) => (
                                <tr key={guest.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                                                {guest.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{guest.full_name}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <FileText size={12} />
                                                    {guest.passport_id || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden sm:table-cell">
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Mail size={14} className="text-gray-400" />
                                                {guest.email || '-'}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-gray-400" />
                                                {guest.phone || '-'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell">
                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                            <MapPin size={16} className="text-gray-400" />
                                            {guest.nationality || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openGuestDetail(guest)}
                                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Ver detalhes"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredGuests.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        Nenhum hóspede encontrado.
                    </div>
                )}
            </div>

            {/* View Guest Detail Modal */}
            {selectedGuest && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
                    onClick={handleDetailBackdropClick}
                >
                    <div
                        ref={detailModalRef}
                        className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col"
                    >
                        {/* Fixed Header */}
                        <div className="flex justify-between items-start p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg sm:text-xl">
                                    {selectedGuest.full_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-gray-900">{selectedGuest.full_name}</h3>
                                    <p className="text-sm text-gray-500">{selectedGuest.nationality || 'País não informado'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing && (
                                    <button
                                        onClick={startEditing}
                                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={closeGuestDetail}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {isEditing ? (
                                /* Edit Form */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                                            <input
                                                type="text"
                                                value={editFormData.full_name}
                                                onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                            <input
                                                type="email"
                                                value={editFormData.email}
                                                onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                                            <input
                                                type="text"
                                                value={editFormData.phone}
                                                onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">País</label>
                                            <Select
                                                options={countryOptions}
                                                value={editFormData.nationality ? { value: editFormData.nationality, label: editFormData.nationality } : null}
                                                onChange={(option) => setEditFormData({...editFormData, nationality: option?.value || ''})}
                                                placeholder="Selecione..."
                                                isClearable
                                                styles={selectStyles}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Doc.</label>
                                            <select
                                                value={editFormData.document_type}
                                                onChange={(e) => setEditFormData({...editFormData, document_type: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            >
                                                {DOCUMENT_TYPES.map(doc => (
                                                    <option key={doc.code} value={doc.code}>{doc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nº Documento</label>
                                            <input
                                                type="text"
                                                value={editFormData.passport_id}
                                                onChange={(e) => setEditFormData({...editFormData, passport_id: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gênero</label>
                                            <select
                                                value={editFormData.gender}
                                                onChange={(e) => setEditFormData({...editFormData, gender: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            >
                                                <option value="">Selecione...</option>
                                                {GENDERS.map(g => (
                                                    <option key={g.code} value={g.code}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data de Nasc.</label>
                                            <input
                                                type="date"
                                                value={editFormData.date_of_birth}
                                                onChange={(e) => setEditFormData({...editFormData, date_of_birth: e.target.value})}
                                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="border-t pt-4">
                                        <h4 className="text-xs font-bold text-orange-600 uppercase mb-3">Contato de Emergência</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.emergency_contact_name}
                                                    onChange={(e) => setEditFormData({...editFormData, emergency_contact_name: e.target.value})}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                                                <input
                                                    type="text"
                                                    value={editFormData.emergency_contact_phone}
                                                    onChange={(e) => setEditFormData({...editFormData, emergency_contact_phone: e.target.value})}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <>
                                    {/* Contact */}
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Contato</h4>
                                        {selectedGuest.email && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1.5 mb-1">
                                                <Mail size={14} /> {selectedGuest.email}
                                            </p>
                                        )}
                                        {selectedGuest.phone && (
                                            <p className="text-sm text-gray-600 flex items-center gap-1.5">
                                                <Phone size={14} /> {selectedGuest.phone}
                                            </p>
                                        )}
                                    </div>

                                    {/* Documents */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Documento</h4>
                                            <p className="text-sm font-medium text-gray-900">
                                                {selectedGuest.document_type || 'N/A'}: {selectedGuest.passport_id || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Gênero</h4>
                                            <p className="text-sm font-medium text-gray-900">
                                                {GENDERS.find(g => g.code === selectedGuest.gender)?.name || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Date of Birth */}
                                    {selectedGuest.date_of_birth && (
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Data de Nascimento</h4>
                                            <p className="text-sm font-medium text-gray-900">{formatDate(selectedGuest.date_of_birth)}</p>
                                        </div>
                                    )}

                                    {/* Emergency Contact */}
                                    {(selectedGuest.emergency_contact_name || selectedGuest.emergency_contact_phone) && (
                                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                                            <h4 className="text-xs font-bold text-orange-600 uppercase mb-2">Contato de Emergência</h4>
                                            {selectedGuest.emergency_contact_name && (
                                                <p className="text-sm font-medium text-gray-900">{selectedGuest.emergency_contact_name}</p>
                                            )}
                                            {selectedGuest.emergency_contact_phone && (
                                                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                                                    <Phone size={14} /> {selectedGuest.emergency_contact_phone}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Bookings Section */}
                                    <div className="border-t pt-4">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                            <BedDouble size={14} /> Histórico de Reservas
                                        </h4>
                                        {loadingBookings ? (
                                            <div className="text-center py-4 text-gray-400">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto"></div>
                                            </div>
                                        ) : guestBookings.length === 0 ? (
                                            <div className="text-center py-4 text-gray-400 text-sm">
                                                Nenhuma reserva encontrada
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {guestBookings.map(booking => {
                                                    const total = parseFloat(booking.total_amount) || 0;
                                                    const paid = parseFloat(booking.paid_amount) || 0;
                                                    const pending = total - paid;
                                                    return (
                                                        <div key={booking.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <p className="font-medium text-gray-900 text-sm">
                                                                        {booking.rooms?.name}
                                                                        {booking.beds?.bed_number && ` - Cama ${booking.beds.bed_number}`}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}
                                                                    </p>
                                                                </div>
                                                                {getStatusBadge(booking.status)}
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs mt-2 pt-2 border-t border-gray-200">
                                                                <div className="flex items-center gap-1">
                                                                    <DollarSign size={12} className="text-gray-400" />
                                                                    <span className="text-gray-600">Total:</span>
                                                                    <span className="font-medium">{formatCurrency(total)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-gray-600">Pago:</span>
                                                                    <span className="font-medium text-emerald-600">{formatCurrency(paid)}</span>
                                                                </div>
                                                                {pending > 0 && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-gray-600">Pendente:</span>
                                                                        <span className="font-medium text-red-600">{formatCurrency(pending)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Created At */}
                                    <div className="text-xs text-gray-400 text-center pt-2">
                                        Cadastrado em {formatDate(selectedGuest.created_at)}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Fixed Footer */}
                        <div className="flex justify-end gap-2 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-xl">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={() => { setIsEditing(false); setEditFormData(null); }}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={saveGuestEdit}
                                        disabled={savingEdit}
                                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {savingEdit ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        Salvar
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={closeGuestDetail}
                                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                                >
                                    Fechar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* New Guest Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
                    onClick={handleBackdropClick}
                >
                    <div
                        ref={modalRef}
                        className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col"
                    >
                        {/* Fixed Header */}
                        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Cadastrar Novo Hóspede</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            addGuest();
                        }} className="flex flex-col flex-1 min-h-0">
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
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                                    <Calendar size={18} className="text-emerald-600" /> Reserva (Opcional)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Quarto / Cama</label>
                                        <select
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                                            value={formData.room_id}
                                            onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                                        >
                                            <option value="">Selecione (opcional)...</option>
                                            {rooms.map(room => (
                                                <optgroup key={room.id} label={room.name}>
                                                    {room.type !== 'Dorm' ? (
                                                        <option value={room.id}>{room.name} (Quarto Privativo)</option>
                                                    ) : (
                                                        room.beds?.map(bed => (
                                                            <option key={bed.id} value={bed.id}>{room.name} - Cama {bed.bed_number}</option>
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
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            value={formData.check_in}
                                            onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Check-out</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            value={formData.check_out}
                                            onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="font-bold text-gray-900 border-b pb-2 text-sm uppercase tracking-wider">Pagamento Inicial</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor Pago (R$)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                                            placeholder="0,00"
                                            value={formData.displayAmount}
                                            onChange={handleAmountChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Forma de Pagamento</label>
                                        <select
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            value={formData.payment_method}
                                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                        >
                                            <option value="Pix">Pix</option>
                                            <option value="Cash">Dinheiro</option>
                                            <option value="Credit Card">Cartão de Crédito</option>
                                            <option value="Debit Card">Cartão de Débito</option>
                                            <option value="Transfer">Transferência</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            </div>

                            {/* Fixed Footer */}
                            <div className="flex justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-xl">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!!conflictWarning}
                                    className={`px-8 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${conflictWarning ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}
                                >
                                    Cadastrar Hóspede
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Guests;
