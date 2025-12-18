import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Bed, Users, Trash2, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Rooms = () => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .order('name');

            if (error) throw error;
            setRooms(data);
        } catch (error) {
            console.error('Error fetching rooms:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const addRoom = async (roomData) => {
        try {
            // 1. Insert Room
            const { data: room, error: roomError } = await supabase
                .from('rooms')
                .insert([{
                    name: roomData.name,
                    type: roomData.type,
                    capacity: roomData.capacity,
                    price_per_night: roomData.price
                }])
                .select()
                .single();

            if (roomError) throw roomError;

            // 2. Insert Beds (if Dorm)
            if (roomData.type === 'Dorm') {
                const beds = Array.from({ length: roomData.capacity }).map((_, i) => ({
                    room_id: room.id,
                    bed_number: `${i + 1}`,
                    status: 'Active'
                }));

                const { error: bedsError } = await supabase
                    .from('beds')
                    .insert(beds);

                if (bedsError) throw bedsError;
            }

            fetchRooms();
            setIsModalOpen(false);
        } catch (error) {
            alert('Error adding room: ' + error.message);
        }
    };

    const deleteRoom = async (id) => {
        if (!confirm('Are you sure? This will delete all associated beds and bookings.')) return;

        try {
            const { error } = await supabase
                .from('rooms')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchRooms();
        } catch (error) {
            alert('Error deleting room: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('rooms')}</h1>
                    <p className="text-gray-500">Manage your property structure</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus size={20} />
                    Add Room
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading rooms...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rooms.map((room) => (
                        <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg ${room.type === 'Private' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {room.type === 'Private' ? <Bed size={24} /> : <Users size={24} />}
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="text-gray-400 hover:text-emerald-600 transition-colors"><Edit size={18} /></button>
                                        <button onClick={() => deleteRoom(room.id)} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-1">{room.name}</h3>
                                <p className="text-sm text-gray-500 mb-4">{room.type} Room</p>

                                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-4">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Users size={16} />
                                        <span>{room.capacity} Guests</span>
                                    </div>
                                    <div className="font-bold text-emerald-600">
                                        ${room.price_per_night}<span className="text-gray-400 font-normal">/night</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Add New Room</h2>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            addRoom({
                                name: formData.get('name'),
                                type: formData.get('type'),
                                capacity: parseInt(formData.get('capacity')),
                                price: parseFloat(formData.get('price'))
                            });
                        }} className="space-y-4">

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
                                <input name="name" required className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Ocean View Dorm" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select name="type" className="w-full px-3 py-2 border rounded-lg">
                                        <option value="Dorm">Dorm</option>
                                        <option value="Private">Private</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                    <input name="capacity" type="number" required min="1" className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night ($)</label>
                                <input name="price" type="number" required min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg" />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                                    Save Room
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Rooms;
