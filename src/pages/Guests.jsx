import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Mail, Phone, MapPin, User, FileText, Calendar, X, AlertCircle, Edit2, Eye } from 'lucide-react';
import Select from 'react-select';
import { supabase } from '../lib/supabase';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COUNTRIES, DOCUMENT_TYPES, GENDERS } from '../constants/countries';

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
                                            onClick={() => setSelectedGuest(guest)}
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
                        className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col"
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
                            <button
                                onClick={() => setSelectedGuest(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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

                            {/* Created At */}
                            <div className="text-xs text-gray-400 text-center pt-2">
                                Cadastrado em {formatDate(selectedGuest.created_at)}
                            </div>
                        </div>

                        {/* Fixed Footer */}
                        <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-xl">
                            <button
                                onClick={() => setSelectedGuest(null)}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                            >
                                Fechar
                            </button>
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
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm placeholder:text-gray-300"
                                            placeholder="0.00"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
