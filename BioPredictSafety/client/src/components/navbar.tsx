import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Atom, Home, FlaskConical, Shield, FileText, Menu, Pill, History, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/analyze", label: "Bioactivity Prediction", icon: FlaskConical },
    { path: "/safety", label: "Safety Assessment", icon: Shield },
    { path: "/export", label: "Export Results", icon: FileText },
    { path: "/medicine-search", label: "Medicine Search", icon: Pill },
    { path: "/history", label: "History", icon: History, showLabel: false },
  ];

  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
    localStorage.setItem('theme', next);
  };

  // Ensure initial class is applied
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="sticky top-3 z-50 mx-auto w-full px-3 transition-all md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="glass-panel relative flex h-16 items-center justify-between border border-white/10 bg-white/10 px-4 py-2 shadow-[0_18px_60px_-48px_rgba(14,78,245,0.45)] backdrop-blur-xl dark:bg-slate-900/60 md:px-6">
          <div className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-40" />

          <Link href="/">
            <a className="relative flex cursor-pointer items-center space-x-3">
              <span className="absolute -left-6 hidden h-16 w-16 rounded-full bg-gradient-to-br from-primary/35 via-purple-500/30 to-cyan-400/35 blur-2xl md:block" aria-hidden="true" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-blue-500 to-purple-500 shadow-lg shadow-primary/20">
                <Atom className="h-5 w-5 text-white" />
              </span>
              <span className="flex flex-col">
                <span className="bg-gradient-to-r from-primary via-purple-500 to-sky-500 bg-clip-text text-lg font-semibold uppercase tracking-[0.2em] text-transparent">
                  BioPredict
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground/80">
                  Safety Intelligence
                </span>
              </span>
            </a>
          </Link>

          <div className="hidden items-center space-x-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} href={item.path}>
                  <a
                    className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-r from-primary to-purple-500 text-white shadow-[0_8px_20px_-12px_rgba(59,130,246,0.65)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-white/5"
                    }`}
                    aria-label={item.showLabel === false ? item.label : undefined}
                  >
                    <Icon className={`h-4 w-4 transition-transform group-hover:-translate-y-0.5 ${active ? "scale-110" : ""}`} />
                    {item.showLabel === false ? (
                      <span className="sr-only">{item.label}</span>
                    ) : (
                      <span>{item.label}</span>
                    )}
                    {active && (
                      <span className="absolute -bottom-1 left-1/2 h-0.5 w-3/5 -translate-x-1/2 rounded-full bg-white/80" />
                    )}
                  </a>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/10 text-foreground shadow-inner shadow-white/5 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.25)] dark:bg-slate-900/40"
            >
              <span className="absolute inset-0 bg-[conic-gradient(from_140deg,rgba(59,130,246,0.3),transparent_70%)] opacity-60" aria-hidden="true" />
              <span className="relative flex items-center justify-center">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
            </Button>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  aria-label="Toggle navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[380px]">
                <div className="mt-10 space-y-4">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link key={item.path} href={item.path}>
                        <a
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center space-x-3 rounded-2xl border px-4 py-3 transition-all ${
                            active
                              ? "border-primary/30 bg-primary/10 text-foreground shadow-[0_16px_40px_-30px_rgba(59,130,246,0.65)]"
                              : "border-border/40 text-foreground hover:border-primary/40 hover:bg-primary/5"
                          }`}
                          aria-label={item.showLabel === false ? item.label : undefined}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          {item.showLabel === false ? (
                            <span className="sr-only">{item.label}</span>
                          ) : (
                            <span className="font-medium text-base">{item.label}</span>
                          )}
                        </a>
                      </Link>
                    );
                  })}
                  <Button
                    variant="outline"
                    onClick={toggleTheme}
                    className="w-full justify-start rounded-xl border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                  >
                    {theme === "light" ? (
                      <>
                        <Moon className="mr-2 h-4 w-4" /> Dark Mode
                      </>
                    ) : (
                      <>
                        <Sun className="mr-2 h-4 w-4" /> Light Mode
                      </>
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
