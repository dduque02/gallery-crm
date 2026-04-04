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
} from "lucide-react";
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
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Inventory", url: "/artworks", icon: Palette },
  { title: "Exhibitions", url: "/exhibitions", icon: Calendar },
  { title: "Activity", url: "/activities", icon: Activity },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: stats } = useQuery<{ overdueFollowups: number }>({ queryKey: ["/api/stats"] });
  const overdueCount = stats?.overdueFollowups || 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-logo">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Gallery CRM"
            className="shrink-0"
          >
            <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
            <rect x="7" y="7" width="6" height="8" rx="1" fill="currentColor" opacity="0.7" />
            <rect x="15" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
            <line x1="7" y1="20" x2="21" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
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
      <SidebarFooter className="p-3">
        <div className="text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          Gallery Management System
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
