pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PactEscrow} from "../src/PactEscrow.sol";

contract Deploy is Script {
    function run() external returns (PactEscrow pact) {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        pact = new PactEscrow();
        vm.stopBroadcast();

        console2.log("PactEscrow desplegado en:", address(pact));
        console2.log("Copiar a app/.env.local como NEXT_PUBLIC_CONTRACT_ADDRESS");
    }
}
