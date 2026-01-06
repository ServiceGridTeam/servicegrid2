import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/portal/schedule', label: 'Schedule', icon: Calendar },
  { to: '/portal/documents', label: 'Documents', icon: FileText },
  { to: '/portal/account', label: 'Account', icon: User },
];

export function PortalNav() {
  const location = useLocation();

  const isActive = (to: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === to;
    }
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="border-b border-border bg-card/50">
      <div className="container mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                  active 
                    ? 'text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                
                {active && (
                  <motion.div
                    layoutId="portal-nav-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default PortalNav;
