export function Footer() {
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-end gap-4 px-4 py-6 sm:flex-row">
        <div className="text-center text-xs text-muted-foreground sm:text-right">
          <p className="font-medium">
            © PromoterCat {new Date().getFullYear()}
          </p>
          <p className="text-xs tracking-wide">We help you promote your apps</p>
        </div>
      </div>
    </footer>
  );
}
