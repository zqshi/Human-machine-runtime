import { Hono } from 'hono';
import type { DecisionConsole } from '../../contexts/channel/decision-console.js';
import type { ChannelService } from '../../contexts/channel/channel-service.js';
import type { ChannelType } from '../../contexts/channel/channel-adapter.js';
import type { Principal } from '../../middleware/auth.js';
import type { Context } from 'hono';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

export function createCockpitChannelRoutes(
  decisionConsole: DecisionConsole,
  channelService: ChannelService
) {
  const app = new Hono();

  app.get('/channels', async (c) => {
    const health = await decisionConsole.getChannelHealth();
    return c.json({
      channels: health,
      available: channelService.listChannelTypes(),
    });
  });

  app.get('/channels/view', async (c) => {
    const user = getUser(c);
    const view = await decisionConsole.getAggregatedView(user.username);
    return c.json(view);
  });

  app.get('/channels/timeline', async (c) => {
    const user = getUser(c);
    const limit = Number(c.req.query('limit')) || 50;
    const before = c.req.query('before') ? new Date(c.req.query('before')!) : undefined;
    const channelTypes = c.req.query('channels')?.split(',').filter(Boolean) as
      | ChannelType[]
      | undefined;

    const timeline = await decisionConsole.getUnifiedTimeline(user.username, {
      limit,
      before,
      channelTypes,
    });
    return c.json(timeline);
  });

  app.post('/channels/dispatch', async (c) => {
    const body = await c.req.json<{
      targetChannels: ChannelType[];
      roomId: string;
      message: { type: 'text' | 'rich_text' | 'card' | 'file'; content: string };
    }>();

    if (!body.targetChannels?.length || !body.roomId || !body.message?.content) {
      return c.json({ error: 'targetChannels, roomId, and message.content required' }, 400);
    }

    const result = await decisionConsole.dispatch({
      targetChannels: body.targetChannels,
      roomId: body.roomId,
      message: { type: body.message.type || 'text', content: body.message.content },
    });
    return c.json(result);
  });

  app.post('/channels/switch', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{
      conversationId: string;
      fromChannel: ChannelType;
      toChannel: ChannelType;
      notifyMessage?: string;
    }>();

    if (!body.conversationId || !body.fromChannel || !body.toChannel) {
      return c.json({ error: 'conversationId, fromChannel, and toChannel required' }, 400);
    }

    const message = body.notifyMessage
      ? { type: 'text' as const, content: body.notifyMessage }
      : undefined;

    const result = await decisionConsole.switchChannel(
      user.username,
      body.conversationId,
      body.fromChannel,
      body.toChannel,
      message
    );
    return c.json(result);
  });

  return app;
}
