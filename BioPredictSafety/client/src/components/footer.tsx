import { Activity, CheckCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative mt-16 px-3 pb-8 text-sm text-muted-foreground md:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-white/8 p-6 shadow-[0_24px_80px_-60px_rgba(14,78,245,0.45)] backdrop-blur-xl dark:bg-slate-900/60">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="neon-badge text-xs">Neural Safety Intelligence</p>
            <p className="text-base font-semibold text-foreground">
              Continuous AI monitoring for pharmaceutical risk
            </p>
            <p className="text-xs text-muted-foreground/80">
              Powered by multi-model ensembles, Gemini analysis pipelines, and FDA data fusion.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 text-xs text-muted-foreground/80 md:items-end md:text-right">
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground dark:bg-slate-900/40">
              <CheckCircle className="h-4 w-4 text-green-400" /> ML Models Active
            </span>
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-400" /> API Status: Online
              <span className="hidden text-muted-foreground/60 md:inline">•</span>
              <span className="font-medium text-foreground">Version 2.1.0</span>
            </span>
            <span>Last updated: Nov 2025</span>
          </div>
        </div>

        <div className="glow-divider mt-6" />

        <div className="mt-4 flex flex-col items-start gap-2 text-xs text-muted-foreground/70 md:flex-row md:items-center md:justify-between">
          <span>© 2025 BioPredict. Advancing molecular safety prediction with AI.</span>
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
            <span className="h-1 w-1 rounded-full bg-primary/50" /> Biomolecular Foresight Network
          </span>
        </div>
      </div>
    </footer>
  );
}
