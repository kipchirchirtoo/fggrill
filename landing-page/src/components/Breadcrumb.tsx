interface BreadcrumbItem {
  label: string
  href: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.label,
      "item": `https://famousgates.com${item.href}`
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <nav aria-label="Breadcrumb" className="py-4">
        <ol className="flex list-none p-0 text-sm">
          {items.map((item, i) => (
            <li key={item.href} className="flex items-center">
              {i < items.length - 1 ? (
                <>
                  <a href={item.href} className="text-gold hover:underline">{item.label}</a>
                  <span className="mx-2 text-gray-400">/</span>
                </>
              ) : (
                <span aria-current="page" className="text-gray-500">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
