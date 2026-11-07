import { Prisma, PrismaClient } from '@prisma/client';

export type NotificationInput = {
  userId: string;
  title: string;
  body: string;
  type: string;
  orderId?: string;
  eventKey?: string;
};

type PushPayload = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { notificationId: string; type: string; orderId?: string };
};

export function notificationCopy(status: string, orderId: string, vendorName: string) {
  const shortId = orderId.slice(-8).toUpperCase();
  const messages: Record<string, { title: string; body: string }> = {
    PENDING_PAYMENT: { title: 'Complete your payment', body: `Order #${shortId} is waiting for payment.` },
    CONFIRMED: { title: 'Order received', body: `${vendorName} has received order #${shortId}.` },
    ACCEPTED_BY_VENDOR: { title: 'Order accepted', body: `${vendorName} accepted order #${shortId}.` },
    PREPARING: { title: 'Your order is being prepared', body: `${vendorName} is preparing order #${shortId}.` },
    READY_FOR_PICKUP: { title: 'Order ready', body: `Order #${shortId} is ready and a rider is being arranged.` },
    RIDER_ASSIGNED: { title: 'Rider assigned', body: `A rider is on the way to pick up order #${shortId}.` },
    PICKED_UP: { title: 'Order on the way', body: `Your rider picked up order #${shortId}.` },
    DELIVERED: { title: 'Order delivered', body: `Order #${shortId} has been delivered.` },
    PAYMENT_FAILED: { title: 'Payment failed', body: `Payment for order #${shortId} could not be completed.` },
    REJECTED: { title: 'Order could not be accepted', body: `${vendorName} could not fulfill order #${shortId}.` },
    CANCELLED: { title: 'Order cancelled', body: `Order #${shortId} has been cancelled.` },
    REFUND_PENDING: { title: 'Refund update', body: `A refund for order #${shortId} is being processed.` },
    REFUNDED: { title: 'Refund complete', body: `The refund for order #${shortId} is complete.` },
    DELIVERY_EXCEPTION: { title: 'Delivery update', body: `There is an update to delivery for order #${shortId}.` },
  };
  return messages[status] ?? { title: 'Order update', body: `Order #${shortId} status: ${status.replaceAll('_', ' ').toLowerCase()}.` };
}

export function expoPushPayload(notification: {
  id: string;
  title: string;
  body: string;
  type: string;
  orderId: string | null;
}, token: string): PushPayload {
  return {
    to: token,
    title: notification.title,
    body: notification.body,
    sound: 'default',
    data: {
      notificationId: notification.id,
      type: notification.type,
      ...(notification.orderId ? { orderId: notification.orderId } : {}),
    },
  };
}

export async function dispatchPushNotifications(
  prisma: PrismaClient,
  notifications: Array<{ id: string; userId: string; title: string; body: string; type: string; orderId: string | null }>,
) {
  if (!notifications.length) return { attempted: 0, accepted: 0, failed: 0 };
  const devices = await prisma.pushDevice.findMany({
    where: { userId: { in: [...new Set(notifications.map(item => item.userId))] } },
    select: { id: true, token: true, userId: true },
  });
  if (!devices.length) return { attempted: 0, accepted: 0, failed: 0 };

  const byUser = new Map(notifications.map(item => [item.userId, item]));
  const payloads = devices.flatMap(device => {
    const notification = byUser.get(device.userId);
    return notification ? [{ deviceId: device.id, ...expoPushPayload(notification, device.token) }] : [];
  });
  let accepted = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  for (let start = 0; start < payloads.length; start += 100) {
    const batch = payloads.slice(start, start + 100);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(batch.map(({ to, title, body, sound, data }) => ({ to, title, body, sound, data }))),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Expo Push API returned HTTP ${response.status}.`);
      const result = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
      for (const [index, ticket] of (result.data ?? []).entries()) {
        if (ticket.status === 'ok') accepted++;
        else {
          failed++;
          if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[index].to);
        }
      }
      if (result.data?.length !== batch.length) failed += Math.max(0, batch.length - (result.data?.length ?? 0));
    } finally {
      clearTimeout(timeout);
    }
  }
  if (invalidTokens.length) await prisma.pushDevice.deleteMany({ where: { token: { in: invalidTokens } } });
  return { attempted: payloads.length, accepted, failed };
}

export async function createNotifications(prisma: PrismaClient, inputs: NotificationInput[], options: { dispatchPush?: boolean } = {}) {
  const created: Array<{ id: string; userId: string; title: string; body: string; type: string; orderId: string | null }> = [];
  for (const input of inputs) {
    try {
      const notification = await prisma.notification.create({
        data: input,
        select: { id: true, userId: true, title: true, body: true, type: true, orderId: true },
      });
      created.push(notification);
    } catch (error) {
      if (input.eventKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
  }
  if(options.dispatchPush!==false){
    void dispatchPushNotifications(prisma, created).then(result => {
      if (result.failed) console.error(JSON.stringify({ event: 'push_delivery_partial_failure', ...result }));
    }).catch(error => {
      console.error(JSON.stringify({ event: 'push_delivery_failed', errorType: error instanceof Error ? error.name : 'unknown' }));
    });
  }
  return created;
}

export function logNotificationError(event: string, error: unknown) {
  console.error(JSON.stringify({ event, errorType: error instanceof Error ? error.name : 'unknown' }));
}
