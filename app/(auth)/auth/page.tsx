import Image from "next/image";
import { AuthForm } from "@/components/ui/auth-form";
import logo from "@/public/logo.png";

export default function AuthPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <Image src={logo} alt="PromoterCat" width={42} height={42} />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthForm />
      </div>
    </div>
  );
}
