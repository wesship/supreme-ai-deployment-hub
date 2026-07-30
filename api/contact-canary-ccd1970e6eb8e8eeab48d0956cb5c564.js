export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(410).json({
    ok: false,
    error: 'Production contact canary disabled',
  });
}
