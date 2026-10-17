import { Suspense } from "react";
import { SocialAuth } from "@/components/SocialAuth";
export default function Page() {
  return (
    <Suspense fallback={<p>Cargando acceso…</p>}>
      <SocialAuth />
    </Suspense>
  );
}
