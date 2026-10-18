const fs = require('fs');

const kaplongPos = JSON.parse(fs.readFileSync('scripts/kaplong_only_pos_items.json'));
const kaplongBarDrinks = JSON.parse(fs.readFileSync('scripts/kaplong_only_bar_drinks.json'));

// All items in Kaplong catalog
const kaplongCatalog = [];

kaplongPos.forEach(p => {
  kaplongCatalog.push({
    source: p.outlet_id === '7a69ab32-6594-47d6-ad92-b576301ec201' ? 'Kaplong Main Bar POS' : 'Kaplong Restaurant POS',
    name: p.name,
    price: p.selling_price,
    category: p.category
  });
});

kaplongBarDrinks.forEach(b => {
  kaplongCatalog.push({
    source: 'Kaplong bar_drinks (Branch 3)',
    name: b.name,
    price: b.selling_price || b.price,
    category: b.category
  });
});

console.log('Total Kaplong items pool:', kaplongCatalog.length);

const USER_LIST = [
  // Soft Drinks & Water
  { cat: 'Soft Drinks & Water', name: 'Soda 300ML' },
  { cat: 'Soft Drinks & Water', name: 'Soda 500ML' },
  { cat: 'Soft Drinks & Water', name: 'Soda 500ML (Takeaway)' },
  { cat: 'Soft Drinks & Water', name: 'Predator Can' },
  { cat: 'Soft Drinks & Water', name: 'Cokezero' },
  { cat: 'Soft Drinks & Water', name: 'Novida' },
  { cat: 'Soft Drinks & Water', name: 'Dasani 500ML' },
  { cat: 'Soft Drinks & Water', name: 'Dasani 1 LTR' },
  { cat: 'Soft Drinks & Water', name: 'Keringet Water 500ML' },
  { cat: 'Soft Drinks & Water', name: 'Keringet Water 1 LTR' },
  { cat: 'Soft Drinks & Water', name: 'Minutemaid' },
  { cat: 'Soft Drinks & Water', name: 'Monstar' },
  { cat: 'Soft Drinks & Water', name: 'Toniccan Soda' },
  { cat: 'Soft Drinks & Water', name: 'Lime Lemonade' },

  // BEER (BOTTLED)
  { cat: 'BEER (BOTTLED)', name: 'Tuskercider' },
  { cat: 'BEER (BOTTLED)', name: 'Guinness' },
  { cat: 'BEER (BOTTLED)', name: 'Manyatta' },
  { cat: 'BEER (BOTTLED)', name: 'Snapp' },
  { cat: 'BEER (BOTTLED)', name: 'Tusker Lager' },
  { cat: 'BEER (BOTTLED)', name: 'Tuskerlite' },
  { cat: 'BEER (BOTTLED)', name: 'Tuskermalt' },
  { cat: 'BEER (BOTTLED)', name: 'Plisner Mfalme' },
  { cat: 'BEER (BOTTLED)', name: 'Plisner Lager' },
  { cat: 'BEER (BOTTLED)', name: 'W.Cap Lager' },
  { cat: 'BEER (BOTTLED)', name: 'W.Cap Crisp' },
  { cat: 'BEER (BOTTLED)', name: 'B.Ice' },
  { cat: 'BEER (BOTTLED)', name: 'Balozi' },
  { cat: 'BEER (BOTTLED)', name: 'S.Punch' },

  // CANNED BEER
  { cat: 'CANNED BEER', name: 'Guarana' },
  { cat: 'CANNED BEER', name: 'Guinness' },
  { cat: 'CANNED BEER', name: 'Tuskercider' },
  { cat: 'CANNED BEER', name: 'Tusker Lager' },
  { cat: 'CANNED BEER', name: 'White Cap' },
  { cat: 'CANNED BEER', name: 'Tuskermalt' },
  { cat: 'CANNED BEER', name: 'Tuskerlite' },
  { cat: 'CANNED BEER', name: 'Plisner' },
  { cat: 'CANNED BEER', name: 'Balozi' },
  { cat: 'CANNED BEER', name: 'Snapp' },
  { cat: 'CANNED BEER', name: 'Gordons Can' },
  { cat: 'CANNED BEER', name: 'Manyatta Can' },

  // MIXTURES
  { cat: 'MIXTURES', name: 'Faxe' },
  { cat: 'MIXTURES', name: 'Heineken' },
  { cat: 'MIXTURES', name: 'Corona Extra' },
  { cat: 'MIXTURES', name: 'Savanna Cider' },
  { cat: 'MIXTURES', name: 'Delmonte' },
  { cat: 'MIXTURES', name: 'Desperado' },
  { cat: 'MIXTURES', name: 'Kingfisher' },
  { cat: 'MIXTURES', name: 'Windhoek' },
  { cat: 'MIXTURES', name: 'Hunters Gold' },
  { cat: 'MIXTURES', name: 'Redbull' },
  { cat: 'MIXTURES', name: 'Alvaro' },

  // GIN
  { cat: 'GIN', name: 'Gilbeys Gin 250ML' },
  { cat: 'GIN', name: 'Gilbeys Gin 350ML' },
  { cat: 'GIN', name: 'Gilbeys Gin 750ML' },
  { cat: 'GIN', name: "Gordon's Dry Gin 350ML" },
  { cat: 'GIN', name: "Gordon's Dry Gin 750ML" },

  // BRANDY
  { cat: 'BRANDY', name: 'Nudeburg 750ML' },
  { cat: 'BRANDY', name: 'Viceroy 250ML' },
  { cat: 'BRANDY', name: 'Viceroy 350ML' },
  { cat: 'BRANDY', name: 'Viceroy 750ML' },
  { cat: 'BRANDY', name: 'Viceroy 10 YRS' },
  { cat: 'BRANDY', name: 'Richot 250ML' },
  { cat: 'BRANDY', name: 'Richot 350ML' },
  { cat: 'BRANDY', name: 'Richot 750ML' },

  // VODKA
  { cat: 'VODKA', name: 'Vodka 250ML' },
  { cat: 'VODKA', name: 'Vodka 350ML' },
  { cat: 'VODKA', name: 'Vodka 750ML' },

  // SPIRITS
  { cat: 'SPIRITS', name: 'K.C 250ML' },
  { cat: 'SPIRITS', name: 'K.C 350ML' },
  { cat: 'SPIRITS', name: 'K.C 750ML' },
  { cat: 'SPIRITS', name: 'Southern Comfort' },

  // WHISKY
  { cat: 'WHISKY', name: 'Jameson 350ML' },
  { cat: 'WHISKY', name: 'Jameson 750ML' },
  { cat: 'WHISKY', name: 'Jameson 1 LTR' },
  { cat: 'WHISKY', name: 'Jameson Black Barrel 750ML' },
  { cat: 'WHISKY', name: 'Vat 69 350ML' },
  { cat: 'WHISKY', name: 'Vat 69 750ML' },
  { cat: 'WHISKY', name: 'J.Walker Red 250ML' },
  { cat: 'WHISKY', name: 'J.Walker Red 375ML' },
  { cat: 'WHISKY', name: 'J.Walker Red 750ML' },
  { cat: 'WHISKY', name: 'J.Walker Red 1 LTR' },
  { cat: 'WHISKY', name: 'J.Walker Black 250ML' },
  { cat: 'WHISKY', name: 'J.Walker Black 350ML' },
  { cat: 'WHISKY', name: 'J.Walker Black 750ML' },
  { cat: 'WHISKY', name: 'J.Walker Black 1 LTR' },
  { cat: 'WHISKY', name: 'J.Walker Blonde 750ML' },
  { cat: 'WHISKY', name: 'Green Label 750ML' },
  { cat: 'WHISKY', name: 'Gold Label' },
  { cat: 'WHISKY', name: 'Bond 7 250ML' },
  { cat: 'WHISKY', name: 'Bond 7 350ML' },
  { cat: 'WHISKY', name: 'Bond 7 750ML' },
  { cat: 'WHISKY', name: 'Famous Grouse 750ML' },
  { cat: 'WHISKY', name: 'Glenfiddich 12 YRS' },
  { cat: 'WHISKY', name: 'Glenfiddich 15 YRS' },
  { cat: 'WHISKY', name: 'Glenfiddich 18 YRS' },
  { cat: 'WHISKY', name: 'Martel VS 750ML' },
  { cat: 'WHISKY', name: 'Martel VSOP 750ML' },
  { cat: 'WHISKY', name: 'Hennessy 750ML' },
  { cat: 'WHISKY', name: 'Hennessy 1 LTR' },
  { cat: 'WHISKY', name: 'Hennessy VSOP' },
  { cat: 'WHISKY', name: "Jack Daniel's 350ML" },
  { cat: 'WHISKY', name: "Jack Daniel's 750ML" },
  { cat: 'WHISKY', name: "Jack Daniel's 1 LTR" },
  { cat: 'WHISKY', name: 'Double Black 750ML' },
  { cat: 'WHISKY', name: 'Double Black 1 LTR' },
  { cat: 'WHISKY', name: "Sheridan's 1 LTR" },
  { cat: 'WHISKY', name: "Ballantine's 750ML" },
  { cat: 'WHISKY', name: 'All Seasons 750ML' },
  { cat: 'WHISKY', name: 'William Lawson 350ML' },
  { cat: 'WHISKY', name: 'William Lawson 750ML' },
  { cat: 'WHISKY', name: 'William Lawson 1 LTR' },
  { cat: 'WHISKY', name: 'Grants 350ML' },
  { cat: 'WHISKY', name: 'Grants 750ML' },
  { cat: 'WHISKY', name: 'Grants 1 LTR' },
  { cat: 'WHISKY', name: 'Black & White 350ML' },
  { cat: 'WHISKY', name: 'Black & White 750ML' },
  { cat: 'WHISKY', name: 'Black & White 1 LTR' },
  { cat: 'WHISKY', name: 'Hunters 250ML' },
  { cat: 'WHISKY', name: 'Hunters 350ML' },
  { cat: 'WHISKY', name: 'Hunters 750ML' },
  { cat: 'WHISKY', name: 'Best Whisky 250ML' },
  { cat: 'WHISKY', name: 'Best Whisky 750ML' },

  // CREAM
  { cat: 'CREAM', name: 'Best Cream 750ML' },
  { cat: 'CREAM', name: 'Amarula 350ML' },
  { cat: 'CREAM', name: 'Amarula 750ML' },
  { cat: 'CREAM', name: 'Amarula 1 LTR' },
  { cat: 'CREAM', name: "Bailey's 350ML" },
  { cat: 'CREAM', name: "Bailey's 750ML" },
  { cat: 'CREAM', name: 'V&A 750ML' },

  // WINE
  { cat: 'WINE', name: '4th Street' },
  { cat: 'WINE', name: 'Cellar Cask' },
  { cat: 'WINE', name: 'Drostdy Off' },
  { cat: 'WINE', name: 'Chamdor 750ML' },
  { cat: 'WINE', name: 'Caprice Pkt' },
  { cat: 'WINE', name: 'Casabuena' },
  { cat: 'WINE', name: 'Four Cousins' },
  { cat: 'WINE', name: 'Asconi' },
  { cat: 'WINE', name: 'Robertson' },

  // RUM
  { cat: 'RUM', name: 'Capt Morgan 250ML' },
  { cat: 'RUM', name: 'Capt Morgan 750ML' },
  { cat: 'RUM', name: 'Jagertot' },
  { cat: 'RUM', name: 'Camino Tot' },
  { cat: 'RUM', name: 'Jagermasta (1st line)' },
  { cat: 'RUM', name: 'Camino (1st line)' },
  { cat: 'RUM', name: 'Jagermasta (2nd line)' },
  { cat: 'RUM', name: 'Camino (2nd line)' },

  // OTHER
  { cat: 'OTHER', name: 'Tokens' },
  { cat: 'OTHER', name: 'Trust Studded' },
  { cat: 'OTHER', name: 'J&B 750ML' },
  { cat: 'OTHER', name: 'Singleton 15 YRS' },
  { cat: 'OTHER', name: 'Singleton 12 YRS' },
  { cat: 'OTHER', name: 'Tang 10' },
  { cat: 'OTHER', name: 'Tang London' },
];

// Custom manual map strictly to Kaplong items:
const STRICT_KAPLONG_MAP = {
  'Soda 300ML': 'SODA 300ML',
  'Soda 500ML': 'SODA 500ML',
  'Soda 500ML (Takeaway)': 'SODA 500ML TAKE AWAY',
  'Predator Can': 'PREDATOR CAN',
  'Cokezero': 'COKE ZERO',
  'Novida': 'NOVIDA',
  'Dasani 500ML': 'DASANI 500ML',
  'Dasani 1 LTR': 'DASANI 1 LTR',
  'Keringet Water 500ML': 'KERINGET 500ML',
  'Keringet Water 1 LTR': 'KERINGET 1 LTR',
  'Minutemaid': 'MINUTE MAID',
  'Monstar': 'MONSTER',
  'Toniccan Soda': 'TONIC SODA CAN',
  'Lime Lemonade': 'LIME LEMONADE',

  'Tuskercider': 'TUSKER CIDER',
  'Guinness': 'GUINNESS',
  'Manyatta': 'MANYATTA',
  'Snapp': 'SNAPP',
  'Tusker Lager': 'TUSKER LAGER',
  'Tuskerlite': 'TUSKER LITE',
  'Tuskermalt': 'TUSKER MALT',
  'Plisner Mfalme': null, // Need confirmation from user (or PILSNER LAGER)
  'Plisner Lager': 'PILSNER LAGER',
  'W.Cap Lager': 'WHITE CAP LAGER',
  'W.Cap Crisp': 'WHITE CAP CRISP[',
  'B.Ice': 'BLACK ICE',
  'Balozi': 'BALOZI',
  'S.Punch': 'PUNCH', // In Kaplong POS: PUNCH KES 250

  'Guarana': 'GUARANA',
  'Guinness (Can)': 'GUINNESS CAN',
  'Tuskercider (Can)': 'TUSKER CIDER CAN',
  'Tusker Lager (Can)': 'TUSKER LAGER CAN',
  'White Cap (Can)': 'WHITE CAP CAN',
  'Tuskermalt (Can)': 'TUSKER MALT CAN',
  'Tuskerlite (Can)': 'TUSKER LITE CAN',
  'Plisner (Can)': 'PILSNER CAN',
  'Balozi (Can)': 'BALOZI CAN',
  'Snapp (Can)': 'SNAPP CAN',
  'Gordons Can': 'GORDONS CAN',
  'Manyatta Can': 'MANYATTA CAN',

  'Faxe': 'FAXE',
  'Heineken': 'HEINEKEN',
  'Corona Extra': null, // Not in Kaplong menu
  'Savanna Cider': 'SAVANA CIDER',
  'Delmonte': 'DELMONTE',
  'Desperado': 'DESPARADO',
  'Kingfisher': 'KINGFISHER',
  'Windhoek': 'WINDHOEK',
  'Hunters Gold': 'HUNTERS GOLD',
  'Redbull': 'REDBULL',
  'Alvaro': 'ALVARO',

  'Gilbeys Gin 250ML': 'GILBEYS 1/4',
  'Gilbeys Gin 350ML': 'GILBEYS 1/2',
  'Gilbeys Gin 750ML': 'GILBEYS 750ML',
  "Gordon's Dry Gin 350ML": 'GORDONS GIN 350ML',
  "Gordon's Dry Gin 750ML": 'GORDONS GIN 750ML',

  'Nudeburg 750ML': 'NEDERBUG', // In Kaplong POS: NEDERBUG KES 2800
  'Viceroy 250ML': 'VICEROY 1/4',
  'Viceroy 350ML': 'VICEROY 1/2',
  'Viceroy 750ML': 'VICEROY 750ML',
  'Viceroy 10 YRS': 'VICEROY 10 YRS',
  'Richot 250ML': 'RICHOT 1/4',
  'Richot 350ML': 'RICHORT 1/2', // In Kaplong POS: RICHORT 1/2 KES 850
  'Richot 750ML': 'RICHOT 750ML',

  'Vodka 250ML': 'VODKA 1/4',
  'Vodka 350ML': 'VODKA 1/2',
  'Vodka 750ML': 'VODKA 750ML',

  'K.C 250ML': 'KENYA CANE 1/4',
  'K.C 350ML': 'KENYA CANE 1/2',
  'K.C 750ML': 'KENYA CANE 750ML',
  'Southern Comfort': 'SOUTHERN COMFORT',

  'Jameson 350ML': 'JAMESON 1/2',
  'Jameson 750ML': 'JAMESON 750ML',
  'Jameson 1 LTR': 'JAMESON 1 LTR',
  'Jameson Black Barrel 750ML': null, // Not in Kaplong POS
  'Vat 69 350ML': 'VAT 69 1/2',
  'Vat 69 750ML': 'VAT 69 750ML',
  'J.Walker Red 250ML': 'J.W RED 250ML',
  'J.Walker Red 375ML': 'J.W RED 375ML',
  'J.Walker Red 750ML': 'J.W RED 750ML',
  'J.Walker Red 1 LTR': 'J.W RED 1 LTR',
  'J.Walker Black 250ML': 'J.W BLACK 250ML',
  'J.Walker Black 350ML': 'J.W BLACK 375ML', // In Kaplong POS: J.W BLACK 375ML KES 2200
  'J.Walker Black 750ML': 'J.W BLACK 750ML',
  'J.Walker Black 1 LTR': 'J.W BLACK 1 LTR',
  'J.Walker Blonde 750ML': null, // Not in Kaplong POS
  'Green Label 750ML': 'GREEN LABEL',
  'Gold Label': 'GOLD RESERVE',
  'Bond 7 250ML': 'BOND 7 1/4',
  'Bond 7 350ML': 'BOND 7 1/2',
  'Bond 7 750ML': 'BOND 7 750ML',
  'Famous Grouse 750ML': 'FAMOUS GROUSE',
  'Glenfiddich 12 YRS': 'GLENFIDICH 12YRS',
  'Glenfiddich 15 YRS': 'GLENFIDICH 15YRS',
  'Glenfiddich 18 YRS': 'GLENFIDICH 18YRS',
  'Martel VS 750ML': 'MARTEL VS 750ML',
  'Martel VSOP 750ML': 'MARTEL VSOP 750ML',
  'Hennessy 750ML': 'HENNESY 750ML',
  'Hennessy 1 LTR': 'HENNESY 1 LTR',
  'Hennessy VSOP': null, // Not in Kaplong POS
  "Jack Daniel's 350ML": 'JACK DANIELS 350ML',
  "Jack Daniel's 750ML": 'JACK DANIELS 750ML',
  "Jack Daniel's 1 LTR": 'JACK DANIELS 1 LTR',
  'Double Black 750ML': 'DOUBLE BLACK 750ML',
  'Double Black 1 LTR': 'DOUBLE BLACK 1 LTR',
  "Sheridan's 1 LTR": 'SHERIDANS 1 LTR',
  "Ballantine's 750ML": 'BALANTINES 750ML',
  'All Seasons 750ML': 'ALL SEASONS 750ML',
  'William Lawson 350ML': 'WILLIAM LAWSONS 350ML',
  'William Lawson 750ML': 'WILLIAM LAWSONS 750ML',
  'William Lawson 1 LTR': 'WILLIAM LAWSONS 1LTR',
  'Grants 350ML': 'GRANTS1/2',
  'Grants 750ML': 'GRANTS 750ML',
  'Grants 1 LTR': 'GRANTS 1 LTR',
  'Black & White 350ML': 'BLACK & WHITE 350ML',
  'Black & White 750ML': 'BLACK & WHITE 750ML',
  'Black & White 1 LTR': 'BLACK & WHITE 1 LTR',
  'Hunters 250ML': 'HUNTERS 1/4',
  'Hunters 350ML': 'HUNTERS 1/2',
  'Hunters 750ML': 'HUNTERS 750ML',
  'Best Whisky 250ML': 'BEST WHISKY 1/4',
  'Best Whisky 750ML': 'BEST WHISKY 750ML',

  'Best Cream 750ML': null, // Not in Kaplong POS
  'Amarula 350ML': 'AMARULA 1/2',
  'Amarula 750ML': 'AMARULA 750ML',
  'Amarula 1 LTR': 'AMARULA 1L',
  "Bailey's 350ML": 'BAILEYS 1/2', // In Kaplong POS: BAILEYS 1/2 KES 1800
  "Bailey's 750ML": 'BAILEYS 750ML',
  'V&A 750ML': null, // Not in Kaplong POS

  '4th Street': '4TH STREET',
  'Cellar Cask': 'CELLAR CASK',
  'Drostdy Off': 'DROSDTY HOF', // In Kaplong POS: DROSDTY HOF KES 1200
  'Chamdor 750ML': 'CHAMDOR',
  'Caprice Pkt': 'CAPRICE',
  'Casabuena': 'CASABUENA',
  'Four Cousins': 'FOUR COUSINS',
  'Asconi': 'ASCONI',
  'Robertson': 'ROBERTSON',

  'Capt Morgan 250ML': 'CAPTAIN MORGAN 1/4',
  'Capt Morgan 750ML': 'CAPTAIN MORGAN 750ML',
  'Jagertot': 'JAGERMEISTER TOT',
  'Camino Tot': 'CAMINO TOT',
  'Jagermasta (1st line)': 'JAGERMASTER', // KES 6600 (or JARGERMASTER 750 ML: KES 4500)
  'Camino (1st line)': null, // In Kaplong POS: only CAMINO TOT exists
  'Jagermasta (2nd line)': 'JAGERMASTER',
  'Camino (2nd line)': null,

  'Tokens': 'POOL TOKEN',
  'Trust Studded': null, // Not in Kaplong POS
  'J&B 750ML': null, // Not in Kaplong POS
  'Singleton 15 YRS': 'SINGLETON 15YRS',
  'Singleton 12 YRS': 'SINGLETON 12YRS',
  'Tang 10': 'TANQUERAY NO 10',
  'Tang London': 'TAQUEREY LONDONDRY 750ML' // In Kaplong POS: TAQUEREY LONDONDRY 750ML KES 4500
};

// Check matches
const output = [];
for (const item of USER_LIST) {
  let lookupKey = item.name;
  if (item.cat === 'CANNED BEER' && !lookupKey.includes('(Can)') && lookupKey !== 'Guarana' && lookupKey !== 'Gordons Can' && lookupKey !== 'Manyatta Can') {
    lookupKey = lookupKey + ' (Can)';
  }
  const targetName = STRICT_KAPLONG_MAP[lookupKey] !== undefined ? STRICT_KAPLONG_MAP[lookupKey] : STRICT_KAPLONG_MAP[item.name];

  let match = null;
  if (targetName) {
    match = kaplongCatalog.find(k => k.name.toUpperCase().trim() === targetName.toUpperCase().trim());
  }

  output.push({
    category: item.cat,
    userItem: item.name,
    targetName: targetName,
    kaplongName: match ? match.name : null,
    kaplongPrice: match ? match.price : null,
    source: match ? match.source : null
  });
}

fs.writeFileSync('scripts/kaplong_strict_matched.json', JSON.stringify(output, null, 2));

console.log('--- STRICT MATCH REPORT ---');
let found = 0;
let missing = 0;
output.forEach(o => {
  if (o.kaplongPrice !== null) {
    found++;
  } else {
    missing++;
    console.log('NOT FOUND IN KAPLONG:', o.category, '->', o.userItem);
  }
});
console.log('Found in Kaplong:', found, '| Missing in Kaplong:', missing);
