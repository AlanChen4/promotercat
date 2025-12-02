"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import logo from "@/public/logo.png";

type UserMenuProps = {
  avatarUrl: string | null;
  displayName: string;
  email: string;
};

export function UserMenu({ avatarUrl, displayName, email }: UserMenuProps) {
  const router = useRouter();

  function getInitials(name: string, emailAddress: string) {
    const source = name || emailAddress;
    const parts = source.trim().split(/\s+/).slice(0, 2);
    const initials = parts.map((p) => p[0]?.toUpperCase()).join("");
    return initials || "U";
  }

  const initials = getInitials(displayName, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar>
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={displayName || email} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium leading-none truncate">
            {displayName || email}
          </p>
          {displayName && (
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/")}>
          Home
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/account")}>
          Account
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await createClient().auth.signOut();
            posthog.reset();
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavigationBar() {
  const { user } = useAuth();

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const displayName = (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    ""
  ).trim();
  const email = user?.email ?? "";

  return (
    <nav className="flex items-center justify-between p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex items-center gap-4 text-muted-foreground"
        >
          <Image src={logo} alt="Where Can I Promote" width={42} height={42} />
          <span className="font-medium">wherecanipromote.com</span>
        </Link>
      </div>
      {user ? (
        <div className="flex items-center gap-3">
          <UserMenu
            avatarUrl={avatarUrl}
            displayName={displayName}
            email={email}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-muted-foreground">
            Pricing
          </Link>
          <Link href="/auth">
            <Button variant="outline">Login</Button>
          </Link>
          <Link href="/auth">
            <Button>Sign up</Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
