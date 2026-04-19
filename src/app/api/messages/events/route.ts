import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { subscribeToMessageEvents, type MessageEventPayload } from '@/lib/messageEvents';

function sseChunk(event: MessageEventPayload) {
  return `event: update\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = (session.user as { id: string }).id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));

      const off = subscribeToMessageEvents(userId, (event) => {
        controller.enqueue(encoder.encode(sseChunk(event)));
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        off();
        controller.close();
      };

      request.signal.addEventListener('abort', cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}