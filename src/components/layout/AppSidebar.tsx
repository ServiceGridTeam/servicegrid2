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
  CreditCard,
  Settings,
  Zap,
  ChevronRight,
  LogOut,
  Route,
  Inbox,
  Mail,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useBusiness } from "@/hooks/useBusiness";
import { usePendingRequestsCount } from "@/hooks/useJobRequests";
import { usePendingModificationsCount } from "@/hooks/useJobModificationRequests";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const mainMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Quotes", url: "/quotes", icon: FileText },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Requests", url: "/requests", icon: Inbox },
  { title: "Invoices", url: "/invoices", icon: Receipt },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Routes", url: "/routes", icon: Route },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Team", url: "/team", icon: Users },
];

const marketingMenuItems = [
  { title: "Templates", url: "/marketing/templates", icon: Mail },
  { title: "Sequences", url: "/marketing/sequences", icon: GitBranch },
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
  const { data: pendingRequestsCount } = usePendingRequestsCount();
  const { data: pendingModificationsCount } = usePendingModificationsCount();

  const totalPendingCount = (pendingRequestsCount || 0) + (pendingModificationsCount || 0);

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
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-semibold text-sidebar-foreground truncate tracking-tight">
                {business?.name || "ServiceGrid"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                Field Service
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs tracking-wide uppercase">
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
                      ? "bg-foreground/10 text-foreground border-l-2 border-foreground" 
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }
                  >
                    <NavLink
                      to={item.url}
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs tracking-wide uppercase">
            {collapsed ? "" : "Marketing"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketingMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
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
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName=""
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive(item.url) ? "text-foreground" : ""}`} />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && isActive(item.url) && (
                        <ChevronRight className="ml-auto h-4 w-4 text-foreground" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs tracking-wide uppercase">
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
                      ? "bg-foreground/10 text-foreground border-l-2 border-foreground" 
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3"
                      activeClassName=""
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive(item.url) ? "text-foreground" : ""}`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
