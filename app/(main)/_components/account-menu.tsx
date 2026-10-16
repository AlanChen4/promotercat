"use client";

import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";

export function AccountMenu() {
  const { user, isAuthenticated } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthenticated || !user) return null;

  const metadata = user.user_metadata;
  const displayName =
    [metadata.full_name, metadata.name]
      .find(
        (value): value is string => typeof value === "string" && !!value.trim(),
      )
      ?.trim() ||
    user.email?.split("@")[0] ||
    "Account";
  const avatarUrl = [metadata.avatar_url, metadata.picture].find(
    (value): value is string => typeof value === "string" && !!value.trim(),
  );
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const signOut = async () => {
    setIsSigningOut(true);
    setErrorMessage(null);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      setErrorMessage("Could not sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open account menu"
        >
          <Avatar className="size-6">
            <AvatarImage src={avatarUrl} alt="" />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-60 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuLabel>
          <p className="truncate">{displayName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOutIcon className="size-4" />
          {isSigningOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
        {errorMessage ? (
          <p role="alert" className="px-2 py-1.5 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
