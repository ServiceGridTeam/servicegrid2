/**
 * Business switcher dropdown for multi-business users
 * With micro-animations per FeatureSpec v4
 */

import { useState } from "react";
import { Check, ChevronDown, Building2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import { ROLE_CONFIG, type AppRole } from "@/lib/permissions";

export function BusinessSwitcher() {
  const [open, setOpen] = useState(false);
  const {
    activeBusinessId,
    activeBusinessName,
    activeRole,
    memberships,
    isLoading,
    isSwitching,
    switchBusiness,
    createHoverHandler,
  } = useBusinessContext();

  // Don't show if user only has one business
  if (!isLoading && memberships.length <= 1) {
    return null;
  }

  const roleConfig = activeRole ? ROLE_CONFIG[activeRole] : null;

  const handleSelect = async (businessId: string) => {
    if (businessId !== activeBusinessId) {
      await switchBusiness(businessId);
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 px-3 relative overflow-hidden"
          disabled={isLoading || isSwitching}
        >
          <AnimatePresence mode="wait">
            {isSwitching ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
              >
                <Building2 className="h-4 w-4" />
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            <motion.span
              key={activeBusinessName || "placeholder"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-[120px] truncate hidden sm:inline"
            >
              {activeBusinessName || "Select Business"}
            </motion.span>
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            {roleConfig && (
              <motion.div
                key={activeRole}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, delay: 0.05 }}
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 hidden md:flex"
                >
                  {roleConfig.label}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
          
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Business
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {memberships.map((membership, index) => {
          const isActive = membership.businessId === activeBusinessId;
          const roleInfo = ROLE_CONFIG[membership.role as AppRole];
          const hoverHandlers = createHoverHandler(membership.businessId);

          return (
            <motion.div
              key={membership.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: index * 0.03 }}
            >
              <DropdownMenuItem
                className={cn(
                  "flex items-center gap-3 cursor-pointer",
                  isActive && "bg-accent"
                )}
                onClick={() => handleSelect(membership.businessId)}
                {...hoverHandlers}
              >
                <Avatar className="h-8 w-8">
                  <AnimatePresence mode="wait">
                    {membership.businessLogo ? (
                      <motion.div
                        key={membership.businessLogo}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <AvatarImage src={membership.businessLogo} />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <AvatarFallback className="text-xs bg-muted">
                    {membership.businessName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {membership.businessName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {roleInfo?.label || membership.role}
                    {membership.isPrimary && " · Primary"}
                  </span>
                </div>
                
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </DropdownMenuItem>
            </motion.div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
