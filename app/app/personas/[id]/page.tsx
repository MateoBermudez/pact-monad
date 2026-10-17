import { Suspense } from "react";
import { PublicProfile as View } from "@/components/pages/Portfolio";
type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  const { id } = await params;
  return <View id={id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
