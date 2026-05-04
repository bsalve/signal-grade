export function useCheckName() {
  function stripPrefix(name: string): string {
    return name.replace(/^\[(Technical|Content|AEO|GEO)\]\s*/, '')
  }
  return { stripPrefix }
}
