export const hotelSchema = {
  "@context": "https://schema.org",
  "@type": "Hotel",
  "@id": "https://famousgates.com/#hotel",
  "name": "Famous Gates Hotels",
  "alternateName": ["FG Hotels", "Famous Gates", "FG", "FG Grill Hotel"],
  "description":
    "Famous Gates Hotels is Nairobi's premier luxury hotel offering elegantly " +
    "appointed rooms, the signature FG Grill restaurant, state-of-the-art " +
    "conference facilities, and world-class hospitality in the heart of Nairobi, Kenya.",
  "url": "https://famousgates.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://famousgates.com/logo.png",
    "width": 400,
    "height": 400
  },
  "image": [
    "https://famousgates.com/images/hotel-exterior.jpg",
    "https://famousgates.com/images/lobby.jpg",
    "https://famousgates.com/images/fg-grill-restaurant.jpg",
    "https://famousgates.com/images/conference-room.jpg",
    "https://famousgates.com/images/deluxe-room.jpg"
  ],
  "telephone": "+254-706-782828",
  "email": "info@famousgates.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Famous Gates Building, Ngong Road",
    "addressLocality": "Nairobi",
    "addressRegion": "Nairobi County",
    "postalCode": "00100",
    "addressCountry": "KE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": -1.2921,
    "longitude": 36.8219
  },
  "hasMap": "https://maps.google.com/?q=Famous+Gates+Hotels+Nairobi+Kenya",
  "starRating": {
    "@type": "Rating",
    "ratingValue": "4",
    "bestRating": "5"
  },
  "priceRange": "KES 5,000 - KES 25,000",
  "checkinTime": "12:00",
  "checkoutTime": "10:00",
  "numberOfRooms": 50,
  "currenciesAccepted": "KES, USD, EUR",
  "paymentAccepted": "Cash, Visa, Mastercard, M-Pesa, Airtel Money",
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "Free WiFi", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Restaurant", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Bar", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Conference Facilities", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Banquet Hall", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Parking", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Room Service", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "24-Hour Front Desk", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Laundry Service", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Airport Transfers", "value": true }
  ],
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    }
  ],
  "containsPlace": [
    {
      "@type": "FoodEstablishment",
      "name": "FG Grill",
      "servesCuisine": ["Kenyan", "Continental", "Grills"],
      "url": "https://famousgates.com/restaurant"
    }
  ],
  "sameAs": [
    "https://www.facebook.com/famousgateshotel",
    "https://www.instagram.com/famousgateshotel",
    "https://twitter.com/famousgateshotel",
    "https://www.tripadvisor.com/Hotel-REPLACE_WITH_ACTUAL_URL",
    "https://www.booking.com/hotel/ke/REPLACE_WITH_ACTUAL_URL.html",
    "https://www.linkedin.com/company/famous-gates-hotels"
  ],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://famousgates.com/book",
      "inLanguage": "en",
      "actionPlatform": [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
        "http://schema.org/IOSPlatform",
        "http://schema.org/AndroidPlatform"
      ]
    },
    "result": {
      "@type": "LodgingReservation",
      "name": "Hotel Room Reservation at Famous Gates Hotels"
    }
  }
}

export const restaurantSchema = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": "https://famousgates.com/restaurant#restaurant",
  "name": "FG Grill",
  "alternateName": ["Famous Gates Grill", "FG Grill Restaurant", "FG Restaurant Nairobi"],
  "description":
    "FG Grill is the signature fine-dining restaurant at Famous Gates Hotels, Nairobi. " +
    "Offering expertly crafted grills, Kenyan cuisine, and international dishes in an " +
    "elegant setting. Perfect for business lunches, romantic dinners, and celebrations.",
  "url": "https://famousgates.com/restaurant",
  "image": [
    "https://famousgates.com/images/fg-grill-interior.jpg",
    "https://famousgates.com/images/fg-grill-food.jpg"
  ],
  "telephone": "+254-706-782828",
  "email": "restaurant@famousgates.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Famous Gates Building, Ngong Road",
    "addressLocality": "Nairobi",
    "addressRegion": "Nairobi County",
    "postalCode": "00100",
    "addressCountry": "KE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": -1.2921,
    "longitude": 36.8219
  },
  "servesCuisine": ["Kenyan", "Continental", "Grills", "International", "African"],
  "priceRange": "KES 800 - KES 5,000",
  "hasMenu": "https://famousgates.com/restaurant/menu",
  "acceptsReservations": "true",
  "menu": "https://famousgates.com/restaurant/menu",
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "07:00",
      "closes": "22:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday", "Sunday"],
      "opens": "07:00",
      "closes": "23:00"
    }
  ],
  "paymentAccepted": "Cash, Visa, Mastercard, M-Pesa",
  "currenciesAccepted": "KES, USD",
  "potentialAction": [
    {
      "@type": "ReserveAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://famousgates.com/restaurant/reserve",
        "actionPlatform": [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform"
        ]
      },
      "result": {
        "@type": "FoodEstablishmentReservation",
        "name": "Table Reservation at FG Grill"
      }
    }
  ],
  "sameAs": [
    "https://www.facebook.com/famousgateshotel",
    "https://www.instagram.com/famousgateshotel"
  ]
}

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://famousgates.com/#organization",
  "name": "Famous Gates Hotels",
  "alternateName": ["Famous Gates", "FG Hotels", "FG Grill", "Famous Gates Ltd"],
  "url": "https://famousgates.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://famousgates.com/logo.png",
    "width": 400,
    "height": 400
  },
  "description":
    "Famous Gates Hotels is Nairobi's leading hospitality brand, delivering " +
    "luxury accommodation, conference services, and the FG Grill restaurant experience.",
  "foundingDate": "2011",
  "areaServed": {
    "@type": "City",
    "name": "Nairobi",
    "sameAs": "https://en.wikipedia.org/wiki/Nairobi"
  },
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "telephone": "+254-706-782828",
      "contactType": "reservations",
      "areaServed": "KE",
      "availableLanguage": ["English", "Swahili"]
    },
    {
      "@type": "ContactPoint",
      "telephone": "+254-706-782828",
      "contactType": "customer service",
      "areaServed": "KE",
      "availableLanguage": ["English", "Swahili"]
    }
  ],
  "sameAs": [
    "https://www.facebook.com/famousgateshotel",
    "https://www.instagram.com/famousgateshotel",
    "https://twitter.com/famousgateshotel",
    "https://www.linkedin.com/company/famous-gates-hotels",
    "https://www.tripadvisor.com/Hotel-REPLACE",
    "https://www.booking.com/hotel/ke/REPLACE.html"
  ]
}

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Where is Famous Gates Hotels located?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Famous Gates Hotels is located in Nairobi, Kenya at Famous Gates Building, Ngong Road. We are conveniently situated, easily accessible from the CBD and major landmarks."
      }
    },
    {
      "@type": "Question",
      "name": "What is the check-in time at Famous Gates Hotels?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Check-in time at Famous Gates Hotels is 12:00 PM (noon). Check-out time is 10:00 AM. Early check-in and late check-out are available on request, subject to availability."
      }
    },
    {
      "@type": "Question",
      "name": "Does Famous Gates Hotels have a restaurant?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Famous Gates Hotels is home to FG Grill, our signature restaurant serving Kenyan, continental, and international cuisine. FG Grill is open 7 days a week for breakfast, lunch, and dinner, with table reservations available."
      }
    },
    {
      "@type": "Question",
      "name": "What conference facilities does Famous Gates Hotels offer?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Famous Gates Hotels offers fully-equipped conference and banquet facilities ideal for corporate meetings, workshops, seminars, and private events. Our conference rooms feature AV equipment, high-speed WiFi, and dedicated catering services."
      }
    },
    {
      "@type": "Question",
      "name": "How do I book a room at Famous Gates Hotels?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can book directly at famousgates.com/book for the best available rates. You can also call us at +254-706-782828 or email info@famousgates.com. Direct bookings receive exclusive benefits not available through third-party platforms."
      }
    },
    {
      "@type": "Question",
      "name": "Does Famous Gates Hotels have parking?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Famous Gates Hotels provides free parking for hotel guests and restaurant visitors."
      }
    },
    {
      "@type": "Question",
      "name": "What payment methods does Famous Gates Hotels accept?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Famous Gates Hotels accepts cash (KES and USD), Visa, Mastercard, M-Pesa, and Airtel Money. Invoicing is available for corporate bookings."
      }
    },
    {
      "@type": "Question",
      "name": "Does FG Grill take reservations?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. FG Grill welcomes table reservations for lunch and dinner. You can reserve a table online at famousgates.com/restaurant/reserve or call +254-706-782828."
      }
    }
  ]
}
