import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Container from '@/components/Container';
import SectionHeading from '@/components/SectionHeading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, MailIcon, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import D3vonnPageBanner from '@/components/index/D3vonnPageBanner';
import { env } from '@/lib/env';
import { contactPreset } from '@/lib/contactPresets';
import { useSearchParams } from 'react-router-dom';

type ContactFormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

const EMPTY_FORM: ContactFormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
  website: '',
};

const Contact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<ContactFormState>(() => ({
    ...EMPTY_FORM,
    ...(contactPreset(searchParams.get('inquiry')) ?? {}),
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof ContactFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${env.apiUrl.replace(/\/$/, '')}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as
        | { detail?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.detail || 'Your message could not be delivered.');
      }

      setForm(EMPTY_FORM);
      toast.success('Message delivered', {
        description: payload?.message || 'We will get back to you as soon as possible.',
      });
    } catch (error) {
      toast.error('Message not delivered', {
        description:
          error instanceof Error
            ? error.message
            : 'Please email hello@d3vonn.io directly and try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <D3vonnPageBanner title="Contact D3VONN.IO" />
      <Helmet>
        <title>Contact Us - D3VONN.IO</title>
      </Helmet>
      <Container>
        <SectionHeading subheading="Get in touch with our team for support or inquiries">
          Contact Us
        </SectionHeading>

        <div className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <UserRound className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Creator & Founder</p>
                      <p className="text-sm text-muted-foreground">Wesley K. Little</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <MailIcon className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        href="mailto:hello@d3vonn.io"
                      >
                        hello@d3vonn.io
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Globe className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Website</p>
                      <a
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        href="https://www.d3vonn.io"
                      >
                        www.d3vonn.io
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>Send us a message</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Your Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={form.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        className="w-full rounded-md border bg-background p-2"
                        autoComplete="name"
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={(event) => updateField('email', event.target.value)}
                        className="w-full rounded-md border bg-background p-2"
                        autoComplete="email"
                        maxLength={254}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium">
                      Subject
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      value={form.subject}
                      onChange={(event) => updateField('subject', event.target.value)}
                      className="w-full rounded-md border bg-background p-2"
                      maxLength={160}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">
                      Your Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      value={form.message}
                      onChange={(event) => updateField('message', event.target.value)}
                      className="w-full resize-none rounded-md border bg-background p-2"
                      minLength={10}
                      maxLength={5000}
                      required
                    />
                  </div>

                  <div className="absolute -left-[10000px]" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input
                      id="website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(event) => updateField('website', event.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send Message'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </Container>
    </>
  );
};

export default Contact;
