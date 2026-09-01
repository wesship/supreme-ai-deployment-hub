export type ContactPreset = {
  subject: string;
  message: string;
};

const JEWELRY_INQUIRY = 'mile-high-golden-elevation';

export function contactPreset(inquiry: string | null): ContactPreset | null {
  if (inquiry !== JEWELRY_INQUIRY) return null;
  return {
    subject: 'Mile High Golden Elevation consultation',
    message:
      'I am interested in a private jewelry consultation. Please contact me about engagement, fine jewelry, or a custom piece.',
  };
}
