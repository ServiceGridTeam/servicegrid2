import { useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronRight, LogOut, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import { usePendingRequestsCount } from "@/hooks/useJobRequests";
import { usePendingModificationsCount } from "@/hooks/useJobModificationRequests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_CONFIG } from "@/lib/permissions";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const { activeBusinessName, activeRole, navGroups, isLoading } = useBusinessContext();
  const { data: pendingRequestsCount } = usePendingRequestsCount();
  const { data: pendingModificationsCount } = usePendingModificationsCount();

  const totalPendingCount = (pendingRequestsCount || 0) + (pendingModificationsCount || 0);

  // Track previous role for animation key
  const prevRoleRef = useRef(activeRole);
  const navKey = useMemo(() => {
    if (activeRole !== prevRoleRef.current) {
      prevRoleRef.current = activeRole;
      return `nav-${activeRole}-${Date.now()}`;
    }
    return `nav-${activeRole}`;
  }, [activeRole]);

  const isActive = (path: string) => {
    // Handle dashboard/root path specially
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return "U";
  };

  const roleConfig = activeRole ? ROLE_CONFIG[activeRole] : null;

  // Animation variants for staggered nav items
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeBusinessName || "default"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="font-semibold text-sidebar-foreground truncate tracking-tight"
                >
                  {activeBusinessName || "ServiceGrid"}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {roleConfig && (
                  <motion.span
                    key={activeRole}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="text-xs text-muted-foreground truncate"
                  >
                    {roleConfig.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={navKey}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel className="text-muted-foreground text-xs tracking-wide uppercase">
                  {collapsed ? "" : group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item, index) => (
                      <motion.div key={item.title} variants={itemVariants}>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.url)}
                            tooltip={item.title}
                            className={isActive(item.url)
                              ? "bg-foreground/10 text-foreground border-l-2 border-foreground"
                              : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }
                          >
                            <NavLink
                              to={item.url === "/" ? "/dashboard" : item.url}
                              className="flex items-center gap-3"
                              activeClassName=""
                            >
                              <item.icon className={`h-4 w-4 shrink-0 ${isActive(item.url) ? "text-foreground" : ""}`} />
                              {!collapsed && <span>{item.title}</span>}
                              {!collapsed && item.url === "/requests" && totalPendingCount > 0 && (
                                <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs">
                                  {totalPendingCount > 99 ? "99+" : totalPendingCount}
                                </Badge>
                              )}
                              {!collapsed && isActive(item.url) && item.url !== "/requests" && (
                                <ChevronRight className="ml-auto h-4 w-4 text-foreground" />
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </motion.div>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </motion.div>
        </AnimatePresence>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border ring-offset-2 ring-offset-sidebar">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                <span className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.first_name && profile?.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : "User"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {profile?.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={signOut}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
