import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Mail, Phone, MapPin, User, FileText, Calendar, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, addDays, parseISO } from 'date-fns';

const Guests = () => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [guests, setGuests] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        nationality: '',
        passport: '',
        room_id: '',
        check_in: format(new Date(), 'yyyy-MM-dd'),
        check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        amount: '',
        payment_method: 'Cash'
    });
    const [conflictWarning, setConflictWarning] = useState(null);

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
            setConflictWarning(`Overlap detected: already booked by ${data[0].guests?.full_name}`);
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
            setGuests(data);
        } catch (error) {
            console.error('Error fetching guests:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRooms = async () => {
        const { data } = await supabase.from('rooms').select('*, beds(*)');
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
                    passport_id: formData.passport
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
                    total_amount: 0 // Ideally calculate this
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
                        category: 'Accommodation - ' + guest.full_name,
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
            setFormData({
                name: '', email: '', phone: '', nationality: '', passport: '',
                room_id: '', check_in: format(new Date(), 'yyyy-MM-dd'),
                check_out: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
                amount: '', payment_method: 'Cash'
            });
        } catch (error) {
            alert('Error adding guest: ' + error.message);
        }
    };

    const filteredGuests = guests.filter(guest =>
        guest.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (guest.email && guest.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (guest.passport_id && guest.passport_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('guests')}</h1>
                    <p className="text-gray-500">Manage guest profiles and history</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    New Guest
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="relative max-w-md">
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or passport..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                                <th className="px-6 py-4">Guest</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Nationality</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-8 text-gray-500">Loading guests...</td></tr>
                            ) : filteredGuests.map((guest) => (
                                <tr key={guest.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                                                {guest.full_name.charAt(0)}
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
                                    <td className="px-6 py-4">
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
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                            <MapPin size={16} className="text-gray-400" />
                                            {guest.nationality || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredGuests.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No guests found matching your search.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Register New Guest</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            addGuest();
                        }} className="space-y-6">

                            {/* Conflict Warning */}
                            {conflictWarning && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                                    <AlertCircle size={20} className="flex-shrink-0" />
                                    <span className="text-sm font-semibold">{conflictWarning}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <User size={18} className="text-emerald-600" /> Personal Info
                                    </h3>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nationality</label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            placeholder="American"
                                            value={formData.nationality}
                                            onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Passport / ID</label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                                            placeholder="A12345678"
                                            value={formData.passport}
                                            onChange={(e) => setFormData({ ...formData, passport: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <Mail size={18} className="text-emerald-600" /> Contact Info
                                    </h3>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
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
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone / WhatsApp</label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            placeholder="+1 234 567 890"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Booking Details Section */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <Calendar size={18} className="text-emerald-600" /> Booking Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Room / Bed Selection</label>
                                        <select
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                                            value={formData.room_id}
                                            onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                                        >
                                            <option value="">Select a room...</option>
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
                                <h3 className="font-bold text-gray-900 border-b pb-2 text-sm uppercase tracking-wider">Initial Payment</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Amount Paid ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                            placeholder="0.00"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Payment Method</label>
                                        <select
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
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
                                    Register Guest & Booking
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
