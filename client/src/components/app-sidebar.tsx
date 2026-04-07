import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Palette,
  Users,
  TrendingUp,
  Calendar,
  Activity,
  CalendarCheck,
  Receipt,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Pipeline", url: "/pipeline", icon: TrendingUp },
  { title: "Follow-ups", url: "/followups", icon: CalendarCheck },
  { title: "Sales History", url: "/sales-history", icon: Receipt },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Inventory", url: "/artworks", icon: Palette },
  { title: "Exhibitions", url: "/exhibitions", icon: Calendar },
  { title: "Activity", url: "/activities", icon: Activity },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: stats } = useQuery<{ overdueFollowups: number }>({ queryKey: ["/api/stats"] });
  const overdueCount = stats?.overdueFollowups || 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-logo">
          <img
            src="/logo-da.png"
            alt="Duque Arango Galeria"
            className="h-7 w-auto shrink-0 dark:invert"
          />
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Gallery CRM
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.url === "/followups" && overdueCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-5 min-w-5 px-1.5 justify-center">
                            {overdueCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        {user && (
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              <p className="font-medium text-foreground">{user.name}</p>
              <p className="capitalize">{user.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
