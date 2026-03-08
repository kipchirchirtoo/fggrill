const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'kipchirchirtoo01@gmail.com';

const testCentralizedFlow = async () => {
    console.log('--- Centralized API Integration Test ---');

    const testCases = [
        {
            name: 'Booking Confirmation (with PDF)',
            url: `${BACKEND_URL}/landing-email/confirmation`,
            data: {
                email: TEST_EMAIL,
                firstName: 'Centralized',
                lastName: 'Test',
                confirmationNumber: 'FG-' + Date.now(),
                checkInDate: '2026-04-10',
                checkOutDate: '2026-04-15',
                roomType: 'Luxury Suite',
                guests: 2,
                totalAmount: 45000,
                branchName: 'FG Grill Bomet'
            }
        },
        {
            name: 'Reservation Request',
            url: `${BACKEND_URL}/landing-email/reservation`,
            data: {
                email: TEST_EMAIL,
                firstName: 'Centralized',
                lastName: 'Reservation',
                reservationId: 'RES-' + Date.now(),
                checkInDate: '2026-05-20',
                checkOutDate: '2026-05-25',
                roomType: 'Deluxe Room',
                guests: 1,
                totalAmount: 15000,
                paymentLink: 'https://pay.famousgate.com/test'
            }
        },
        {
            name: 'Newsletter',
            url: `${BACKEND_URL}/landing-email/newsletter`,
            data: {
                recipients: [{ email: TEST_EMAIL, name: 'Subscriber' }],
                newsletterTitle: 'Centralized Newsletter Test',
                issueDate: 'March 2026',
                featuredArticle: {
                    title: 'Eco-Friendly Tourism',
                    description: 'Discover how we are protecting the environment.',
                    imageUrl: 'https://images.unsplash.com/photo-1542314831-c6a4d27df08d',
                    readMoreLink: 'https://famousgate.com/blog/eco'
                },
                bookingLink: 'https://famousgate.com/book'
            }
        }
    ];

    for (const tc of testCases) {
        console.log(`\nTesting: ${tc.name}...`);
        try {
            const response = await axios.post(tc.url, tc.data);
            console.log(`✅ Success: Status ${response.status}`);
            console.log(`   Message: ${response.data.message || 'Sent'}`);
        } catch (error) {
            console.error(`❌ Failed: ${tc.name}`);
            if (error.response) {
                console.error(`   Error Status: ${error.response.status}`);
                console.error(`   Error Detail:`, JSON.stringify(error.response.data, null, 2));
            } else {
                console.error(`   Error Message: ${error.message}`);
            }
        }
    }
};

testCentralizedFlow();
