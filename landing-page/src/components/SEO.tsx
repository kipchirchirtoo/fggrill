import Head from 'next/head';

interface SEOProps {
    title?: string;
    description?: string;
    url?: string;
    image?: string;
    type?: string;
    breadcrumbs?: { name: string; item: string }[];
    schemaList?: string[];
}

const SITE_URL = 'https://famousgatehotels.com';
const DEFAULT_TITLE = 'FamousGate Hotels — Luxury Stay & Fine Dining | Bomet & Kericho, Kenya';
const DEFAULT_DESC = 'Bomet, Kenya & Kericho, Kenya — Experience the pinnacle of luxury hospitality at FamousGate Hotels. Premium rooms, world-class dining, and elegant event spaces across Bomet and Kericho. Book your stay today.';
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

    const multiLocationSchema = {
        "@context": "https://schema.org",
        "@type": "Hotel",
        "name": "FamousGate Hotels",
        "url": "https://famousgatehotels.com",
        "logo": "https://famousgatehotels.com/logo_official.png",
        "image": "https://famousgatehotels.com/hero-bg.jpg",
        "description": "Luxury hotel chain offering premium accommodations, fine dining, and event spaces in Bomet and Kericho, Kenya.",
        "telephone": "+254-706-782828",
        "email": "famousgatesbmt@gmail.com",
        "address": [
            {
                "@type": "PostalAddress",
                "addressLocality": "Bomet",
                "addressRegion": "Bomet County",
                "addressCountry": "KE",
                "description": "Kyogong, Mogogoshiek & Sotik branches"
            },
            {
                "@type": "PostalAddress",
                "addressLocality": "Kericho",
                "addressRegion": "Kericho County",
                "addressCountry": "KE",
                "description": "Litein branch"
            }
        ],
        "priceRange": "KES 3,000 - 15,000",
        "starRating": { "@type": "Rating", "ratingValue": "5" },
        "sameAs": [
            "https://www.facebook.com/famousgate",
            "https://www.instagram.com/famousgateshotel/",
            "https://www.tiktok.com/@famousgateshotel"
        ]
    };

    return (
        <Head>
            <title>{title}</title>
            <meta name="description" content={description} />

            {/* Open Graph — shown when link is shared on WhatsApp, Facebook, Telegram etc. */}
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content="FamousGate Hotels — Luxury Stay in Bomet & Kericho, Kenya" />
            <meta property="og:url" content={url} />
            <meta property="og:type" content={type} />
            <meta property="og:site_name" content="FamousGate Hotels — Bomet & Kericho, Kenya" />
            <meta property="og:locale" content="en_KE" />

            {/* Business contact details in link previews */}
            <meta property="business:contact_data:locality" content="Bomet &amp; Kericho" />
            <meta property="business:contact_data:region" content="Rift Valley" />
            <meta property="business:contact_data:country_name" content="Kenya" />
            <meta property="business:contact_data:email" content="famousgatesbmt@gmail.com" />
            <meta property="business:contact_data:phone_number" content="+254706782828" />
            <meta property="business:contact_data:website" content="https://famousgatehotels.com" />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content="@famousgateshotels" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
            <meta name="twitter:image:alt" content="FamousGate Hotels — Bomet & Kericho, Kenya" />

            {/* Canonical URL */}
            <link rel="canonical" href={url} />

            {/* Multi-location Hotel Schema — helps Google, WhatsApp, Facebook parse address details */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(multiLocationSchema) }}
            />

            {/* Breadcrumb Schema */}
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
