export type NotificationType = "listing.matched";

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
