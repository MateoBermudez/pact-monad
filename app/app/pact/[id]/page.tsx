import { Suspense } from "react";
import PactDetailView from "@/components/pages/PactDetail";
import { ConnectGate } from "@/components/Shell";

type PageProps = { params: Promise<{ id: string }> };

export default function PactPage({ params }: PageProps) {
  return (
    <Suspense fallback={<main className="p-6">Cargando…</main>}>
      <PactDetail params={params} />
    </Suspense>
  );
}

async function PactDetail({ params }: PageProps) {
  const { id } = await params;
  return <ConnectGate><PactDetailView id={id} /></ConnectGate>;
}
