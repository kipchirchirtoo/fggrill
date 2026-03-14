import Head from 'next/head';

interface SEOProps {
    title?: string;
    description?: string;
    url?: string;
    image?: string;
    type?: string;
    breadcrumbs?: { name: string; item: string }[];
    schemaList?: string[]; // Array of stringified JSON objects for schema.org
}

const SITE_URL = 'https://famousgatehotels.com';
const DEFAULT_TITLE = 'FamousGate Hotels — Luxury Stay & Fine Dining in Nairobi';
const DEFAULT_DESC = 'Experience world-class hospitality with premium rooms, gourmet dining, and exceptional service in Nairobi, Kenya.';
const DEFAULT_IMAGE = `${SITE_URL}/hero-bg.jpg`;

export function SEO({
    title = DEFAULT_TITLE,
    description = DEFAULT_DESC,
    url = SITE_URL,
    image = DEFAULT_IMAGE,
    type = 'website',
    breadcrumbs,
    schemaList = []
}: SEOProps) {
    // Generate BreadcrumbList Schema if breadcrumbs are provided
    const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0 ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((crumb, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": crumb.name,
            "item": `${SITE_URL}${crumb.item}`
        }))
    } : null;

    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} />

            {/* Open Graph */}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:url" content={url} />
            <meta property="og:type" content={type} />
            <meta property="og:site_name" content="FamousGate Hotels" />
            <meta property="og:locale" content="en_US" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@famousgateshotels" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Canonical URL */}
            <link rel="canonical" href={url} />

            {/* JSON-LD Schemas */}
            {breadcrumbSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
                />
            )}

            {schemaList.map((schema, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: schema }}
                />
            ))}
        </Head>
    );
}
