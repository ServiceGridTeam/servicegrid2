import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useLocation, Link } from "react-router-dom";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { GeofenceAlertBanner } from "@/components/team/GeofenceAlertBanner";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/quotes": "Quotes",
  "/jobs": "Jobs",
  "/invoices": "Invoices",
  "/calendar": "Calendar",
  "/settings": "Settings",
  "/team": "Team",
  "/routes": "Routes",
  "/requests": "Requests",
  "/payments": "Payments",
  "/marketing": "Marketing",
};

export function AppHeader() {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);

  const getBreadcrumbs = () => {
    const crumbs: { label: string; path: string }[] = [];
    let currentPath = "";

    for (const part of pathParts) {
      currentPath += `/${part}`;
      const title = routeTitles[currentPath] || part.charAt(0).toUpperCase() + part.slice(1);
      crumbs.push({ label: title, path: currentPath });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />

      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.path}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <GeofenceAlertBanner />
        <GlobalSearch />
        <NotificationsDropdown />
      </div>
    </header>
  );
}
