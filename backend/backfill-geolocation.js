/**
 * Backfill Geolocation Data for Existing Auth Logs
 * 
 * This script updates existing auth_logs entries that don't have geolocation data
 * by fetching location info based on their IP addresses.
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Load environment variables
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting
let requestCount = 0;
const RATE_LIMIT = 45; // ip-api.com allows 45 requests per minute
const RATE_WINDOW = 60000; // 1 minute in milliseconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkRateLimit() {
  if (requestCount >= RATE_LIMIT) {
    console.log(`⏳ Rate limit reached (${RATE_LIMIT} requests). Waiting 60 seconds...`);
    await sleep(RATE_WINDOW);
    requestCount = 0;
  }
}

function normalizeIP(ip) {
  if (!ip) return 'unknown';
  
  // Remove IPv6 prefix for IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Handle localhost
  if (ip === '::1' || ip === '127.0.0.1') {
    return '127.0.0.1';
  }
  
  return ip;
}

async function getGeolocation(ip) {
  const normalizedIP = normalizeIP(ip);
  
  // Skip localhost
  if (normalizedIP === '127.0.0.1' || normalizedIP === 'unknown') {
    return {
      country: 'Local',
      country_code: 'LOCAL',
      city: 'Localhost',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isp: 'Local Network',
      is_proxy: false,
      is_vpn: false,
      is_datacenter: false,
      threat_score: 0
    };
  }

  try {
    await checkRateLimit();
    requestCount++;

    const response = await axios.get(
      `http://ip-api.com/json/${normalizedIP}?fields=status,message,country,countryCode,city,lat,lon,timezone,isp,proxy,hosting`,
      { timeout: 5000 }
    );

    if (response.data.status === 'fail') {
      console.warn(`   ⚠️  Geolocation lookup failed for IP ${normalizedIP}: ${response.data.message}`);
      return null;
    }

    const data = response.data;
    
    // Calculate basic threat score
    let threat_score = 0;
    if (data.proxy) threat_score += 35;
    if (data.hosting) threat_score += 25;

    return {
      country: data.country || 'Unknown',
      country_code: data.countryCode || 'XX',
      city: data.city || 'Unknown',
      latitude: data.lat || 0,
      longitude: data.lon || 0,
      timezone: data.timezone || 'UTC',
      isp: data.isp || 'Unknown',
      is_proxy: data.proxy || false,
      is_vpn: data.proxy || false,
      is_datacenter: data.hosting || false,
      threat_score
    };
  } catch (error) {
    console.error(`   ❌ Error fetching geolocation for IP ${normalizedIP}:`, error.message);
    return null;
  }
}

async function backfillGeolocation() {
  console.log('🔄 Starting Geolocation Backfill Process...\n');

  try {
    // Get all auth_logs without geolocation data
    const { data: logs, error } = await supabase
      .from('auth_logs')
      .select('id, ip_address, geo_country')
      .is('geo_country', null)
      .order('created_at', { ascending: false })
      .limit(500); // Process in batches

    if (error) {
      console.error('❌ Error fetching auth_logs:', error);
      return;
    }

    if (!logs || logs.length === 0) {
      console.log('✅ No logs need geolocation backfill. All logs are up to date!');
      return;
    }

    console.log(`📊 Found ${logs.length} logs without geolocation data`);
    console.log(`⏱️  Estimated time: ${Math.ceil(logs.length / RATE_LIMIT)} minutes\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const progress = `[${i + 1}/${logs.length}]`;

      console.log(`${progress} Processing log ${log.id} (IP: ${log.ip_address})...`);

      const geoData = await getGeolocation(log.ip_address);

      if (!geoData) {
        console.log(`   ⏭️  Skipped (no data available)\n`);
        skipped++;
        continue;
      }

      // Update the log with geolocation data
      const { error: updateError } = await supabase
        .from('auth_logs')
        .update({
          geo_country: geoData.country,
          geo_country_code: geoData.country_code,
          geo_city: geoData.city,
          geo_latitude: geoData.latitude,
          geo_longitude: geoData.longitude,
          geo_timezone: geoData.timezone,
          geo_isp: geoData.isp,
          is_proxy: geoData.is_proxy,
          is_vpn: geoData.is_vpn,
          is_datacenter: geoData.is_datacenter,
          threat_score: geoData.threat_score,
          is_suspicious: geoData.threat_score >= 40
        })
        .eq('id', log.id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}\n`);
        failed++;
      } else {
        console.log(`   ✅ Updated: ${geoData.city}, ${geoData.country}\n`);
        updated++;
      }

      // Small delay between requests
      await sleep(100);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total Processed: ${logs.length}`);
    console.log('='.repeat(60));

    if (logs.length === 500) {
      console.log('\n⚠️  Note: Only processed 500 logs. Run script again to process more.');
    }

  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
  }
}

// Run the backfill
backfillGeolocation()
  .then(() => {
    console.log('\n✅ Backfill process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill process failed:', error);
    process.exit(1);
  });
