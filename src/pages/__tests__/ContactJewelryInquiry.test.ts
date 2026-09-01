import { contactPreset } from '@/lib/contactPresets';

describe('Mile High Golden Elevation contact preset', () => {
  it('prefills the verified jewelry inquiry without accepting arbitrary query content', () => {
    expect(contactPreset('mile-high-golden-elevation')).toMatchObject({
      subject: 'Mile High Golden Elevation consultation',
      message: expect.stringContaining('private jewelry consultation'),
    });
    expect(contactPreset('untrusted-subject')).toBeNull();
  });
});
