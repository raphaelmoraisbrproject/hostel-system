import { Users, BedDouble, Wallet, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ icon: Icon, label, value, trend, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <h3 className="text-2xl font-bold mt-2 text-gray-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </div>
        <div className="mt-4 flex items-center text-sm">
            <span className="text-emerald-600 font-medium flex items-center">
                <TrendingUp size={16} className="mr-1" />
                {trend}
            </span>
            <span className="text-gray-400 ml-2">vs last month</span>
        </div>
    </div>
);

const Dashboard = () => {
    const { t } = useTranslation();

    const data = [
        { name: 'Mon', guests: 12 },
        { name: 'Tue', guests: 19 },
        { name: 'Wed', guests: 15 },
        { name: 'Thu', guests: 22 },
        { name: 'Fri', guests: 28 },
        { name: 'Sat', guests: 32 },
        { name: 'Sun', guests: 25 },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h1>
                <p className="text-gray-500">Welcome back, here's what's happening today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={Users}
                    label="Total Guests"
                    value="24"
                    trend="+12%"
                    color="bg-blue-500"
                />
                <StatCard
                    icon={BedDouble}
                    label="Occupancy"
                    value="78%"
                    trend="+5%"
                    color="bg-emerald-500"
                />
                <StatCard
                    icon={Wallet}
                    label="Revenue"
                    value="$1,240"
                    trend="+18%"
                    color="bg-violet-500"
                />
                <StatCard
                    icon={Users}
                    label="Check-ins Today"
                    value="8"
                    trend="+2"
                    color="bg-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Weekly Occupancy</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Bar dataKey="guests" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h3>
                    <div className="space-y-4">
                        <button className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                            <Users size={20} />
                            New Check-in
                        </button>
                        <button className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                            <BedDouble size={20} />
                            View Room Map
                        </button>
                        <button className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                            <Wallet size={20} />
                            Add Expense
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
