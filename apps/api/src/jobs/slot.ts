export function cronSlot(date: Date): string {
  const d = new Date(Math.floor(date.getTime() / 60000) * 60000);
  return d.toISOString();
}

export function manualSlot(date: Date = new Date()): string {
  return `manual:${date.toISOString()}`;
}
