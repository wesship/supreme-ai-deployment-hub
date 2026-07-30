export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (request.query?.token !== 'ccd1970e6eb8e8eeab48d0956cb5c564') {
    return response.status(404).json({ ok: false });
  }

  const tag = new Date().toISOString().replace(/[:.]/g, '-');
  const subject = `Production contact verification ${tag}`;
  const payload = {
    name: 'D3VONN.IO Production Verification',
    email: 'wesship8@gmail.com',
    subject,
    message: 'This one-time production canary verifies that the live D3VONN.IO contact endpoint delivers through Resend to hello@d3vonn.io.',
    website: '',
  };

  try {
    const upstream = await fetch('https://api.d3vonn.io/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawBody = await upstream.text();
    let upstreamBody;
    try {
      upstreamBody = JSON.parse(rawBody);
    } catch {
      upstreamBody = { raw: rawBody.slice(0, 300) };
    }

    return response.status(upstream.status).json({
      ok: upstream.status === 202 && upstreamBody?.status === 'sent',
      upstreamStatus: upstream.status,
      subject,
      upstreamBody,
    });
  } catch (error) {
    return response.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      subject,
    });
  }
}
