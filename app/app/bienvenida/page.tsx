import { ConnectGate } from "@/components/Shell";
import { WelcomeTour } from "@/components/WelcomeTour";
import "../welcome.css";

export default function Page() {
  return <ConnectGate><WelcomeTour /></ConnectGate>;
}
