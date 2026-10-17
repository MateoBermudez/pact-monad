import "client-only";
import { api, jsonRequest } from "@/lib/client/api";
import type { NotificationsResponse } from "@/lib/shared/notifications";

export function fetchNotifications(limit = 20): Promise<NotificationsResponse> {
  return api<NotificationsResponse>(`/api/notifications?limit=${limit}`);
}

export function markNotificationsRead(ids?: string[]): Promise<{ updated: number }> {
  return api<{ updated: number }>("/api/notifications/read", jsonRequest("POST", { ids: ids?.map(Number) }));
}
