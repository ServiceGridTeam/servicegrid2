import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { CustomerBusinessSwitcher } from './CustomerBusinessSwitcher';
import { StoredPortalBusiness } from '@/lib/portalLocalState';

interface PortalHeaderProps {
  businessName: string;
  logoUrl: string | null | undefined;
  businesses: StoredPortalBusiness[];
  activeBusinessId: string | null;
}

export function PortalHeader({ 
  businessName, 
  logoUrl, 
  businesses,
  activeBusinessId 
}: PortalHeaderProps) {
  const { logout } = usePortalAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Business branding */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {logoUrl && <AvatarImage src={logoUrl} alt={businessName} />}
              <AvatarFallback className="bg-primary text-primary-foreground">
                {businessName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold text-foreground">{businessName}</h1>
              <p className="text-sm text-muted-foreground">Customer Portal</p>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Business switcher (only show if multiple businesses) */}
            {businesses.length > 1 && (
              <CustomerBusinessSwitcher 
                businesses={businesses}
                activeBusinessId={activeBusinessId}
              />
            )}

            {/* Logout */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default PortalHeader;
