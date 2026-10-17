import { Portfolio as View } from "@/components/pages/Portfolio";
import { ConnectGate } from "@/components/Shell";
export default function Page() {
  return (
    <ConnectGate>
      <View />
    </ConnectGate>
  );
}
