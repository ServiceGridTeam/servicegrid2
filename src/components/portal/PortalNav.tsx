import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, FileText, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalBasePath } from '@/hooks/usePortalBasePath';

const navItemsConfig = [
  { path: '', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/schedule', label: 'Schedule', icon: Calendar },
  { path: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
  { path: '/documents', label: 'Documents', icon: FileText },
  { path: '/account', label: 'Account', icon: User },
];

export function PortalNav() {
  const location = useLocation();
  const { basePath, buildPath } = usePortalBasePath();

  const isActive = (path: string, exact?: boolean) => {
    const fullPath = path === '' ? basePath : `${basePath}${path}`;
    if (exact) {
      return location.pathname === fullPath || location.pathname === `${fullPath}/`;
    }
    return location.pathname.startsWith(fullPath) && fullPath !== basePath;
  };

  return (
    <nav className="border-b border-border bg-card/50">
      <div className="container mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto">
          {navItemsConfig.map((item) => {
            const active = isActive(item.path, item.exact);
            const Icon = item.icon;
            const to = buildPath(item.path || '/');
            
            return (
              <NavLink
                key={item.path}
                to={to}
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
