import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BedDouble, Wallet, TrendingUp, TrendingDown,
  AlertTriangle, Clock, Calendar, ArrowRight, DollarSign,
  LogIn, LogOut, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isToday, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expandedPayments, setExpandedPayments] = useState(false);
  const [stats, setStats] = useState({
    todayCheckIns: [],
    todayCheckOuts: [],
    totalBeds: 0,
    occupiedBeds: 0,
    occupancyRate: 0,
    pendingPayments: [],
    revenueToday: 0,
    revenueWeek: 0,
    revenueMonth: 0,
    totalPending: 0,
    nextSevenDays: [],
    recentBookings: []
  });

  const today = new Date();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = format(today, 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Fetch all data in parallel
      const [
        { data: bookings },
        { data: rooms },
        { data: beds }
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            *,
            guests (id, full_name, email, phone),
            rooms (id, name, type),
            beds (id, bed_number)
          `)
          .neq('status', 'Cancelled'),
        supabase.from('rooms').select('*').eq('is_active', true),
        supabase.from('beds').select('*').eq('is_active', true)
      ]);

      // Calculate total beds
      let totalBeds = 0;
      rooms?.forEach(room => {
        if (room.type === 'Dorm') {
          totalBeds += beds?.filter(b => b.room_id === room.id).length || 0;
        } else {
          totalBeds += 1; // Private rooms count as 1 unit
        }
      });

      // Today's check-ins and check-outs
      const todayCheckIns = bookings?.filter(b =>
        b.check_in_date === todayStr && b.status === 'Confirmed'
      ) || [];

      const todayCheckOuts = bookings?.filter(b =>
        b.check_out_date === todayStr && b.status === 'Checked-in'
      ) || [];

      // Current occupancy (only guests actually checked-in)
      const currentlyOccupied = bookings?.filter(b =>
        b.check_in_date <= todayStr &&
        b.check_out_date > todayStr &&
        b.status === 'Checked-in'
      ) || [];

      const occupiedBeds = currentlyOccupied.length;
      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      // Pending payments (only guests already checked-in)
      const pendingPayments = bookings?.filter(b => {
        const total = parseFloat(b.total_amount) || 0;
        const paid = parseFloat(b.paid_amount) || 0;
        return total > 0 && paid < total && b.status === 'Checked-in';
      }).map(b => ({
        ...b,
        pending: (parseFloat(b.total_amount) || 0) - (parseFloat(b.paid_amount) || 0)
      })).sort((a, b) => b.pending - a.pending) || [];

      // Revenue calculations
      const checkedOutBookings = bookings?.filter(b => b.status === 'Checked-out') || [];
      const activeBookings = bookings?.filter(b => b.status !== 'Checked-out') || [];

      // Fetch transactions for revenue calculation
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'Income');

      // Revenue today (from transactions table - payments received today)
      const revenueToday = transactions?.filter(t =>
        t.date === todayStr
      ).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

      // Revenue this week
      const revenueWeek = transactions?.filter(t =>
        t.date >= weekStart && t.date <= weekEnd
      ).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

      // Revenue this month
      const revenueMonth = transactions?.filter(t =>
        t.date >= monthStart && t.date <= monthEnd
      ).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0;

      // Total pending
      const totalPending = pendingPayments.reduce((sum, b) => sum + b.pending, 0);

      // Next 7 days occupancy forecast
      const nextSevenDays = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOccupied = bookings?.filter(b =>
          b.check_in_date <= dateStr &&
          b.check_out_date > dateStr &&
          b.status !== 'Cancelled'
        ).length || 0;

        nextSevenDays.push({
          date: dateStr,
          dayName: format(date, 'EEE', { locale: ptBR }),
          dayNum: format(date, 'dd'),
          occupied: dayOccupied,
          total: totalBeds,
          rate: totalBeds > 0 ? Math.round((dayOccupied / totalBeds) * 100) : 0,
          isToday: i === 0
        });
      }

      // Recent bookings (last 5)
      const recentBookings = bookings
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5) || [];

      setStats({
        todayCheckIns,
        todayCheckOuts,
        totalBeds,
        occupiedBeds,
        occupancyRate,
        pendingPayments: pendingPayments.slice(0, 5),
        revenueToday,
        revenueWeek,
        revenueMonth,
        totalPending,
        nextSevenDays,
        recentBookings
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">{format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Calendar size={18} />
          Ver Calendário
        </button>
      </div>

      {/* Alerts Section - Compact Cards */}
      {stats.pendingPayments.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-red-700">Pagamentos Pendentes</span>
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{stats.pendingPayments.length}</span>
            </div>
            <span className="text-sm font-bold text-red-600">{formatCurrency(stats.totalPending)}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.pendingPayments.slice(0, expandedPayments ? undefined : 2).map(b => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.guests?.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {b.rooms?.name}{b.beds?.bed_number ? ` • Cama ${b.beds.bed_number}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-600 ml-2">{formatCurrency(b.pending)}</span>
              </div>
            ))}
          </div>
          {stats.pendingPayments.length > 2 && (
            <button
              onClick={() => setExpandedPayments(!expandedPayments)}
              className="w-full py-1.5 text-xs text-red-600 hover:bg-red-50 font-medium flex items-center justify-center gap-1 border-t border-gray-100"
            >
              {expandedPayments ? 'Ver menos' : `+${stats.pendingPayments.length - 2} mais`}
              <ArrowRight size={12} className={`transition-transform ${expandedPayments ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Check-ins Hoje */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <LogIn size={20} className="text-blue-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">Hoje</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.todayCheckIns.length}</p>
          <p className="text-sm text-gray-500 mt-1">Check-ins</p>
        </div>

        {/* Check-outs Hoje */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <LogOut size={20} className="text-orange-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">Hoje</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.todayCheckOuts.length}</p>
          <p className="text-sm text-gray-500 mt-1">Check-outs</p>
        </div>

        {/* Ocupação Atual */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <BedDouble size={20} className="text-emerald-600" />
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              stats.occupancyRate >= 80 ? 'bg-emerald-100 text-emerald-700' :
              stats.occupancyRate >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {stats.occupancyRate}%
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.occupiedBeds}/{stats.totalBeds}</p>
          <p className="text-sm text-gray-500 mt-1">Camas ocupadas</p>
        </div>

        {/* Pendente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle size={20} className="text-red-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase">A receber</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(stats.totalPending)}</p>
          <p className="text-sm text-gray-500 mt-1">Pagamentos pendentes</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="opacity-80" />
            <span className="text-sm font-medium opacity-80">Receita Hoje</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.revenueToday)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={18} className="opacity-80" />
            <span className="text-sm font-medium opacity-80">Receita Semana</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.revenueWeek)}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="opacity-80" />
            <span className="text-sm font-medium opacity-80">Receita Mês</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.revenueMonth)}</p>
        </div>
      </div>

      {/* Occupancy Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Ocupação - Próximos 7 Dias</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.nextSevenDays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="dayName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value, name) => [`${value}%`, 'Ocupação']}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {stats.nextSevenDays.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isToday ? '#10B981' : entry.rate >= 80 ? '#10B981' : entry.rate >= 50 ? '#F59E0B' : '#EF4444'}
                      opacity={entry.isToday ? 1 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500"></div>
              <span className="text-gray-600">Alta (80%+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500"></div>
              <span className="text-gray-600">Média (50-79%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-600">Baixa (-50%)</span>
            </div>
          </div>
        </div>

        {/* Today's Activity - Compact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Atividade de Hoje</h3>
          </div>

          {stats.todayCheckIns.length === 0 && stats.todayCheckOuts.length === 0 ? (
            <div className="p-4">
              <div className="text-center py-4 text-gray-400">
                <CheckCircle size={24} className="mx-auto mb-1 text-emerald-400" />
                <p className="text-xs font-medium text-emerald-600">Tudo em dia!</p>
              </div>
              {/* Próximas chegadas */}
              {stats.recentBookings.filter(b => b.status === 'Confirmed').length > 0 && (
                <div className="border-t border-gray-100 pt-3 mt-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Próximas Chegadas</p>
                  <div className="space-y-2">
                    {stats.recentBookings.filter(b => b.status === 'Confirmed').slice(0, 2).map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 truncate">{b.guests?.full_name}</span>
                        <span className="text-gray-500">{format(parseISO(b.check_in_date), 'dd/MM')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.todayCheckIns.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                      <LogIn size={12} className="text-blue-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">Chegadas</span>
                    <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded font-bold">{stats.todayCheckIns.length}</span>
                  </div>
                  <div className="space-y-1.5 ml-7">
                    {stats.todayCheckIns.slice(0, 3).map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-800 font-medium truncate">{b.guests?.full_name}</span>
                        <span className="text-gray-500 truncate ml-2">{b.rooms?.name}</span>
                      </div>
                    ))}
                    {stats.todayCheckIns.length > 3 && (
                      <p className="text-xs text-blue-600">+{stats.todayCheckIns.length - 3} mais</p>
                    )}
                  </div>
                </div>
              )}

              {stats.todayCheckOuts.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-orange-100 rounded flex items-center justify-center">
                      <LogOut size={12} className="text-orange-600" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">Saídas</span>
                    <span className="text-xs bg-orange-100 text-orange-600 px-1.5 rounded font-bold">{stats.todayCheckOuts.length}</span>
                  </div>
                  <div className="space-y-1.5 ml-7">
                    {stats.todayCheckOuts.slice(0, 3).map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-800 font-medium truncate">{b.guests?.full_name}</span>
                        <span className="text-gray-500 truncate ml-2">{b.rooms?.name}</span>
                      </div>
                    ))}
                    {stats.todayCheckOuts.length > 3 && (
                      <p className="text-xs text-orange-600">+{stats.todayCheckOuts.length - 3} mais</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bookings */}
      {stats.recentBookings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Reservas Recentes</h3>
            <button
              onClick={() => navigate('/bookings')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              Ver todas <ArrowRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
                  <th className="text-left py-3 px-2">Hóspede</th>
                  <th className="text-left py-3 px-2 hidden sm:table-cell">Quarto</th>
                  <th className="text-left py-3 px-2">Check-in</th>
                  <th className="text-left py-3 px-2 hidden md:table-cell">Check-out</th>
                  <th className="text-right py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentBookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="py-3 px-2">
                      <p className="font-medium text-gray-900 text-sm">{b.guests?.full_name}</p>
                    </td>
                    <td className="py-3 px-2 hidden sm:table-cell">
                      <p className="text-sm text-gray-600">{b.rooms?.name}</p>
                    </td>
                    <td className="py-3 px-2">
                      <p className="text-sm text-gray-600">{format(parseISO(b.check_in_date), 'dd/MM')}</p>
                    </td>
                    <td className="py-3 px-2 hidden md:table-cell">
                      <p className="text-sm text-gray-600">{format(parseISO(b.check_out_date), 'dd/MM')}</p>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        b.status === 'Confirmed' ? 'bg-blue-100 text-blue-700' :
                        b.status === 'Checked-in' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {b.status === 'Confirmed' && <Clock size={10} />}
                        {b.status === 'Checked-in' && <CheckCircle size={10} />}
                        {b.status === 'Checked-out' && <XCircle size={10} />}
                        {b.status === 'Confirmed' ? 'Reservado' :
                         b.status === 'Checked-in' ? 'Hospedado' :
                         b.status === 'Checked-out' ? 'Finalizado' : b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
