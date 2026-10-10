import { useEffect, useMemo, useState } from 'react';
import { Download, Share2, Smartphone } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function GuardianInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showIosHelp, setShowIosHelp] = useState(false);
  const isIos = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    if (isIos) setShowIosHelp(true);
  };

  if (installed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
        <Smartphone className="h-4 w-4" /> Guardian app installed
      </div>
    );
  }

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 text-sm font-semibold text-white hover:bg-white/[0.08] sm:w-auto"
      >
        <Download className="mr-2 h-4 w-4" /> Install Guardian app
      </button>
      {showIosHelp && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-6 text-zinc-300" role="status">
          <div className="flex items-start gap-3">
            <Share2 className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
            <p>On iPhone: tap <strong>Share</strong> in Safari, choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>. Guardian will open from its own icon like an app.</p>
          </div>
        </div>
      )}
    </div>
  );
}
