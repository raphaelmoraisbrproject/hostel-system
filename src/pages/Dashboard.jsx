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

      // Pending payments (guests with balance due)
      const pendingPayments = bookings?.filter(b => {
        const total = parseFloat(b.total_amount) || 0;
        const paid = parseFloat(b.paid_amount) || 0;
        return total > 0 && paid < total && b.status !== 'Checked-out';
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

  const hasAlerts = stats.pendingPayments.length > 0 || stats.todayCheckOuts.length > 0;

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

      {/* Alerts Section - Modern Cards */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pagamentos Pendentes Card */}
          {stats.pendingPayments.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Wallet size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-red-100 text-sm font-medium">Pagamentos Pendentes</p>
                      <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalPending)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {stats.pendingPayments.length} {stats.pendingPayments.length === 1 ? 'hóspede' : 'hóspedes'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {stats.pendingPayments.slice(0, 3).map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-red-600 font-bold text-sm">
                          {b.guests?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium text-sm truncate">{b.guests?.full_name}</p>
                        <p className="text-gray-500 text-xs truncate">
                          {b.rooms?.name}{b.beds?.bed_number ? ` • Cama ${b.beds.bed_number}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-red-600 font-bold text-sm">{formatCurrency(b.pending)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {stats.pendingPayments.length > 3 && (
                  <button
                    onClick={() => navigate('/bookings')}
                    className="w-full mt-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    Ver todos ({stats.pendingPayments.length}) <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Check-outs Hoje Card */}
          {stats.todayCheckOuts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <LogOut size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-orange-100 text-sm font-medium">Check-outs Hoje</p>
                      <p className="text-white text-2xl font-bold">{stats.todayCheckOuts.length} {stats.todayCheckOuts.length === 1 ? 'hóspede' : 'hóspedes'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      Aguardando saída
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {stats.todayCheckOuts.slice(0, 3).map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 font-bold text-sm">
                          {b.guests?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium text-sm truncate">{b.guests?.full_name}</p>
                        <p className="text-gray-500 text-xs truncate">
                          {b.rooms?.name}{b.beds?.bed_number ? ` • Cama ${b.beds.bed_number}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/calendar')}
                        className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                      >
                        Check-out
                      </button>
                    </div>
                  ))}
                </div>
                {stats.todayCheckOuts.length > 3 && (
                  <button
                    onClick={() => navigate('/calendar')}
                    className="w-full mt-3 py-2 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    Ver todos ({stats.todayCheckOuts.length}) <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
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

        {/* Today's Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Atividade de Hoje</h3>

          {stats.todayCheckIns.length === 0 && stats.todayCheckOuts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma atividade programada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.todayCheckIns.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <LogIn size={14} className="text-blue-600" />
                    <span className="text-xs font-bold text-gray-500 uppercase">Chegadas</span>
                  </div>
                  <div className="space-y-2">
                    {stats.todayCheckIns.slice(0, 4).map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users size={14} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {b.guests?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">{b.rooms?.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.todayCheckOuts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <LogOut size={14} className="text-orange-600" />
                    <span className="text-xs font-bold text-gray-500 uppercase">Saídas</span>
                  </div>
                  <div className="space-y-2">
                    {stats.todayCheckOuts.slice(0, 4).map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <Users size={14} className="text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {b.guests?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">{b.rooms?.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
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
