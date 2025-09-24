"use client";

import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import {
  LayoutDashboard,
  FileText,
  LogOut,
  UserCircle,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";

export function SidebarNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      href: "/dashboard",
      label: "แดชบอร์ด",
      icon: LayoutDashboard,
    },
    {
      href: "/dashboard/applications",
      label: "ใบสมัคร",
      icon: FileText,
    },
  ];

  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                  tooltip={item.label}
                  asChild
                >
                  <div>
                    <item.icon />
                    <span>{item.label}</span>
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <div className="flex items-center gap-2 p-2">
            {user && (
                <>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback><UserCircle /></AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-sm overflow-hidden">
                    <span className="font-semibold text-sidebar-foreground truncate">{user.name}</span>
                    <span className="text-xs text-sidebar-foreground/70 truncate">{user.email}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="ml-auto h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                  <LogOut className="h-4 w-4" />
                </Button>
                </>
            )}
        </div>
      </SidebarFooter>
    </>
  );
}
