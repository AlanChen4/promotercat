"use client";

import { redirect } from "next/navigation";
import {
  ContinueWithGoogleButton,
  ContinueWithSeedUserButton,
} from "@/components/buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/env";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

export function AuthForm({ className, ...props }: React.ComponentProps<"div">) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return redirect("/");
  }
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Login or Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex flex-col gap-4">
              {env.NODE_ENV === "development" ? (
                <ContinueWithSeedUserButton />
              ) : (
                <ContinueWithGoogleButton />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
