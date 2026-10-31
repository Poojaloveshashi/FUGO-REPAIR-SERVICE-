import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running in standalone PWA mode, show subtle verified badge or nothing
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-black text-fugo text-[10px] font-black uppercase tracking-wider border-2 border-fugo">
        <CheckCircle2 className="w-3.5 h-3.5 text-fugo" />
        <span>PWA ACTIVE</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (compact) {
      return (
        <button
          onClick={install}
          title="Install FUGO Repair App on this terminal"
          className="flex items-center gap-1.5 bg-fugo text-black hover:bg-white hover:text-black px-2.5 py-1 text-xs font-black uppercase tracking-wider transition-colors border-2 border-black"
        >
          <Download className="w-3.5 h-3.5 stroke-[3]" />
          <span>INSTALL APP</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="flex items-center gap-2 bg-fugo text-black hover:bg-white hover:text-black px-4 py-2 text-xs font-black uppercase tracking-widest transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 border-2 border-black"
      >
        <Download className="w-4 h-4 stroke-[3]" />
        <span>INSTALL WAREHOUSE PWA</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 bg-white text-black hover:bg-fugo px-2.5 py-1 text-xs font-black uppercase tracking-wider transition-colors border-2 border-black"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>INSTALL ON IOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(255,221,0,1)] text-black">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-black text-fugo px-2 py-0.5 text-xs font-black uppercase tracking-widest">
                  iOS Safari Setup
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 hover:bg-black/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-xl font-black uppercase tracking-tight">
                Install FUGO Repair Terminal
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-black/80 font-bold uppercase">
                To work seamlessly inside low-signal warehouse zones:
              </p>
              
              <div className="mt-4 space-y-3 text-xs font-black">
                <div className="flex items-center gap-3 p-3 bg-fugo-dark text-white border-2 border-black">
                  <span className="w-6 h-6 rounded-full bg-fugo text-black flex items-center justify-center text-xs font-black">1</span>
                  <span>Tap the <strong className="text-fugo">Share</strong> button in Safari toolbar</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-fugo-dark text-white border-2 border-black">
                  <span className="w-6 h-6 rounded-full bg-fugo text-black flex items-center justify-center text-xs font-black">2</span>
                  <span>Scroll down & tap <strong className="text-fugo">Add to Home Screen</strong></span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full bg-black text-fugo py-3 text-xs font-black uppercase tracking-widest hover:bg-fugo hover:text-black transition border-2 border-black"
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
