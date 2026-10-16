export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <article className="mx-auto max-w-2xl p-6 text-foreground sm:p-10">
      <div className="space-y-5 text-sm leading-7 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
