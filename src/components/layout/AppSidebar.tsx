import { useLocation } from "react-router-dom";
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
import {
  LayoutDashboard,
  Users,
  FileText,
  Briefcase,
  Receipt,
  Calendar,
  Settings,
  Zap,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useBusiness } from "@/hooks/useBusiness";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const mainMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Quotes", url: "/quotes", icon: FileText },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Invoices", url: "/invoices", icon: Receipt },
  { title: "Calendar", url: "/calendar", icon: Calendar },
];

const settingsMenuItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: business } = useBusiness();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0 shadow-glow-sm animate-pulse-glow">
            <Zap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-display font-semibold text-sidebar-foreground truncate tracking-wide">
                {business?.name || "ServiceGrid"}
              </span>
              <span className="text-xs text-primary/70 truncate">
                Field Service
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 font-display text-xs tracking-widest uppercase">
            {collapsed ? "" : "Main"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={isActive(item.url) 
                      ? "bg-primary/15 text-primary border-l-2 border-primary shadow-[inset_0_0_20px_-10px_hsl(var(--primary)/0.3)]" 
                      : "hover:bg-sidebar-accent/50 hover:text-accent"
                    }
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName=""
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive(item.url) ? "text-primary" : ""}`} />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 font-display text-xs tracking-widest uppercase">
            {collapsed ? "" : "System"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={isActive(item.url) 
                      ? "bg-primary/15 text-primary border-l-2 border-primary" 
                      : "hover:bg-sidebar-accent/50 hover:text-accent"
                    }
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName=""
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive(item.url) ? "text-primary" : ""}`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/30 ring-offset-2 ring-offset-sidebar">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-display">
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
                <span className="text-xs text-sidebar-foreground/50 truncate">
                  {profile?.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
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
