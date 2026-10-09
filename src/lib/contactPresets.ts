export type ContactPreset = {
  subject: string;
  message: string;
};

const JEWELRY_INQUIRY = 'mile-high-golden-elevation';

export function contactPreset(inquiry: string | null): ContactPreset | null {
  if (inquiry === 'newsletter') return {
    subject: 'D3VONN Signal newsletter subscription',
    message: 'Please add me to The Signal newsletter. I consent to receiving occasional D3VONN updates.',
  };
  if (inquiry !== JEWELRY_INQUIRY) return null;
  return {
    subject: 'Mile High Golden Elevation consultation',
    message:
      'I am interested in a private jewelry consultation. Please contact me about engagement, fine jewelry, or a custom piece.',
  };
}
