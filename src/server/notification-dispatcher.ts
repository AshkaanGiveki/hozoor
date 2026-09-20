type NotificationPayload = { companyId: string; userId: string; title: string; body: string; href?: string | null };
export type NotificationDeliveryResult = { delivered: boolean; status?: number; attempts: number; reason?: string; providerBody?: string };

export async function dispatchNotification(payload: NotificationPayload): Promise<NotificationDeliveryResult> {
  const endpoint = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!endpoint) return { delivered: false, attempts: 0, reason: "NOTIFICATION_WEBHOOK_URL is not configured" };
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.NOTIFICATION_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.NOTIFICATION_WEBHOOK_SECRET}` } : {}) }, body: JSON.stringify({ event: "notification.created", data: payload }) });
    const body = await response.text().catch(() => "");
    const providerBody = body ? body.slice(0, 2000) : undefined;
    if (process.env.NOTIFICATION_DEBUG === "true") console.warn("Notification delivery result", { status: response.status, ok: response.ok, providerBody });
    return response.ok ? { delivered: true, status: response.status, attempts: 1 } : { delivered: false, status: response.status, attempts: 1, reason: `Provider returned HTTP ${response.status}`, providerBody };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network error while delivering notification";
    if (process.env.NOTIFICATION_DEBUG === "true") console.error("Notification delivery error", reason);
    return { delivered: false, attempts: 1, reason };
  }
}

export async function retryNotification(payload: NotificationPayload, attempts: number) {
  const maxAttempts = Math.min(Math.max(Math.floor(attempts), 1), 5);
  let last: NotificationDeliveryResult = { delivered: false, attempts: 0, reason: "Not attempted" };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await dispatchNotification(payload);
    if (last.delivered) return { ...last, attempts: attempt };
  }
  return { ...last, attempts: maxAttempts };
}
