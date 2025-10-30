"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";
import { Logo } from "../logo";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "../ui/button";
import { LogOut, UserCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";


export function Header() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:px-8">
       <div className="flex items-center gap-4">
        <Logo />
        <Breadcrumb className="hidden md:flex">
            <BreadcrumbList>
            <BreadcrumbItem>
                <BreadcrumbLink asChild>
                <Link href="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
            </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {user && (
            <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback><UserCircle /></AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-sm overflow-hidden">
                    <span className="font-semibold text-foreground truncate">{user.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                </Button>
            </div>
        )}
      </div>

    </header>
  );
}
