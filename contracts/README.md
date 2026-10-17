# contracts — PactEscrow

Escrow de acuerdos de trabajo en MON nativo. Solidity 0.8.28, Foundry.

## Ciclo de vida

```
Created ──► Accepted ──► Delivered ──► Approved (pagado)
   │            │
   └────────────┴──► Cancelled (reembolso)
```

| Función | Llama | Efecto |
|---|---|---|
| `createAgreement(provider, description, deadline, rulesHash)` payable | cliente | bloquea el MON enviado → Created |
| `acceptAgreement(id)` | proveedor | → Accepted |
| `registerDelivery(id, url, note)` | proveedor | guarda enlace y nota → Delivered |
| `approveAndRelease(id)` | cliente | paga al proveedor → Approved |
| `cancelAndRefund(id)` | cliente | reembolsa → Cancelled (solo en Created o Accepted) |
| `setAutoReleaseLimit(limit)` | cliente | fija hasta cuánto puede pagar el agente de IA sin su firma |
| `releaseByAgent(id, decisionHash)` | agente | paga al proveedor dentro del límite del cliente → Approved |
| `getAgreement(id)` | cualquiera | lectura |

## Pago autónomo de la IA

El cliente decide cuánto confía en el agente. **El límite se hace cumplir aquí, en el contrato**, no en el servidor:

- `autoReleaseLimit[cliente]` vale **0 por defecto**: la IA nunca paga sola hasta que el cliente lo active.
- `setAutoReleaseLimit` rechaza valores por encima de `maxAutoRelease`, un tope fijado al desplegar (inmutable).
- `releaseByAgent` solo puede llamarla `agent` (dirección inmutable), solo sobre acuerdos en `Delivered`, y solo si
  `amount <= autoReleaseLimit[cliente]`. El cliente puede bajar el límite a 0 en cualquier momento.
- El agente **no puede redirigir fondos**: el pago siempre va al proveedor acordado. Si su clave se filtra, lo peor que
  puede pasar es que se paguen antes de tiempo acuerdos ya entregados y dentro del límite.
- `decisionHash` es el hash de la decisión de la IA (criterios evaluados, veredicto, evidencia). Queda en el evento
  `AgentReleased`, así cualquiera puede comprobar que la decisión guardada off-chain es la que autorizó el pago.
- `rulesHash` fija on-chain las reglas de aceptación que el humano confirmó al crear el acuerdo.

## Reglas de diseño

- **Cancelar solo antes de la entrega.** Una vez en Delivered, el cliente solo puede aprobar; así no puede quedarse con el trabajo y recuperar el dinero. Las disputas quedan fuera del MVP.
- **El plazo se guarda pero no se fuerza.** Debe ser futuro al crear; sirve de referencia para la interfaz.
- **Checks-effects-interactions.** El estado cambia antes de transferir. Hay una prueba de reentrada que lo demuestra.
- **Sin `receive`/`fallback`.** El contrato solo recibe MON por `createAgreement`.
- **Errores personalizados y eventos** en cada transición, para que el frontend, el indexador y el explorer reconstruyan el historial.

## Comandos

```sh
forge build
forge test            # 53 pruebas, incluye fuzzing y reentrada
forge test -vvv       # con trazas
forge test --gas-report

cp .env.example .env  # PRIVATE_KEY de una wallet de testnet NUEVA y desechable, AGENT_ADDRESS y MAX_AUTO_RELEASE_MON
source .env
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
bash script/export-abi.sh   # copia el ABI a ../app/abi/
```

El script de despliegue imprime la dirección del contrato y un bloque de referencia: van a `app/.env.local` como
`NEXT_PUBLIC_CONTRACT_ADDRESS` y `CONTRACT_DEPLOY_BLOCK` (el indexador empieza a leer ahí).

Windows: `foundryup` instala en `~/.foundry/bin`; añadirlo al PATH. En macOS: `brew install foundry`.
