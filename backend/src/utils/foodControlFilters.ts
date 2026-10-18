export interface FoodControlItemCheck {
    sku?: string | null;
    name?: string | null;
    item_name?: string | null;
    produced_item_name?: string | null;
    raw_item_name?: string | null;
    category?: string | null;
    store_type?: string | null;
    item_group?: string | null;
    source_table?: string | null;
    outlet_name?: string | null;
    outlet_type?: string | null;
}

/**
 * Returns true if an item belongs to bar, beverage, drink, tobacco, or non-food category.
 * Daily Controls and Food Control Standards must strictly exclude these items.
 */
export function isBarOrDrinkOrNonFoodItem(item: FoodControlItemCheck | null | undefined): boolean {
    if (!item) return false;

    // 1. Outlet Check
    const normOutlet = String(item.outlet_type || item.outlet_name || '').toLowerCase().trim();
    if (
        normOutlet.includes('bar') ||
        normOutlet.includes('cellar') ||
        normOutlet.includes('pub') ||
        normOutlet.includes('lounge') ||
        normOutlet.includes('beverage')
    ) {
        return true;
    }

    // 2. Source table & item group & store type
    if (String(item.item_group || '').toLowerCase().trim() === 'bar') return true;
    const sourceTable = String(item.source_table || '').toLowerCase().trim();
    if (sourceTable === 'bar_drinks' || sourceTable === 'bar_stock') return true;

    const storeType = String(item.store_type || '').toLowerCase().trim();
    if (storeType.includes('bar')) return true;

    // 3. Category Check
    const category = String(item.category || '').toLowerCase().trim();
    const BAR_CATEGORIES = [
        'beer', 'wine', 'spirit', 'liquor', 'liqueur', 'whisky', 'whiskey',
        'brandy', 'vodka', 'gin', 'rum', 'tequila', 'cider', 'alcohol',
        'soft drink', 'soft_drink', 'soft-drink', 'soda', 'water', 'mineral water',
        'beverage', 'drink', 'tobacco', 'cigarette', 'cigar', 'token'
    ];
    if (BAR_CATEGORIES.some(cat => category.includes(cat))) {
        return true;
    }

    // 4. SKU Prefix Check
    const sku = String(item.sku || '').toUpperCase().trim();
    const BAR_SKU_PREFIXES = [
        'FGB-', 'FGH-BEER', 'FGH-WINE', 'FGH-SPIRIT', 'FGH-SOFT-DRINK',
        'FGH-CBV', 'FGH-LIQ', 'FGH-CIG', 'FGH-TOB', 'MOG-BAR', 'BAR-'
    ];
    if (BAR_SKU_PREFIXES.some(prefix => sku.startsWith(prefix))) {
        return true;
    }
    if (sku.includes('WATER-PKG') || sku === 'RAW-WATER-PKG') {
        return true;
    }

    // 5. Name / Description Check
    const name = String(
        item.name ||
        item.item_name ||
        item.produced_item_name ||
        item.raw_item_name ||
        ''
    ).toLowerCase().trim();

    if (!name) return false;

    // Non-consumables / tokens
    const nonConsumables = [
        'pool token', 'token', 'pool', 'trust classic', 'trust', 'condom', 't-shirt',
        'merchandise', 'cap', 'hat', 'towel', 'ticket', 'corkage', 'service charge',
        'damage fee', 'penalty', 'entry fee', 'parking', 'car wash', 'engine wash',
        'playground', 'swimming', 'dog food', 'takeaway tin', 'take away tin', 'tin',
        'packaging', 'wash'
    ];
    if (nonConsumables.some(nc => name.includes(nc))) {
        return true;
    }

    // Tobacco
    const tobacco = ['cigarette', 'cigarettes', 'cigar', 'dunhill', 'sportsman', 'embassy', 'rooster', 'tobacco'];
    if (tobacco.some(t => name.includes(t))) {
        return true;
    }

    // Bar and drink keywords
    const barKeywords = [
        'white cap', 'tusker', 'guinness', 'guiness', 'guarana', 'manyatta', 'savanna', 'faxe',
        'viceroy', 'richot', 'vodka', 'captain morgan', 'black & white', 'kc ', 'kc 750', 'kc 350',
        'kenya cane', 'gilbeys', 'gordons', 'bond 7', 'chrome', 'tripple ace', 'konyagi',
        'jameson', 'jack daniel', 'red label', 'black label', 'johnnie walker', 'jw black', 'jw red',
        'chivas', 'hennessy', 'martell', 'tequila', 'bacardi', 'campari', 'jagermeister', 'baileys',
        'amarula', 'heineken', 'snapp', 'smirnoff', 'pilsner', 'bavaria', 'cider', 'lager',
        'alvaro', 'balozi', 'desperado', 'black ice', 'asconi', 'casabuena', 'camino',
        'drostdy', 'caprice', 'cellar cask', 'four cousins', 'robertson',
        'soda', 'coca cola', 'coca-cola', 'coke', 'fanta', 'sprite', 'stoney', 'krest', 'schweppes',
        'tonic', 'water 1l', 'water 500ml', 'water 1ltr', 'water 5ooml', 'mineral water', 'still water', 'sparkling water',
        'keringet', 'dasani', 'aquamist', 'delmonte', 'minute maid', 'lemonade', 'red bull', 'redbull',
        'energy drink', 'cocktail juice', 'milkshake', 'dawa', 'concoction', 'whisky', 'whiskey',
        'brandy', 'cognac', 'liqueur', 'liquor', 'wine', 'beer', 'tot', 'shot', 'shooter',
        '750ml', '350ml', '250ml', '500ml'
    ];
    if (barKeywords.some(bk => {
        if (bk.length <= 4) {
            const regex = new RegExp(`\\b${bk}\\b`, 'i');
            return regex.test(name);
        }
        return name.includes(bk);
    })) {
        return true;
    }

    return false;
}
