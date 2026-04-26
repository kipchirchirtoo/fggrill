export function CanonicalUrl({ path }: { path: string }) {
  return (
    <link rel="canonical" href={`https://famousgates.com${path}`} />
  )
}
