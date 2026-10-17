"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="card space-y-4 text-center"><h1 className="font-display text-2xl font-bold">No pudimos cargar esta página</h1><p className="text-sm text-muted-foreground">Vuelve a intentarlo para continuar.</p><button onClick={reset} className="btn-primary">Reintentar</button></section>; }
