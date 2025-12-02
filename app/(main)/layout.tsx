import { NavigationBar } from "@/components/nav-bar";

export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <NavigationBar />
      {children}
    </div>
  );
}
