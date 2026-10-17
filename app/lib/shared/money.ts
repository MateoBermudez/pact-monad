// Recorta ceros sobrantes de un decimal en texto: "5000000.0" -> "5000000", "0.100" -> "0.1".
export function trimMon(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
