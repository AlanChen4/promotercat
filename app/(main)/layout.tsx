export default function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative isolate min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[url('/japan.jpg')] bg-cover bg-center bg-no-repeat"
      />
      {children}
    </main>
  );
}
