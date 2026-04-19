import { PATCH } from '../route';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const body = await req.json().catch(() => ({}));
  const patchedRequest = new Request(req.url, {
    method: 'PATCH',
    headers: req.headers,
    body: JSON.stringify({ action: 'react', emoji: body.emoji }),
  });

  return PATCH(patchedRequest, context);
}
