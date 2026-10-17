"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useResource } from "@/components/Workspace";
import type { ProfileDto } from "@/lib/shared/profile";

export function ProfileAvatar({ src, className = "h-12 w-12", alt = "Foto de perfil" }: { src?: string | null; className?: string; alt?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={`inline-flex shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-ink ring-2 ring-card ${className}`}>
    {src && src !== failed && <Image unoptimized src={src} alt={alt} width={96} height={96} className="h-full w-full object-cover" onError={() => setFailed(src)} />}
  </span>;
}

export function CurrentUserAvatar({ className }: { className?: string }) {
  const { data, reload } = useResource<{ profile: ProfileDto }>("/api/profile");
  useEffect(() => {
    const update = () => { void reload(); };
    window.addEventListener("pact-profile-updated", update);
    return () => window.removeEventListener("pact-profile-updated", update);
  }, [reload]);
  return <ProfileAvatar src={data?.profile.avatarUrl} className={className} />;
}
