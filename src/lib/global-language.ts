/** Gate 1: dependency-free website locale foundation. No automatic translation of private content. */
export const supportedLocales = ["en", "es", "fr", "de", "pt", "ar", "zh", "hi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const defaultLocale: SupportedLocale = "en";
export const messages: Record<SupportedLocale, { hero: string; subtitle: string; start: string }> = {
  en: { hero: "One Platform. One Intelligence.", subtitle: "Build, connect, and manage your AI-powered future.", start: "Get Started" },
  es: { hero: "Una plataforma. Una inteligencia.", subtitle: "Construye, conecta y gestiona tu futuro impulsado por IA.", start: "Comenzar" },
  fr: { hero: "Une plateforme. Une intelligence.", subtitle: "Créez, connectez et gérez votre avenir avec l'IA.", start: "Commencer" },
  de: { hero: "Eine Plattform. Eine Intelligenz.", subtitle: "Gestalte, vernetze und verwalte deine KI-gestützte Zukunft.", start: "Loslegen" },
  pt: { hero: "Uma plataforma. Uma inteligência.", subtitle: "Crie, conecte e gerencie seu futuro com IA.", start: "Começar" },
  ar: { hero: "منصة واحدة. ذكاء واحد.", subtitle: "ابنِ مستقبلك المدعوم بالذكاء الاصطناعي واربطه وأدِره.", start: "ابدأ الآن" },
  zh: { hero: "一个平台，一种智能。", subtitle: "构建、连接和管理由人工智能驱动的未来。", start: "开始使用" },
  hi: { hero: "एक मंच। एक बुद्धिमत्ता।", subtitle: "एआई के साथ अपना भविष्य बनाएँ, जोड़ें और प्रबंधित करें।", start: "शुरू करें" },
};
export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  const code = (input ?? "").toLowerCase().split(/[-_]/)[0];
  return supportedLocales.find((locale) => locale === code) ?? defaultLocale;
}
export function isRtlLocale(locale: SupportedLocale): boolean { return locale === "ar"; }
export function translate(locale: SupportedLocale, key: keyof typeof messages.en): string {
  return messages[locale][key] || messages.en[key];
}
