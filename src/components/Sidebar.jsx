import { LayoutDashboard, Users, BedDouble, Wallet, Building2, LogOut, Calendar as CalendarIcon, ClipboardList, MapPin, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { icon: LayoutDashboard, label: 'dashboard', path: '/' },
        { icon: CalendarIcon, label: 'Calendar', path: '/calendar' },
        { icon: ClipboardList, label: 'Reservas', path: '/bookings' },
        { icon: BedDouble, label: 'rooms', path: '/rooms' },
        { icon: Users, label: 'guests', path: '/guests' },
        { icon: Wallet, label: 'finance', path: '/finance' },
        { icon: MapPin, label: 'Áreas', path: '/areas' },
        { icon: ClipboardCheck, label: 'Tarefas', path: '/tasks' },
        { icon: Building2, label: 'organization', path: '/organization' },
    ];

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    return (
        <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-emerald-400">Hostel<span className="text-white">Manager</span></h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive(item.path)
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{t(item.label)}</span>
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className="flex justify-center gap-2 mb-4">
                    <button onClick={() => changeLanguage('pt')} className={`px-2 py-1 rounded text-xs ${i18n.language === 'pt' ? 'bg-emerald-600' : 'bg-slate-700'}`}>PT</button>
                    <button onClick={() => changeLanguage('en')} className={`px-2 py-1 rounded text-xs ${i18n.language === 'en' ? 'bg-emerald-600' : 'bg-slate-700'}`}>EN</button>
                    <button onClick={() => changeLanguage('es')} className={`px-2 py-1 rounded text-xs ${i18n.language === 'es' ? 'bg-emerald-600' : 'bg-slate-700'}`}>ES</button>
                </div>
                <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors">
                    <LogOut size={20} />
                    <span className="font-medium">{t('logout')}</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
