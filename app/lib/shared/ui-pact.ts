import type { AgreementDto } from "./agreements";
import type { AgreementStatusName } from "./pact";
export type Role = "cliente" | "proveedor";
export type Status =
  "Creado" | "Aceptado" | "Entregado" | "Aprobado" | "Cancelado";
export type Pact = {
  id: string;
  title: string;
  description: string;
  amount: number;
  days: number;
  role: Role;
  counterparty: string;
  status: Status;
  createdAt: string;
  createTx: string | null;
};
export const STATUS_NAMES: Record<AgreementStatusName, Status> = {
  Created: "Creado",
  Accepted: "Aceptado",
  Delivered: "Entregado",
  Approved: "Aprobado",
  Cancelled: "Cancelado",
};
export const STATUS_BADGE: Record<Status, string> = {
  Creado: "bg-muted text-muted-foreground",
  Aceptado: "bg-primary text-primary-foreground",
  Entregado: "bg-warning/15 text-warning",
  Aprobado: "bg-success/15 text-success",
  Cancelado: "bg-destructive/15 text-destructive",
};
export const short = (value: string) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Sin conectar";
export const aiCanRelease = (amount: number, enabled: boolean, limit: number) =>
  enabled && limit > 0 && amount <= limit;
export const addDays = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export function toPact(item: AgreementDto): Pact {
  return {
    id: item.id,
    title:
      item.listingTitle ??
      item.description?.split(/[.\n]/)[0]?.slice(0, 80) ??
      "Acuerdo",
    description: item.description ?? "",
    amount: Number(item.amountMon),
    days: Math.max(
      1,
      Math.round(
        (Date.parse(item.deadline) - Date.parse(item.createdAt)) / 86_400_000,
      ),
    ),
    role: item.role === "client" ? "cliente" : "proveedor",
    counterparty: item.counterparty.wallet,
    status: STATUS_NAMES[item.status],
    createdAt: new Date(item.createdAt).toLocaleDateString("es-ES"),
    createTx: item.createTx,
  };
}
