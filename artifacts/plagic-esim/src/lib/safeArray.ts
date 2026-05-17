/**
 * 🛡️ SafeArray Utility - API response'larını her zaman güvenli array'e çevirir
 * .map(), .filter(), .find() gibi metodlar asla "is not a function" hatası vermez.
 */
export function safeArray<T>(input: any): T[] {
  if (Array.isArray(input)) return input;
  if (input == null) return [];
  if (typeof input === "object") {
    if (Array.isArray(input.data)) return input.data;
    if (Array.isArray(input.items)) return input.items;
    if (Array.isArray(input.results)) return input.results;
    if (Array.isArray(input.packages)) return input.packages;
    if (Array.isArray(input.orders)) return input.orders;
    if (Array.isArray(input.members)) return input.members;
    if (Array.isArray(input.transactions)) return input.transactions;
  }
  return [input as T];
}