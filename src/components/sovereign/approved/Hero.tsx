import { useGlobalLanguage } from '../../../hooks/useGlobalLanguage';
import SignalField from './SignalField';
import Logo3D from './Logo3D';

export default function Hero() {
  const locale = useGlobalLanguage();
  const copy = heroCopy[locale];
  return (
    <section id="top" className="relative isolate flex min-h-screen items-center overflow-hidden">
      <SignalField />

      <div className="relative z-10 mx-auto w-full max-w-[1680px] px-5 pt-24 pb-12 md:px-8">
        {/* telemetry label */}
        <div
          className="flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-accent-400/80"
        >
          <span className="h-px w-10 bg-accent-500/40"></span>
          D3VONN NETWORK // GOVERNED AI
          <span className="h-px w-10 bg-accent-500/40"></span>
        </div>

        {/* logo emblem — full width */}
        <div
          className="mt-5 flex w-full items-center justify-center"
        >
          <div className="w-full max-w-[560px]">
            <Logo3D />
          </div>
        </div>

        {/* text block with dark backdrop for readability */}
        <div className="relative mx-auto max-w-4xl text-center">
          {/* readability backdrop — stronger, wider */}
          <div className="pointer-events-none absolute -inset-x-16 -inset-y-8 rounded-[2.5rem] bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(5,6,7,0.78)_0%,rgba(5,6,7,0.42)_55%,transparent_85%)]"></div>
          {/* bottom edge softener for transition into next section */}
          <div className="pointer-events-none absolute -inset-x-16 bottom-0 h-24 bg-gradient-to-t from-background-50/40 to-transparent rounded-b-[2.5rem]"></div>

          <div className="relative">
            {/* headline */}
            <h1
              className="mt-4 font-heading text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[0.94] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)]"
            >
              {copy.headline}
              <span className="block text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)]" style={{ textShadow: '0 0 40px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.8)' }}>
                {copy.command}
              </span>
            </h1>

            {/* supporting copy */}
            <p
              className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/90 font-medium drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)]"
            >
              {copy.description}
            </p>

            {/* CTAs */}
            <div
              className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <a
                href="/app"
                className="btn-primary group inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-8 py-3.5 text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                {copy.enter}
                <i className="ri-arrow-right-line transition-transform duration-300 group-hover:translate-x-1"></i>
              </a>
              <a
                href="#signal"
                className="btn-ghost inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-8 py-3.5 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                {copy.explore}
              </a>
              <a
                href="/command-center"
                className="btn-ghost inline-flex min-h-13 items-center justify-center gap-2.5 rounded-md px-8 py-3.5 text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                <i className="ri-radar-line"></i>
                {copy.core}
              </a>
            </div>

            {/* status line */}
            <div
              className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3"
            >
              <span className="h-px flex-1 bg-white/20"></span>
              <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/60">
                Sovereign Signal // Under Your Command
              </span>
              <span className="h-px flex-1 bg-white/20"></span>
            </div>

            {/* scroll cue */}
            <div
              className="mt-6 flex flex-col items-center gap-2"
            >
              <a
                href="#platform"
                className="group flex flex-col items-center gap-2 text-white/50 transition-colors hover:text-white cursor-pointer"
                aria-label="Scroll to explore"
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.24em]">Scroll</span>
                <span className="flex h-8 w-5 items-start justify-center rounded-full border border-white/25 p-1">
                  <span className="h-2 w-px animate-pulse-glow bg-accent-400"></span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
const heroCopy = {
 en: { headline: 'INTELLIGENCE', command: 'UNDER YOUR COMMAND.', description: 'Run AI agents, organize your knowledge, and create voice and film projects from one platform—with human oversight.', enter: 'Enter the Platform', explore: 'Explore the Signal', core: 'Command Core' },
 es: { headline: 'INTELIGENCIA', command: 'BAJO TU CONTROL.', description: 'Gestiona agentes de IA, organiza tus conocimientos y crea proyectos de voz y cine desde una plataforma con supervisión humana.', enter: 'Entrar a la plataforma', explore: 'Explorar la señal', core: 'Centro de mando' },
 fr: { headline: 'INTELLIGENCE', command: 'SOUS VOTRE CONTRÔLE.', description: 'Pilotez des agents IA, organisez vos connaissances et créez des projets vocaux et vidéo sur une plateforme avec supervision humaine.', enter: 'Accéder à la plateforme', explore: 'Explorer le signal', core: 'Centre de commande' },
 de: { headline: 'INTELLIGENZ', command: 'UNTER IHRER KONTROLLE.', description: 'Steuern Sie KI-Agenten, organisieren Sie Wissen und erstellen Sie Sprach- und Filmprojekte auf einer Plattform mit menschlicher Aufsicht.', enter: 'Plattform öffnen', explore: 'Signal erkunden', core: 'Kommandozentrale' },
 pt: { headline: 'INTELIGÊNCIA', command: 'SOB SEU COMANDO.', description: 'Gerencie agentes de IA, organize conhecimento e crie projetos de voz e filmes em uma plataforma com supervisão humana.', enter: 'Entrar na plataforma', explore: 'Explorar o sinal', core: 'Central de comando' },
 ar: { headline: 'الذكاء', command: 'تحت سيطرتك.', description: 'أدِر وكلاء الذكاء الاصطناعي ونظّم معرفتك وأنشئ مشاريع صوتية وسينمائية على منصة واحدة بإشراف بشري.', enter: 'دخول المنصة', explore: 'استكشاف الإشارة', core: 'مركز القيادة' },
 zh: { headline: '智能', command: '尽在掌控。', description: '在一个有人类监督的平台上运行 AI 智能体、整理知识并创建语音和影视项目。', enter: '进入平台', explore: '探索信号', core: '指挥中心' },
 hi: { headline: 'बुद्धिमत्ता', command: 'आपके नियंत्रण में।', description: 'मानवीय निगरानी के साथ एक ही मंच पर एआई एजेंट चलाएँ, ज्ञान व्यवस्थित करें और आवाज़ व फ़िल्म परियोजनाएँ बनाएँ।', enter: 'प्लेटफ़ॉर्म खोलें', explore: 'सिग्नल देखें', core: 'कमांड केंद्र' },
} as const;
