"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";

export default function AccountPage() {
  const { user, isAuthenticatedLoading } = useAuth();

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {isAuthenticatedLoading
              ? "Loading your account..."
              : "PromoterCat is free. Your account lets you view results beyond the first page."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAuthenticatedLoading ? (
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          ) : user ? (
            <p className="text-sm text-muted-foreground">{user.email}</p>
          ) : (
            <Button asChild variant="outline">
              <Link href="/auth">Log in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
