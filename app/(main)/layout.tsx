export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative isolate min-h-screen bg-white px-4 pt-6 pb-20 sm:px-6 sm:pt-10">
      {children}
      <footer className="fixed right-4 bottom-4 z-0 flex gap-4 text-xs sm:right-6">
        <Link
          href="/privacy"
          className="rounded bg-background/90 px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="rounded bg-background/90 px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}

import Link from "next/link";
