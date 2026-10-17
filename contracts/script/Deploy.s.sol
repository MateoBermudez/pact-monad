pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {PactEscrow} from "../src/PactEscrow.sol";

contract Deploy is Script {
    function run() external returns (PactEscrow pact) {
        address agent = vm.envAddress("AGENT_ADDRESS");
        uint256 maxAutoRelease = vm.envUint("MAX_AUTO_RELEASE_MON") * 1 ether;

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        pact = new PactEscrow(agent, maxAutoRelease);
        vm.stopBroadcast();

        console2.log("PactEscrow desplegado en:", address(pact));
        console2.log("Agente autorizado:", agent);
        console2.log("Tope de pago autonomo (wei):", maxAutoRelease);
        console2.log("Bloque de referencia:", block.number);
        console2.log("Copiar a app/.env.local: NEXT_PUBLIC_CONTRACT_ADDRESS y CONTRACT_DEPLOY_BLOCK");
    }
}
