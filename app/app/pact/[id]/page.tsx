import { Suspense } from "react";

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
  return <main className="p-6">PACT #{id}</main>;
}
