import { NewListing as View } from "@/components/pages/Listings";
import { ConnectGate } from "@/components/Shell";
export default function Page() {
  return (
    <ConnectGate>
      <View />
    </ConnectGate>
  );
}
