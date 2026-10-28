import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Disclaimer from '../components/Disclaimer';
import { IconCrosshair, IconLayers, IconTimer, IconChart, IconSpark, IconGraduate } from '../components/icons';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: IconChart, end: true },
  { to: '/practice', label: 'Practice', icon: IconLayers },
  { to: '/tests', label: 'Tests', icon: IconTimer },
  { to: '/progress', label: 'Progress', icon: IconSpark },
  { to: '/navigation-ai', label: 'AI Case Mentor', icon: IconCrosshair },
  { to: '/profile', label: 'Profile', icon: IconGraduate },
];

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const visibleNavItems = isAdmin
    ? [...navItems.slice(0, 5), { to: '/admin/cases', label: 'Content & Blocks', icon: IconLayers }, navItems[5]]
    : navItems;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-navy-950 text-white">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-white/10">
          <IconCrosshair className="w-5 h-5 text-spotter-blue-light" />
          <span className="font-display font-semibold tracking-tight text-sm">SPOTTERS.COM</span>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-spotter-blue text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.fullName}</p>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isAdmin ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/60'
                }`}
              >
                {isAdmin ? 'Radiologist' : 'Student'}
              </span>
            </div>
            <p className="text-xs text-white/40 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-navy-950 text-white flex items-center justify-between px-4 border-b border-white/10">
        <span className="font-display font-semibold text-sm tracking-tight">SPOTTERS.COM</span>
        <button onClick={logout} className="text-xs text-white/60">Logout</button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="md:hidden h-14" />
        {children}
        <footer className="max-w-6xl mx-auto px-6 pb-24 md:pb-8">
          <Disclaimer className="border-t border-gray-200 pt-4" />
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-navy-950 border-t border-white/10 flex"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] ${isActive ? 'text-spotter-blue-light' : 'text-white/50'}`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            <span className="truncate max-w-full px-0.5">{item.label.replace('AI Case Mentor', 'AI Mentor')}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
