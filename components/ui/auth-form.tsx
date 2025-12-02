"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ContinueWithGoogleButton } from "@/components/buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
          <CardTitle className="text-xl">Login or sign up</CardTitle>
          <CardDescription>
            Free to get started. No credit card required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex flex-col gap-4">
              <ContinueWithGoogleButton />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our{" "}
        <Link href="#" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="#" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </Link>
        .
      </div>
    </div>
  );
}
