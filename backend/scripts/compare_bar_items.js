const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const requestedItems = [
  // Soda (8)
  { cat: 'Soda', name: 'SODA 300ML', price: 70 },
  { cat: 'Soda', name: 'COKE ZERO', price: 100 },
  { cat: 'Soda', name: 'SODA 500ML', price: 100 },
  { cat: 'Soda', name: 'TONIC SODA CAN', price: 150 },
  { cat: 'Soda', name: 'SODA 500ML TAKE AWAY', price: 100 },
  { cat: 'Soda', name: 'NOVIDA', price: 100 },
  { cat: 'Soda', name: 'SODA TAKEAWAY', price: 100 },
  { cat: 'Soda', name: 'ALVARO', price: 200 },

  // Energy Drinks (5)
  { cat: 'Energy Drinks', name: 'REDBULL', price: 300 },
  { cat: 'Energy Drinks', name: 'QUARANA', price: 250 },
  { cat: 'Energy Drinks', name: 'MONSTER', price: 350 },
  { cat: 'Energy Drinks', name: 'PREDATOR CAN', price: 100 },
  { cat: 'Energy Drinks', name: 'GUARANA', price: 250 },

  // Juice (6)
  { cat: 'Juice', name: 'MINUTE MAID', price: 120 },
  { cat: 'Juice', name: 'LIME LEMONADE', price: 100 },
  { cat: 'Juice', name: 'DELMONTE', price: 350 },
  { cat: 'Juice', name: 'PUNCH', price: 250 },
  { cat: 'Juice', name: 'FRESH COCKTAIL/MANGO', price: 150 },
  { cat: 'Juice', name: 'LEMON (B)', price: 20 },

  // Water (6)
  { cat: 'Water', name: 'DASANI 500ML', price: 50 },
  { cat: 'Water', name: 'DASANI 1L', price: 100 },
  { cat: 'Water', name: 'DASANI 500ML.', price: 50 },
  { cat: 'Water', name: 'KERINGET 500ML', price: 70 },
  { cat: 'Water', name: 'DASANI 1 LTR', price: 100 },
  { cat: 'Water', name: 'KERINGET 1 LTR', price: 150 },

  // Beer, Cider & RTD (30)
  { cat: 'Beer, Cider & RTD', name: 'TUSKER LAGER', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'GUINNESS', price: 280 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER LAGER CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'GUINNESS CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER LITE', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'MANYATTA', price: 280 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER LITE CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'MANYATTA CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER MALT', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'HEINEKEN', price: 350 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER MALT CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'FAXE', price: 350 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER CIDER', price: 280 },
  { cat: 'Beer, Cider & RTD', name: 'WINDHOEK', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'TUSKER CIDER CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'KINGFISHER', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'WHITE CAP LAGER', price: 270 },
  { cat: 'Beer, Cider & RTD', name: 'DESPARADO', price: 350 },
  { cat: 'Beer, Cider & RTD', name: 'WHITE CAP CRISP[', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'SAVANA CIDER', price: 350 },
  { cat: 'Beer, Cider & RTD', name: 'WHITE CAP CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'HUNTERS GOLD', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'PILSNER LAGER', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'SNAPP', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'PILSNER CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'SNAPP CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'BALOZI', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'BLACK ICE', price: 250 },
  { cat: 'Beer, Cider & RTD', name: 'BALOZI CAN', price: 300 },
  { cat: 'Beer, Cider & RTD', name: 'GORDONS CAN', price: 250 },

  // Whisky (45)
  { cat: 'Whisky', name: 'J.W RED 250ML', price: 800 },
  { cat: 'Whisky', name: 'BLACK & WHITE 1 LTR', price: 2200 },
  { cat: 'Whisky', name: 'J.W RED 375ML', price: 1700 },
  { cat: 'Whisky', name: 'WILLIAM LAWSONS 350ML', price: 1500 },
  { cat: 'Whisky', name: 'J.W RED 750ML', price: 2500 },
  { cat: 'Whisky', name: 'WILLIAM LAWSONS 750ML', price: 2200 },
  { cat: 'Whisky', name: 'J.W RED 1 LTR', price: 3000 },
  { cat: 'Whisky', name: 'WILLIAM LAWSONS 1LTR', price: 3000 },
  { cat: 'Whisky', name: 'J.W BLACK 250ML', price: 1300 },
  { cat: 'Whisky', name: 'GLENFIDICH 12YRS', price: 8500 },
  { cat: 'Whisky', name: 'J.W BLACK 375ML', price: 2200 },
  { cat: 'Whisky', name: 'GLENFIDICH 15YRS', price: 12000 },
  { cat: 'Whisky', name: 'J.W BLACK 750ML', price: 4500 },
  { cat: 'Whisky', name: 'GLENFIDICH 18YRS', price: 17500 },
  { cat: 'Whisky', name: 'J.W BLACK 1 LTR', price: 5500 },
  { cat: 'Whisky', name: 'SINGLETON 12YRS', price: 6500 },
  { cat: 'Whisky', name: 'DOUBLE BLACK 750ML', price: 5800 },
  { cat: 'Whisky', name: 'SINGLETON 15YRS', price: 7800 },
  { cat: 'Whisky', name: 'DOUBLE BLACK 1 LTR', price: 7000 },
  { cat: 'Whisky', name: 'HUNTERS 1/4', price: 500 },
  { cat: 'Whisky', name: 'GREEN LABEL', price: 12000 },
  { cat: 'Whisky', name: 'HUNTERS 1/2', price: 700 },
  { cat: 'Whisky', name: 'GOLD RESERVE', price: 9500 },
  { cat: 'Whisky', name: 'HUNTERS 750ML', price: 1300 },
  { cat: 'Whisky', name: 'GRANTS1/2', price: 1600 },
  { cat: 'Whisky', name: 'BEST WHISKY 1/4', price: 500 },
  { cat: 'Whisky', name: 'GRANTS 750ML', price: 2500 },
  { cat: 'Whisky', name: 'BEST WHISKY 750ML', price: 1400 },
  { cat: 'Whisky', name: 'GRANTS 1 LTR', price: 3200 },
  { cat: 'Whisky', name: 'BOND 7 1/4', price: 600 },
  { cat: 'Whisky', name: 'JAMESON 1/2', price: 1600 },
  { cat: 'Whisky', name: 'BOND 7 1/2', price: 800 },
  { cat: 'Whisky', name: 'JAMESON 750ML', price: 3500 },
  { cat: 'Whisky', name: 'BOND 7 750ML', price: 1800 },
  { cat: 'Whisky', name: 'JAMESON 1 LTR', price: 4500 },
  { cat: 'Whisky', name: 'VAT 69 1/2', price: 1000 },
  { cat: 'Whisky', name: 'JACK DANIELS 350ML', price: 2500 },
  { cat: 'Whisky', name: 'VAT 69 750ML', price: 2000 },
  { cat: 'Whisky', name: 'JACK DANIELS 750ML', price: 4500 },
  { cat: 'Whisky', name: 'FAMOUS GROUSE', price: 2500 },
  { cat: 'Whisky', name: 'JACK DANIELS 1 LTR', price: 6000 },
  { cat: 'Whisky', name: 'BALANTINES 750ML', price: 3000 },
  { cat: 'Whisky', name: 'BLACK & WHITE 350ML', price: 800 },
  { cat: 'Whisky', name: 'WHISKY GLASS', price: 200 },
  { cat: 'Whisky', name: 'BLACK & WHITE 750ML', price: 1500 },

  // Brandy & Cognac (11)
  { cat: 'Brandy & Cognac', name: 'VICEROY 1/4', price: 650 },
  { cat: 'Brandy & Cognac', name: 'RICHOT 750ML', price: 1800 },
  { cat: 'Brandy & Cognac', name: 'VICEROY 1/2', price: 900 },
  { cat: 'Brandy & Cognac', name: 'HENNESY 750ML', price: 7500 },
  { cat: 'Brandy & Cognac', name: 'VICEROY 750ML', price: 1800 },
  { cat: 'Brandy & Cognac', name: 'HENNESY 1 LTR', price: 13500 },
  { cat: 'Brandy & Cognac', name: 'VICEROY 10 YRS', price: 4500 },
  { cat: 'Brandy & Cognac', name: 'MARTEL VS 750ML', price: 8500 },
  { cat: 'Brandy & Cognac', name: 'RICHOT 1/4', price: 650 },
  { cat: 'Brandy & Cognac', name: 'MARTEL VSOP 750ML', price: 12500 },
  { cat: 'Brandy & Cognac', name: 'RICHORT 1/2', price: 850 },

  // Gin (8)
  { cat: 'Gin', name: 'GORDONS GIN 350ML', price: 1200 },
  { cat: 'Gin', name: 'TAQUREY LONDON DRY 1LTR', price: 6000 },
  { cat: 'Gin', name: 'GORDONS GIN 750ML', price: 2500 },
  { cat: 'Gin', name: 'GILBEYS 1/4', price: 650 },
  { cat: 'Gin', name: 'TANQUERAY NO 10', price: 6000 },
  { cat: 'Gin', name: 'GILBEYS 1/2', price: 850 },
  { cat: 'Gin', name: 'TAQUEREY LONDONDRY 750ML', price: 4500 },
  { cat: 'Gin', name: 'GILBEYS 750ML', price: 1800 },

  // Vodka, Rum & Other Spirits (9)
  { cat: 'Vodka, Rum & Other Spirits', name: 'VODKA 1/4', price: 650 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'KENYA CANE 1/4', price: 450 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'VODKA 1/2', price: 850 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'KENYA CANE 1/2', price: 700 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'VODKA 750ML', price: 1800 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'KENYA CANE 750ML', price: 1200 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'CAPTAIN MORGAN 1/4', price: 500 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'CAMINO TOT', price: 200 },
  { cat: 'Vodka, Rum & Other Spirits', name: 'CAPTAIN MORGAN 750ML', price: 1400 },

  // Liqueurs (11)
  { cat: 'Liqueurs', name: 'AMARULA 1/2', price: 1800 },
  { cat: 'Liqueurs', name: 'SHERIDANS 1 LTR', price: 7000 },
  { cat: 'Liqueurs', name: 'AMARULA 750ML', price: 3000 },
  { cat: 'Liqueurs', name: 'SOUTHERN COMFORT', price: 3200 },
  { cat: 'Liqueurs', name: 'AMARULA 1L', price: 5500 },
  { cat: 'Liqueurs', name: 'JAGERMEISTER TOT', price: 200 },
  { cat: 'Liqueurs', name: 'BAILEYS', price: 1800 },
  { cat: 'Liqueurs', name: 'JAGERMASTER', price: 6600 },
  { cat: 'Liqueurs', name: 'BAILEYS 1/2', price: 1800 },
  { cat: 'Liqueurs', name: 'JARGERMASTER 750 ML', price: 4500 },
  { cat: 'Liqueurs', name: 'BAILEYS 750ML', price: 3000 },

  // Wine (12)
  { cat: 'Wine', name: '4TH STREET', price: 1200 },
  { cat: 'Wine', name: 'CHAMDOR', price: 1400 },
  { cat: 'Wine', name: 'ALL SEASONS 750ML', price: 1400 },
  { cat: 'Wine', name: 'DROSDTY HOF', price: 1200 },
  { cat: 'Wine', name: 'ASCONI', price: 2000 },
  { cat: 'Wine', name: 'FOUR COUSINS', price: 1400 },
  { cat: 'Wine', name: 'CAPRICE', price: 1300 },
  { cat: 'Wine', name: 'NEDERBUG', price: 2800 },
  { cat: 'Wine', name: 'CASABUENA', price: 1200 },
  { cat: 'Wine', name: 'ROBERTSON', price: 1800 },
  { cat: 'Wine', name: 'CELLAR CASK', price: 1200 },
  { cat: 'Wine', name: 'WINE GLASS', price: 200 }
];

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runComparison() {
  console.log('Fetching all simple_items (Master Inventory)...');
  const { data: simpleItems, error: siErr } = await supabase
    .from('simple_items')
    .select('id, sku, item_name, category, retail_price, cost_price, is_active');

  if (siErr) {
    console.error('Error fetching simple_items:', siErr);
    return;
  }
  console.log(`Loaded ${simpleItems.length} items from simple_items.`);

  console.log('\nChecking Kaplong Main Bar POS outlet items...');
  const { data: kaplongBarItems, error: kbErr } = await supabase
    .from('pos_outlet_items')
    .select('id, name, sku, category, price, selling_price, track_stock, is_active')
    .eq('outlet_id', '7a69ab32-6594-47d6-ad92-b576301ec201');
  console.log(`Current items in Kaplong Main Bar POS outlet: ${kaplongBarItems ? kaplongBarItems.length : 0}`);

  console.log('\nChecking Kaplong branch_stock items...');
  const { data: kaplongStock, error: ksErr } = await supabase
    .from('branch_stock')
    .select('id, item_name, current_stock, branch_id')
    .eq('branch_id', 3);
  console.log(`Current items in Kaplong branch_stock: ${kaplongStock ? kaplongStock.length : 0}`);

  // Matching logic
  let exactMatchCount = 0;
  let partialMatchCount = 0;
  let noMatchCount = 0;

  const matches = [];

  for (const req of requestedItems) {
    const reqNorm = normalize(req.name);

    // 1. Exact normalized match
    let found = simpleItems.find(si => normalize(si.item_name) === reqNorm);
    let matchType = 'EXACT';

    if (!found) {
      // 2. Partial/fuzzy match
      const reqWords = reqNorm.split(' ').filter(w => w.length > 1);
      const candidates = simpleItems.filter(si => {
        const siNorm = normalize(si.item_name);
        return reqWords.every(w => siNorm.includes(w));
      });

      if (candidates.length > 0) {
        found = candidates[0];
        matchType = `FUZZY (${candidates.length} match${candidates.length > 1 ? 'es' : ''})`;
      } else {
        // Try looser match
        const loose = simpleItems.filter(si => {
          const siNorm = normalize(si.item_name);
          const matchCount = reqWords.filter(w => siNorm.includes(w)).length;
          return reqWords.length >= 2 ? matchCount >= reqWords.length - 1 : false;
        });
        if (loose.length > 0) {
          found = loose[0];
          matchType = `PARTIAL (${loose.map(l => l.item_name).join(', ')})`;
        } else {
          found = null;
          matchType = 'NO_MATCH';
        }
      }
    }

    if (matchType === 'EXACT') exactMatchCount++;
    else if (matchType === 'NO_MATCH') noMatchCount++;
    else partialMatchCount++;

    matches.push({
      category: req.cat,
      requestedName: req.name,
      requestedPrice: req.price,
      matchType,
      matchedItem: found ? {
        id: found.id,
        sku: found.sku,
        item_name: found.item_name,
        category: found.category,
        retail_price: found.retail_price,
        cost_price: found.cost_price
      } : null
    });
  }

  console.log(`\n=== SUMMARY OF MATCHES (Total Requested: ${requestedItems.length}) ===`);
  console.log(`Exact Matches: ${exactMatchCount}`);
  console.log(`Fuzzy / Partial Matches: ${partialMatchCount}`);
  console.log(`No Match in Master Inventory: ${noMatchCount}`);

  const byCategory = {};
  for (const m of matches) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }

  const summary = {
    totalRequested: requestedItems.length,
    exactMatchCount,
    partialMatchCount,
    noMatchCount,
    byCategory: {}
  };

  for (const [cat, list] of Object.entries(byCategory)) {
    summary.byCategory[cat] = {
      total: list.length,
      exact: list.filter(i => i.matchType === 'EXACT').length,
      partialOrFuzzy: list.filter(i => i.matchType.startsWith('FUZZY') || i.matchType.startsWith('PARTIAL')).length,
      missing: list.filter(i => i.matchType === 'NO_MATCH').length,
      items: list
    };
  }

  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'bar_comparison_result.json'), JSON.stringify(summary, null, 2));
  console.log(`\nWrote full comparison report to ${path.join(__dirname, 'bar_comparison_result.json')}`);
  console.log(`TOTALS: Requested=${requestedItems.length}, Exact=${exactMatchCount}, Partial/Fuzzy=${partialMatchCount}, Missing=${noMatchCount}`);
}

runComparison().catch(console.error);
