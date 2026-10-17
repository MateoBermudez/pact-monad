import "client-only";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchNotifications, markNotificationsRead } from "@/lib/client/notifications";
import { usePact } from "@/lib/client/pact-context";
import type { NotificationDto } from "@/lib/shared/notifications";

export function useNotifications() {
  const router = useRouter();
  const { signedIn, changes } = usePact();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [reloads, setReloads] = useState(0);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!signedIn) {
      known.current = null;
      return;
    }
    let active = true;
    void fetchNotifications()
      .then((data) => {
        if (!active) return;
        const seen = known.current;
        if (seen) {
          for (const item of data.notifications) {
            if (seen.has(item.id) || item.readAt) continue;
            const listingId = item.listingId;
            toast(item.title, {
              description: item.body ?? undefined,
              action: listingId ? { label: "Ver", onClick: () => router.push(`/solicitudes/${listingId}`) } : undefined,
            });
          }
        }
        known.current = new Set(data.notifications.map((item) => item.id));
        setItems(data.notifications);
        setUnread(data.unread);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [signedIn, changes, reloads, router]);

  const markAllRead = useCallback(async () => {
    await markNotificationsRead();
    setReloads((count) => count + 1);
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    await markNotificationsRead(ids);
    setReloads((count) => count + 1);
  }, []);

  return { items: signedIn ? items : [], unread: signedIn ? unread : 0, markAllRead, markRead };
}
