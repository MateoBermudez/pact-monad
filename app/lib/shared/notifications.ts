export type NotificationType =
  | "listing.matched"
  | "application.received"
  | "application.auto_selected"
  | "application.selected"
  | "application.rejected";

export type NotificationDto = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  listingId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export type NotificationsResponse = { notifications: NotificationDto[]; unread: number };

export const MAX_NOTIFICATIONS_PER_LISTING = 50;
