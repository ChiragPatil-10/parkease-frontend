/**
 * Title case for a city as it is displayed: "bangalore" -> "Bangalore", "navi mumbai" -> "Navi Mumbai".
 * Only for display; the stored value and what is sent to the API are not changed.
 */
export function formatCity(city: string | null | undefined): string {
  return (city ?? '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toUpperCase());
}
