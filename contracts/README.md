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
| `createAgreement(provider, description, deadline)` payable | cliente | bloquea el MON enviado → Created |
| `acceptAgreement(id)` | proveedor | → Accepted |
| `registerDelivery(id, url)` | proveedor | guarda el enlace → Delivered |
| `approveAndRelease(id)` | cliente | paga al proveedor → Approved |
| `cancelAndRefund(id)` | cliente | reembolsa → Cancelled (solo en Created o Accepted) |
| `getAgreement(id)` | cualquiera | lectura |

## Reglas de diseño

- **Cancelar solo antes de la entrega.** Una vez en Delivered, el cliente solo puede aprobar; así no puede quedarse con el trabajo y recuperar el dinero. Las disputas quedan fuera del MVP.
- **El plazo se guarda pero no se fuerza.** Debe ser futuro al crear; sirve de referencia para la interfaz.
- **Checks-effects-interactions.** El estado cambia antes de transferir. Hay una prueba de reentrada que lo demuestra.
- **Sin `receive`/`fallback`.** El contrato solo recibe MON por `createAgreement`.
- **Errores personalizados y eventos** en cada transición, para que el frontend y el explorer reconstruyan el historial.

## Comandos

```sh
forge build
forge test            # 30 pruebas, incluye fuzzing y reentrada
forge test -vvv       # con trazas
forge test --gas-report

cp .env.example .env  # PRIVATE_KEY de una wallet de testnet NUEVA y desechable
source .env
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
bash script/export-abi.sh   # copia el ABI a ../app/abi/
```

Windows: `foundryup` instala en `~/.foundry/bin`; añadirlo al PATH.
