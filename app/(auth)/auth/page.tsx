import Image from "next/image";
import { AuthForm } from "@/components/ui/auth-form";
import { searchReturnPath } from "@/lib/auth";
import logo from "@/public/logo.png";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const returnTo = searchReturnPath(typeof next === "string" ? next : null);
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <Image src={logo} alt="PromoterCat" width={42} height={42} />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthForm returnTo={returnTo} />
      </div>
    </div>
  );
}
