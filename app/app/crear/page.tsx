import View from "@/components/pages/Index";
import { Suspense } from "react";
type Props = { searchParams: Promise<{ provider?: string | string[] }> };
async function Content({ searchParams }: Props) {
  const { provider } = await searchParams;
  const address =
    typeof provider === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(provider) &&
    !/^0x0{40}$/.test(provider)
      ? provider
      : "";
  return <View key={address} initialProvider={address} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<p>Cargando acuerdo…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
