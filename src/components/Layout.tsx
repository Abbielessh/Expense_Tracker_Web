import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import logoIcon from '../utils/app_logo_expense.png';
import homeIcon from '../utils/ic_nav_home.png';
import addIcon from '../utils/ic_nav_add.png';
import reportsIcon from '../utils/ic_nav_reports.png';
import profilesIcon from '../utils/ic_nav_profiles.png';
import settingsIcon from '../utils/ic_nav_settings.png';

const navItems = [
  { to: '/home', title: 'Home', icon: homeIcon },
  { to: '/add', title: 'Add', icon: addIcon },
  { to: '/reports', title: 'Reports', icon: reportsIcon },
  { to: '/profiles', title: 'Profiles', icon: profilesIcon },
  { to: '/settings', title: 'Settings', icon: settingsIcon },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-bg md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/70 bg-white/80 p-4 backdrop-blur md:block">
        <div className="mb-7 rounded-[24px] bg-gradient-to-br from-blue-600 to-sky-400 p-4 text-white shadow-soft">
          <img src={logoIcon} alt="Expense Tracker" className="h-[58px] w-[58px] rounded-[14px] object-contain" />
          <h1 className="mt-2 text-xl font-extrabold">Expense Tracker</h1>
          <p className="text-sm text-white/80">Web dashboard</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => <DesktopLink key={item.to} {...item} />)}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(16,24,40,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {navItems.map((item) => <MobileLink key={item.to} {...item} />)}
        </div>
      </nav>
    </div>
  );
}

function DesktopLink({ to, title, icon }: { to: string; title: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-4 py-3 font-bold ${isActive ? 'bg-[#EAF2FF] text-[#2563EB]' : 'text-slate-600 hover:bg-slate-50'}`
      }
    >
      <img src={icon} alt={title} className="h-6 w-6 object-contain" />
      {title}
    </NavLink>
  );
}

function MobileLink({ to, title, icon }: { to: string; title: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-bold ${isActive ? 'text-[#2563EB]' : 'text-[#667085]'}`
      }
    >
      {({ isActive }) => (
        <>
          <img
            src={icon}
            alt={title}
            className={`h-7 w-7 object-contain transition-all ${isActive ? 'opacity-100 scale-110' : 'opacity-60'}`}
          />
          <span>{title}</span>
        </>
      )}
    </NavLink>
  );
}
