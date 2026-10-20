import { PianoPage } from "@/features/piano/pages/PianoPage";

export default function App() {
  return (
    <div className="app-shell min-h-screen text-stone-100">
      <header className="app-header">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
          <a href="#" className="brand-lockup" aria-label="KeyFlow Piano home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>
              <span className="brand-name">KeyFlow</span>
              <span className="brand-subtitle">PIANO STUDIO</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-stone-500 sm:inline">
              YOUR PERSONAL PIANO
            </span>
            <span className="live-pill">
              <span className="live-dot" /> PIANO STUDIO
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-3 pb-12 pt-6 sm:px-6 sm:pt-9 lg:px-10">
        <PianoPage />
      </main>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 border-t border-white/5 px-4 py-5 text-xs text-stone-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <span>
          KEYFLOW PIANO <span className="text-stone-700">/</span> A little space
          to make music.
        </span>
        <span>
          Headphones recommended · Sound starts after your first interaction
        </span>
      </footer>
    </div>
  );
}
