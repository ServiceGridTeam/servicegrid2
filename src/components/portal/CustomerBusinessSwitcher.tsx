import { useState, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StoredPortalBusiness } from '@/lib/portalLocalState';
import { useCustomerBusinesses } from '@/hooks/useCustomerBusinesses';
import { usePortalPrefetch } from '@/hooks/usePortalPrefetch';

interface CustomerBusinessSwitcherProps {
  businesses: StoredPortalBusiness[];
  activeBusinessId: string | null;
}

export function CustomerBusinessSwitcher({ 
  businesses, 
  activeBusinessId 
}: CustomerBusinessSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { switchBusiness, isSwitching } = useCustomerBusinesses();
  const { createHoverHandler } = usePortalPrefetch();

  const currentBusiness = businesses.find(b => b.businessId === activeBusinessId);

  const handleSwitch = useCallback(async (business: StoredPortalBusiness) => {
    if (business.businessId === activeBusinessId) return;
    
    setIsOpen(false);
    await switchBusiness(business.businessId, business.customerId);
  }, [activeBusinessId, switchBusiness]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          disabled={isSwitching}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBusiness?.businessId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <Avatar className="h-5 w-5">
                {currentBusiness?.logoUrl && (
                  <AvatarImage src={currentBusiness.logoUrl} />
                )}
                <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                  {currentBusiness?.businessName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-24 truncate">
                {currentBusiness?.businessName || 'Select'}
              </span>
            </motion.div>
          </AnimatePresence>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        {businesses.map((business) => {
          const isActive = business.businessId === activeBusinessId;
          const hoverHandler = createHoverHandler(business.businessId, business.customerId);
          
          return (
            <DropdownMenuItem
              key={business.businessId}
              onClick={() => handleSwitch(business)}
              onMouseEnter={hoverHandler.onMouseEnter}
              onMouseLeave={hoverHandler.onMouseLeave}
              className="flex items-center gap-3 cursor-pointer"
            >
              <Avatar className="h-6 w-6">
                {business.logoUrl && <AvatarImage src={business.logoUrl} />}
                <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                  {business.businessName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{business.businessName}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default CustomerBusinessSwitcher;
