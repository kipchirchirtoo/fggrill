# Master Inventory Catalog + POS Outlet Report

> Generated: 22/07/2026, 11:01:21 EAT  
> Filter: Active items only

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  CENTRAL MASTER CATALOG  (simple_items)                         │
│  Real stock — DRY GOODS, BEERS, WINES, WHISKY, SPIRITS, etc.   │
│  Quantity is tracked; cost price matters for F&B costing        │
└────────────────────┬────────────────────────────────────────────┘
                     │ linked_inventory_sku / inventory_item_id
          ┌──────────┴──────────┐
          ▼                     ▼
  ┌───────────────┐   ┌──────────────────────┐
  │  bar_drinks   │   │ restaurant_menu_items │
  │  (399 items)  │   │   (482 items)         │
  │  BAR POS      │   │   KITCHEN POS         │
  │  Bottle/can   │   │   Composed dishes     │
  │  sold at bar  │   │   made from ingredients│
  └───────────────┘   └──────────────────────┘
        ▲                       ▲
        │                       │
   Stock depletes          No direct stock link
   from simple_items       (uses ingredients field)
```

**Key rule:** `bar_drinks` are physical bottles — each sale depletes a matching
`simple_items` stock entry. `restaurant_menu_items` are composed dishes; the kitchen
uses raw ingredients from DRY GOODS / central catalog, not a 1:1 stock item.

## Summary

| Metric | Value |
|--------|-------|
| **Central stock items** (simple_items, real inventory) | **587** |
| POS-only items misplaced in simple_items | 181 |
| Bar POS items (bar_drinks) | 399 |
| &nbsp;&nbsp;└ linked to central stock | 0 |
| &nbsp;&nbsp;└ NOT linked to any stock SKU | **399** |
| Kitchen POS items (restaurant_menu_items) | 482 |
| &nbsp;&nbsp;└ These are composed dishes — NOT stock items | — |
| Stock value (cost × qty) | **KES 278,874,860.12** |
| Name duplicates in stock catalog | **16** groups |
| Category name case mismatches | **1** groups |

## POS Outlets — What They Are

### 1. Kitchen POS → `restaurant_menu_items` (482 items)

These are **dishes the kitchen sells** at the POS terminal. They are NOT inventory stock.
Each item may have an `ingredients` array listing raw ingredients from DRY GOODS.
Examples: Chips, Chapati, Chicken Wet Fry, Pilau, Ugali, etc.

**These should NOT appear in `simple_items`** — the KITCHEN MENU / PASTRY / food / FOOD
categories in simple_items (181 items below) are stale/duplicate entries.

### 2. Bar POS → `bar_drinks` (399 items)

These are **bottles and cans** sold at the bar POS. Each one should be linked to a
`simple_items` stock entry via `linked_inventory_sku`. When a bartender sells a
JW Red 750ml, it decrements the matching stock entry.

- **0** bar drinks are correctly linked to central stock
- **399** bar drinks have NO link to any stock SKU (pricing/stock gap)

## Bar Drinks → Stock Linkage

### Correctly Linked Bar Drinks

| Bar Drink Name | Bar SKU | Linked Stock SKU | Stock Item Name | Cost | Retail |
|----------------|---------|-----------------|-----------------|-----:|-------:|

### Bar Drinks With NO Stock Link ⚠️

These bar POS items are sold but not linked to any master catalog stock entry.
Stock cannot be automatically decremented when sold.

| Bar Drink Name | Category | SKU | Price | Branch |
|----------------|----------|-----|------:|--------|
| 4th Street |  | `FGB-STK-WIN-0001` | 1,200.00 | SOTIK |
| All Seasons 750ml |  | `FGB-STK-WHK-0032` | 1,400.00 | SOTIK |
| Alvaro |  | `FGB-STK-MIX-0003` | 200.00 | SOTIK |
| Amarula 375ml |  | `FGB-STK-CRM-0001` | 1,800.00 | SOTIK |
| Amarula 750ml |  | `FGB-STK-CRM-0002` | 3,000.00 | SOTIK |
| Asconi |  | `FGB-STK-WIN-0007` | 1,400.00 | SOTIK |
| Asconi 750ml |  | `FGB-STK-WIN-0008` | 2,000.00 | SOTIK |
| Astral Blanco Tot |  | `` | 150.00 | BOMET TOWN |
| B. Ice |  | `FGB-STK-BTL-0010` | 250.00 | SOTIK |
| Baileys 350ml |  | `FGB-STK-CRM-0004` | 1,800.00 | SOTIK |
| Baileys 750ml |  | `FGB-STK-CRM-0005` | 3,000.00 | SOTIK |
| Balozi |  | `FGB-STK-BTL-0011` | 250.00 | SOTIK |
| Balozi Can |  | `FGB-STK-CAN-0008` | 300.00 | SOTIK |
| Best Cream 750ml |  | `FGB-STK-CRM-0003` | 1,400.00 | SOTIK |
| Best Whisky 250ml |  | `FGB-STK-WHK-0018` | 500.00 | SOTIK |
| Best Whisky 750ml |  | `FGB-STK-WHK-0019` | 1,400.00 | SOTIK |
| Black & White 350ml |  | `FGB-STK-WHK-0038` | 800.00 | SOTIK |
| Black & White 750ml |  | `FGB-STK-WHK-0039` | 1,500.00 | SOTIK |
| Bond 7 250ml |  | `FGB-STK-WHK-0015` | 600.00 | SOTIK |
| Bond 7 350ml |  | `FGB-STK-WHK-0016` | 800.00 | SOTIK |
| Bond 7 750ml |  | `FGB-STK-WHK-0017` | 1,700.00 | SOTIK |
| Camino Real Gold |  | `FGB-STK-WIN-0011` | 4,600.00 | SOTIK |
| Camino Tot |  | `` | 150.00 | BOMET TOWN |
| Camino Tot |  | `FGB-STK-WIN-0013` | 200.00 | SOTIK |
| Caprice Sweet Red |  | `FGB-STK-WIN-0005` | 1,300.00 | SOTIK |
| Caprice Sweet White |  | `FGB-STK-WIN-0016` | 1,300.00 | SOTIK |
| Captain Morgan 250ml |  | `FGB-STK-RUM-0002` | 500.00 | SOTIK |
| Captain Morgan 750ml |  | `FGB-STK-RUM-0001` | 1,400.00 | SOTIK |
| Casabuena Sangria Red |  | `FGB-STK-WIN-0009` | 1,300.00 | SOTIK |
| Casabuena Sangria White |  | `FGB-STK-WIN-0018` | 1,300.00 | SOTIK |
| Cellar Cask Red |  | `FGB-STK-WIN-0002` | 1,200.00 | SOTIK |
| Cellar Cask White |  | `FGB-STK-WIN-0014` | 1,200.00 | SOTIK |
| Chamdor |  | `FGB-STK-WIN-0004` | 1,000.00 | SOTIK |
| Coke Zero |  | `FGB-STK-BEV-0003` | 100.00 | SOTIK |
| Dasani 1 Ltr |  | `FGB-STK-BEV-0006` | 100.00 | SOTIK |
| Dasani 500ml |  | `FGB-STK-BEV-0005` | 50.00 | SOTIK |
| Delmonte Passion |  | `FGB-STK-MIX-0007` | 350.00 | SOTIK |
| Desperado |  | `FGB-STK-MIX-0002` | 350.00 | SOTIK |
| Double Black 1 Ltr |  | `FGB-STK-WHK-0031` | 7,000.00 | SOTIK |
| Double Black 750ml |  | `FGB-STK-WHK-0030` | 5,800.00 | SOTIK |
| Drostdy-Hof Red |  | `FGB-STK-WIN-0003` | 1,200.00 | SOTIK |
| Drostdy-Hof White |  | `FGB-STK-WIN-0015` | 1,200.00 | SOTIK |
| Famous Grouse 750ml |  | `FGB-STK-WHK-0020` | 2,500.00 | SOTIK |
| Faxe |  | `FGB-STK-CAN-0011` | 350.00 | SOTIK |
| Four Cousins Red |  | `FGB-STK-WIN-0006` | 1,400.00 | SOTIK |
| Four Cousins White |  | `FGB-STK-WIN-0017` | 1,400.00 | SOTIK |
| Gilbeys Gin 250ml |  | `FGB-STK-GIN-0001` | 600.00 | SOTIK |
| Gilbeys Gin 350ml |  | `FGB-STK-GIN-0002` | 800.00 | SOTIK |
| Gilbeys Gin 750ml |  | `FGB-STK-GIN-0003` | 1,700.00 | SOTIK |
| Glenfiddich 12 Yrs |  | `FGB-STK-WHK-0021` | 7,500.00 | SOTIK |
| Glenfiddich 15 Yrs |  | `FGB-STK-WHK-0022` | 7,500.00 | SOTIK |
| Gordons Dry Gin 350ml |  | `FGB-STK-GIN-0004` | 1,200.00 | SOTIK |
| Gordons Dry Gin 750ml |  | `FGB-STK-GIN-0005` | 2,500.00 | SOTIK |
| Grants 1 Ltr |  | `FGB-STK-WHK-0037` | 3,200.00 | SOTIK |
| Grants 350ml |  | `FGB-STK-WHK-0035` | 1,600.00 | SOTIK |
| Grants 750ml |  | `FGB-STK-WHK-0036` | 2,500.00 | SOTIK |
| Guarana |  | `FGB-STK-BTL-0012` | 250.00 | SOTIK |
| Guinness |  | `FGB-STK-BTL-0003` | 280.00 | SOTIK |
| Guinness Can |  | `FGB-STK-CAN-0001` | 300.00 | SOTIK |
| Heineken |  | `FGB-STK-MIX-0001` | 350.00 | SOTIK |
| Heineken Can |  | `` | 0.00 | BOMET TOWN |
| Hennessy |  | `FGB-STK-WHK-0023` | 7,500.00 | SOTIK |
| Hennessy VSOP |  | `FGB-STK-WHK-0024` | 8,500.00 | SOTIK |
| Hunters 250ml |  | `FGB-STK-WHK-0040` | 500.00 | SOTIK |
| Hunters 350ml |  | `FGB-STK-WHK-0041` | 700.00 | SOTIK |
| Hunters 750ml |  | `FGB-STK-WHK-0042` | 1,300.00 | SOTIK |
| Hunters Gold 250ml |  | `FGB-STK-BEV-0012` | 300.00 | SOTIK |
| J.W Black 1 Ltr |  | `FGB-STK-WHK-0012` | 5,500.00 | SOTIK |
| J.W Black 250ml |  | `FGB-STK-WHK-0009` | 1,300.00 | SOTIK |
| J.W Black 375ml |  | `FGB-STK-WHK-0010` | 2,200.00 | SOTIK |
| J.W Black 750ml |  | `FGB-STK-WHK-0011` | 4,500.00 | SOTIK |
| J.W Black Green Label 1 Ltr |  | `FGB-STK-WHK-0014` | 7,500.00 | SOTIK |
| J.W Blonde |  | `FGB-STK-WHK-0013` | 3,000.00 | SOTIK |
| J.W Red 1 Ltr |  | `FGB-STK-WHK-0008` | 3,000.00 | SOTIK |
| J.W Red 250ml |  | `FGB-STK-WHK-0005` | 800.00 | SOTIK |
| J.W Red 375ml |  | `FGB-STK-WHK-0006` | 1,700.00 | SOTIK |
| J.W Red 750ml |  | `FGB-STK-WHK-0007` | 2,500.00 | SOTIK |
| J&B 750 ml |  | `FGB-STK-WHK-0043` | 2,400.00 | SOTIK |
| Jack Daniels 1 Ltr |  | `FGB-STK-WHK-0029` | 5,300.00 | SOTIK |
| Jack Daniels 350ml |  | `FGB-STK-WHK-0027` | 2,500.00 | SOTIK |
| Jack Daniels 700ml |  | `FGB-STK-WHK-0028` | 4,500.00 | SOTIK |
| Jager 1 Ltr |  | `FGB-STK-WIN-0010` | 6,600.00 | SOTIK |
| Jager Tot |  | `FGB-STK-WIN-0012` | 200.00 | SOTIK |
| Jagermeister Tots |  | `` | 200.00 | BOMET TOWN |
| Jameson 350ml |  | `FGB-STK-WHK-0001` | 1,600.00 | SOTIK |
| Jameson 750ml |  | `FGB-STK-WHK-0002` | 3,000.00 | SOTIK |
| JW Black Tot |  | `` | 250.00 | BOMET TOWN |
| K.C 250ml |  | `FGB-STK-SPR-0001` | 450.00 | SOTIK |
| K.C 350ml |  | `FGB-STK-SPR-0002` | 700.00 | SOTIK |
| K.C 750ml |  | `FGB-STK-SPR-0003` | 1,200.00 | SOTIK |
| Kingfisher |  | `FGB-STK-MIX-0005` | 300.00 | SOTIK |
| Lime Lemonade |  | `FGB-STK-BEV-0011` | 100.00 | SOTIK |
| Manyatta |  | `FGB-STK-BTL-0001` | 280.00 | SOTIK |
| Manyatta Can |  | `FGB-STK-CAN-0010` | 300.00 | SOTIK |
| Martell VS |  | `FGB-STK-WHK-0025` | 8,500.00 | SOTIK |
| Martell VSOP |  | `FGB-STK-WHK-0026` | 12,500.00 | SOTIK |
| Minute Maid |  | `FGB-STK-BEV-0007` | 100.00 | SOTIK |
| Monster |  | `FGB-STK-BEV-0009` | 350.00 | SOTIK |
| Novida |  | `FGB-STK-BEV-0004` | 80.00 | SOTIK |
| Pilsner Can |  | `FGB-STK-CAN-0007` | 300.00 | SOTIK |
| Pilsner Lager |  | `FGB-STK-BTL-0008` | 250.00 | SOTIK |
| Popov 250 ml |  | `FGB-STK-SPR-0004` | 350.00 | SOTIK |
| Predator |  | `FGB-STK-BEV-0008` | 100.00 | SOTIK |
| Red Bull |  | `FGB-STK-MIX-0006` | 300.00 | SOTIK |
| Richot 250ml |  | `FGB-STK-BRC-0005` | 600.00 | SOTIK |
| Richot 350ml |  | `FGB-STK-BRC-0006` | 800.00 | SOTIK |
| Richot 750ml |  | `FGB-STK-BRC-0007` | 1,800.00 | SOTIK |
| Robertson Whisky |  | `FGB-STK-BRC-0008` | 1,800.00 | SOTIK |
| Savanna Cider |  | `FGB-STK-MIX-0004` | 350.00 | SOTIK |
| Singleton 12 Yrs |  | `FGB-STK-WHK-0044` | 6,500.00 | SOTIK |
| Singleton 15 Yrs |  | `FGB-STK-WHK-0045` | 8,500.00 | SOTIK |
| Snapp |  | `FGB-STK-BTL-0004` | 250.00 | SOTIK |
| Snapp Can |  | `FGB-STK-CAN-0009` | 300.00 | SOTIK |
| Soda 300ml |  | `FGB-STK-BEV-0001` | 70.00 | SOTIK |
| Soda 500ml |  | `FGB-STK-BEV-0002` | 100.00 | SOTIK |
| Tang 10 |  | `FGB-STK-WHK-0046` | 5,300.00 | SOTIK |
| Tonic Soda |  | `FGB-STK-BEV-0010` | 120.00 | SOTIK |
| Trust Classic |  | `FGB-STK-OTH-0003` | 80.00 | SOTIK |
| Trust Kiss |  | `FGB-STK-OTH-0002` | 100.00 | SOTIK |
| Trust Studded |  | `FGB-STK-OTH-0001` | 100.00 | SOTIK |
| Tusker Cider |  | `FGB-STK-BTL-0002` | 280.00 | SOTIK |
| Tusker Cider Can |  | `FGB-STK-CAN-0002` | 300.00 | SOTIK |
| Tusker Lager |  | `FGB-STK-BTL-0005` | 250.00 | SOTIK |
| Tusker Lager Can |  | `FGB-STK-CAN-0003` | 300.00 | SOTIK |
| Tusker Lite |  | `FGB-STK-BTL-0006` | 250.00 | SOTIK |
| Tusker Lite Can |  | `FGB-STK-CAN-0005` | 300.00 | SOTIK |
| Tusker Malt |  | `FGB-STK-BTL-0007` | 250.00 | SOTIK |
| Tusker Malt Can |  | `FGB-STK-CAN-0006` | 300.00 | SOTIK |
| V&A 250ml |  | `FGB-STK-CRM-0006` | 400.00 | SOTIK |
| V&A 750ml |  | `FGB-STK-CRM-0007` | 1,200.00 | SOTIK |
| VAT 69 350ml |  | `FGB-STK-WHK-0003` | 1,000.00 | SOTIK |
| VAT 69 750ml |  | `FGB-STK-WHK-0004` | 2,000.00 | SOTIK |
| Viceroy 10 Yrs |  | `FGB-STK-BRC-0004` | 4,000.00 | SOTIK |
| Viceroy 250ml |  | `FGB-STK-BRC-0001` | 600.00 | SOTIK |
| Viceroy 375ml |  | `FGB-STK-BRC-0002` | 900.00 | SOTIK |
| Viceroy 750ml |  | `FGB-STK-BRC-0003` | 1,800.00 | SOTIK |
| Vodka 250ml |  | `FGB-STK-VOD-0001` | 600.00 | SOTIK |
| Vodka 350ml |  | `FGB-STK-VOD-0002` | 800.00 | SOTIK |
| Vodka 750ml |  | `FGB-STK-VOD-0003` | 1,700.00 | SOTIK |
| White Cap Can |  | `FGB-STK-CAN-0004` | 300.00 | SOTIK |
| White Cap Lager |  | `FGB-STK-BTL-0009` | 250.00 | SOTIK |
| William Lawsons 1 Ltr |  | `FGB-STK-WHK-0034` | 3,200.00 | SOTIK |
| William Lawsons 750ml |  | `FGB-STK-WHK-0033` | 2,200.00 | SOTIK |
| Windhoek |  | `FGB-STK-MIX-0008` | 250.00 | SOTIK |
| Balozi | Beers | `FGB-BER-0006` | 250.00 | BOMET TOWN |
| Black Ice | Beers | `FGB-BER-0007` | 250.00 | BOMET TOWN |
| Desperado | Beers | `FGB-BER-0011` | 350.00 | BOMET TOWN |
| Guiness | Beers | `FGB-BER-0005` | 300.00 | BOMET TOWN |
| Hunters Beer | Beers | `FGB-BER-0012` | 300.00 | BOMET TOWN |
| Manyatta | Beers | `FGB-BER-0010` | 300.00 | BOMET TOWN |
| Pilsner | Beers | `FGB-BER-0009` | 250.00 | BOMET TOWN |
| Snapp | Beers | `FGB-BER-0008` | 250.00 | BOMET TOWN |
| Tusker Cider | Beers | `FGB-BER-0002` | 300.00 | BOMET TOWN |
| Tusker Lager | Beers | `FGB-BER-0001` | 250.00 | BOMET TOWN |
| Tusker Lite | Beers | `FGB-BER-0003` | 250.00 | BOMET TOWN |
| Tusker Malt | Beers | `FGB-BER-0004` | 250.00 | BOMET TOWN |
| White Cap | Beers | `FGB-BER-0013` | 250.00 | BOMET TOWN |
| BALOZI | BOTTLED BEER | `MOG-BAR-0137` | 250.00 | MOGOGOSHIEK |
| BLACK ICE | BOTTLED BEER | `MOG-BAR-0135` | 250.00 | MOGOGOSHIEK |
| DESPARADO | BOTTLED BEER | `MOG-BAR-0154` | 350.00 | MOGOGOSHIEK |
| GUINNESS | BOTTLED BEER | `MOG-BAR-0136` | 280.00 | MOGOGOSHIEK |
| HEINEKEN | BOTTLED BEER | `MOG-BAR-0151` | 350.00 | MOGOGOSHIEK |
| HUNTERS GOLD | BOTTLED BEER | `MOG-BAR-0153` | 250.00 | MOGOGOSHIEK |
| KINGFISHER | BOTTLED BEER | `MOG-BAR-0157` | 300.00 | MOGOGOSHIEK |
| MANYATTA | BOTTLED BEER | `MOG-BAR-0140` | 280.00 | MOGOGOSHIEK |
| PILSNER LAGER | BOTTLED BEER | `MOG-BAR-0133` | 250.00 | MOGOGOSHIEK |
| PUNCH | BOTTLED BEER | `MOG-BAR-0139` | 250.00 | MOGOGOSHIEK |
| SAVANA CIDER | BOTTLED BEER | `MOG-BAR-0156` | 350.00 | MOGOGOSHIEK |
| SNAPP | BOTTLED BEER | `MOG-BAR-0130` | 250.00 | MOGOGOSHIEK |
| TUSKER CIDER | BOTTLED BEER | `MOG-BAR-0129` | 280.00 | MOGOGOSHIEK |
| TUSKER LAGER | BOTTLED BEER | `MOG-BAR-0131` | 250.00 | MOGOGOSHIEK |
| TUSKER LITE | BOTTLED BEER | `MOG-BAR-0243` | 250.00 | MOGOGOSHIEK |
| TUSKER MALT | BOTTLED BEER | `MOG-BAR-0132` | 250.00 | MOGOGOSHIEK |
| WHITE CAP CRISPS | BOTTLED BEER | `MOG-BAR-0138` | 250.00 | MOGOGOSHIEK |
| WHITE CAP LAGER | BOTTLED BEER | `MOG-BAR-0134` | 250.00 | MOGOGOSHIEK |
| WINDHOEK | BOTTLED BEER | `MOG-BAR-0265` | 250.00 | MOGOGOSHIEK |
| RICHOT 250ML | BRANDY | `MOG-BAR-0171` | 600.00 | MOGOGOSHIEK |
| RICHOT 350ML | BRANDY | `MOG-BAR-0172` | 800.00 | MOGOGOSHIEK |
| RICHOT 750ML | BRANDY | `MOG-BAR-0173` | 1,700.00 | MOGOGOSHIEK |
| VICEROY 10 YRS | BRANDY | `MOG-BAR-0170` | 4,500.00 | MOGOGOSHIEK |
| VICEROY 250ML | BRANDY | `MOG-BAR-0167` | 650.00 | MOGOGOSHIEK |
| VICEROY 350ML | BRANDY | `MOG-BAR-0168` | 900.00 | MOGOGOSHIEK |
| VICEROY 750ML | BRANDY | `MOG-BAR-0169` | 1,800.00 | MOGOGOSHIEK |
| Balozi Can | Canned Beers | `FGB-CAN-0014` | 270.00 | BOMET TOWN |
| Black Ice Can | Canned Beers | `FGB-CAN-0004` | 250.00 | BOMET TOWN |
| Faxe Can | Canned Beers | `FGB-CAN-0013` | 400.00 | BOMET TOWN |
| Gordons Can | Canned Beers | `FGB-CAN-0012` | 300.00 | BOMET TOWN |
| Guarana | Canned Beers | `FGB-CAN-0005` | 250.00 | BOMET TOWN |
| Guarana Punch | Canned Beers | `FGB-CAN-0010` | 250.00 | BOMET TOWN |
| Guiness Can | Canned Beers | `FGB-CAN-0001` | 300.00 | BOMET TOWN |
| Manyatta Can | Canned Beers | `FGB-CAN-0008` | 300.00 | BOMET TOWN |
| Raspberry Twist | Canned Beers | `FGB-CAN-0011` | 250.00 | BOMET TOWN |
| Snapp Can | Canned Beers | `FGB-CAN-0009` | 250.00 | BOMET TOWN |
| Tusker Cider Can | Canned Beers | `FGB-CAN-0007` | 300.00 | BOMET TOWN |
| Tusker Lager Can | Canned Beers | `FGB-CAN-0002` | 300.00 | BOMET TOWN |
| Tusker Lite Can | Canned Beers | `FGB-CAN-0006` | 300.00 | BOMET TOWN |
| White Cap Can | Canned Beers | `FGB-CAN-0003` | 270.00 | BOMET TOWN |
| BALOZI CAN | CANNED BEERS | `MOG-BAR-0149` | 300.00 | MOGOGOSHIEK |
| BLACK ICE CAN | CANNED BEERS | `MOG-BAR-0299` | 250.00 | MOGOGOSHIEK |
| FAXE | CANNED BEERS | `MOG-BAR-0152` | 400.00 | MOGOGOSHIEK |
| GORDONS CAN | CANNED BEERS | `MOG-BAR-0298` | 300.00 | MOGOGOSHIEK |
| GUARANA | CANNED BEERS | `MOG-BAR-0141` | 250.00 | MOGOGOSHIEK |
| GUINNESS CAN | CANNED BEERS | `MOG-BAR-0142` | 300.00 | MOGOGOSHIEK |
| MANYATTA CAN | CANNED BEERS | `MOG-BAR-0297` | 300.00 | MOGOGOSHIEK |
| PILSNER CAN | CANNED BEERS | `MOG-BAR-0148` | 300.00 | MOGOGOSHIEK |
| SNAPP CAN | CANNED BEERS | `MOG-BAR-0150` | 300.00 | MOGOGOSHIEK |
| TUSKER CIDER CAN | CANNED BEERS | `MOG-BAR-0143` | 300.00 | MOGOGOSHIEK |
| TUSKER LAGER CAN | CANNED BEERS | `MOG-BAR-0144` | 300.00 | MOGOGOSHIEK |
| TUSKER LITE CAN | CANNED BEERS | `MOG-BAR-0147` | 300.00 | MOGOGOSHIEK |
| TUSKER MALT CAN | CANNED BEERS | `MOG-BAR-0146` | 300.00 | MOGOGOSHIEK |
| WHITE CAP CAN | CANNED BEERS | `MOG-BAR-0145` | 300.00 | MOGOGOSHIEK |
| Double Black 1L | Cognac | `FGB-COG-0002` | 7,500.00 | BOMET TOWN |
| Hennessy 750ml | Cognac | `FGB-COG-0001` | 6,500.00 | BOMET TOWN |
| Martel VS | Cognac | `FGB-COG-0003` | 8,500.00 | BOMET TOWN |
| Martel VSOP | Cognac | `FGB-COG-0004` | 13,000.00 | BOMET TOWN |
| Singletone 12YRS | Cognac | `FGB-COG-0005` | 6,000.00 | BOMET TOWN |
| Monster | Energy Drinks | `FGB-ENR-0002` | 350.00 | BOMET TOWN |
| Redbull | Energy Drinks | `FGB-ENR-0001` | 300.00 | BOMET TOWN |
| MONSTER | ENERGY DRINKS | `MOG-BAR-0126` | 350.00 | MOGOGOSHIEK |
| PREDATOR | ENERGY DRINKS | `MOG-BAR-0118` | 100.00 | MOGOGOSHIEK |
| REDBULL | ENERGY DRINKS | `MOG-BAR-0158` | 300.00 | MOGOGOSHIEK |
| GILBEYS 250ML | GIN | `MOG-BAR-0160` | 600.00 | MOGOGOSHIEK |
| GILBEYS 350ML | GIN | `MOG-BAR-0161` | 850.00 | MOGOGOSHIEK |
| GILBEYS 750ML | GIN | `MOG-BAR-0162` | 1,800.00 | MOGOGOSHIEK |
| GORDONS DRY GIN 1 LTR | GIN | `MOG-BAR-0165` | 3,200.00 | MOGOGOSHIEK |
| GORDONS DRY GIN 350ML | GIN | `MOG-BAR-0163` | 1,200.00 | MOGOGOSHIEK |
| GORDONS DRY GIN 750ML | GIN | `MOG-BAR-0164` | 2,500.00 | MOGOGOSHIEK |
| Bulleit Bourbon | Others | `FGB-OTH-0004` | 5,000.00 | BOMET TOWN |
| Camino | Others | `FGB-OTH-0001` | 4,000.00 | BOMET TOWN |
| Jagermeister | Others | `FGB-OTH-0002` | 4,000.00 | BOMET TOWN |
| Pool Tokens | Others | `FGB-OTH-0007` | 50.00 | BOMET TOWN |
| Sheridans | Others | `FGB-OTH-0003` | 6,000.00 | BOMET TOWN |
| Trust Classic | Others | `FGB-OTH-0005` | 50.00 | BOMET TOWN |
| Trust Studded | Others | `FGB-OTH-0006` | 100.00 | BOMET TOWN |
| AMARULA 350ML | RUM & LIQUOR | `MOG-BAR-0264` | 1,400.00 | MOGOGOSHIEK |
| AMARULA 750ML | RUM & LIQUOR | `MOG-BAR-0301` | 2,400.00 | MOGOGOSHIEK |
| BAILEYS 350ML | RUM & LIQUOR | `MOG-BAR-0302` | 1,500.00 | MOGOGOSHIEK |
| BAILEYS 750ML | RUM & LIQUOR | `MOG-BAR-0303` | 3,000.00 | MOGOGOSHIEK |
| CAMINO | RUM & LIQUOR | `MOG-BAR-0235` | 5,000.00 | MOGOGOSHIEK |
| CAPTAIN MORGAN 250ML | RUM & LIQUOR | `MOG-BAR-0232` | 500.00 | MOGOGOSHIEK |
| CAPTAIN MORGAN 750ML | RUM & LIQUOR | `MOG-BAR-0233` | 1,300.00 | MOGOGOSHIEK |
| V&A | RUM & LIQUOR | `MOG-BAR-0281` | 1,200.00 | MOGOGOSHIEK |
| Alvaro Can | Soft Drinks | `FGB-SDR-0003` | 200.00 | BOMET TOWN |
| Delmonte | Soft Drinks | `FGB-SDR-0004` | 350.00 | BOMET TOWN |
| Lemonade | Soft Drinks | `FGB-SDR-0005` | 100.00 | BOMET TOWN |
| Soda 500ml | Soft Drinks | `FGB-SDR-0001` | 100.00 | BOMET TOWN |
| Water 1L | Soft Drinks | `FGB-SDR-0002` | 100.00 | BOMET TOWN |
| ALVARO | SOFT DRINKS | `MOG-BAR-0155` | 200.00 | MOGOGOSHIEK |
| DASANI 1 LTR | SOFT DRINKS | `MOG-BAR-0122` | 100.00 | MOGOGOSHIEK |
| DASANI 500ML | SOFT DRINKS | `MOG-BAR-0121` | 50.00 | MOGOGOSHIEK |
| DELMONTE | SOFT DRINKS | `MOG-BAR-0159` | 350.00 | MOGOGOSHIEK |
| KERINGET WATER 1 LTR | SOFT DRINKS | `MOG-BAR-0124` | 120.00 | MOGOGOSHIEK |
| KERINGET WATER 500ML | SOFT DRINKS | `MOG-BAR-0123` | 70.00 | MOGOGOSHIEK |
| LIME LEMONADE | SOFT DRINKS | `MOG-BAR-0128` | 100.00 | MOGOGOSHIEK |
| MINUTE MAID | SOFT DRINKS | `MOG-BAR-0125` | 120.00 | MOGOGOSHIEK |
| NOVIDA | SOFT DRINKS | `MOG-BAR-0120` | 100.00 | MOGOGOSHIEK |
| SODA 300ML | SOFT DRINKS | `MOG-BAR-0116` | 70.00 | MOGOGOSHIEK |
| SODA 500ML | SOFT DRINKS | `MOG-BAR-0117` | 100.00 | MOGOGOSHIEK |
| TONIC SODA | SOFT DRINKS | `MOG-BAR-0127` | 120.00 | MOGOGOSHIEK |
| Gilbeys 250ml | Spirits | `FGB-SPR-0010` | 600.00 | BOMET TOWN |
| Gilbeys 350ml | Spirits | `FGB-SPR-0011` | 850.00 | BOMET TOWN |
| Gilbeys 750ml | Spirits | `FGB-SPR-0012` | 1,700.00 | BOMET TOWN |
| KC 250ml | Spirits | `FGB-SPR-0001` | 500.00 | BOMET TOWN |
| KC 350ml | Spirits | `FGB-SPR-0002` | 700.00 | BOMET TOWN |
| KC 750ml | Spirits | `FGB-SPR-0003` | 1,300.00 | BOMET TOWN |
| Richot 250ml | Spirits | `FGB-SPR-0007` | 600.00 | BOMET TOWN |
| Richot 350ml | Spirits | `FGB-SPR-0008` | 800.00 | BOMET TOWN |
| Richot 750ml | Spirits | `FGB-SPR-0009` | 1,700.00 | BOMET TOWN |
| Viceroy 250ml | Spirits | `FGB-SPR-0013` | 650.00 | BOMET TOWN |
| Viceroy 350ml | Spirits | `FGB-SPR-0014` | 900.00 | BOMET TOWN |
| Viceroy 750ml | Spirits | `FGB-SPR-0015` | 1,800.00 | BOMET TOWN |
| Vodka 250ml | Spirits | `FGB-SPR-0004` | 600.00 | BOMET TOWN |
| Vodka 350ml | Spirits | `FGB-SPR-0005` | 800.00 | BOMET TOWN |
| Vodka 750ml | Spirits | `FGB-SPR-0006` | 1,700.00 | BOMET TOWN |
| KC 250ML | SPIRITS | `MOG-BAR-0177` | 450.00 | MOGOGOSHIEK |
| KC 350ML | SPIRITS | `MOG-BAR-0178` | 600.00 | MOGOGOSHIEK |
| KC 750ML | SPIRITS | `MOG-BAR-0179` | 1,100.00 | MOGOGOSHIEK |
| CAMINO TOT | TOTS | `MOG-BAR-0237` | 200.00 | MOGOGOSHIEK |
| JAGERMEISTER TOT | TOTS | `MOG-BAR-0236` | 200.00 | MOGOGOSHIEK |
| VODKA 1 LTR | VODKA | `MOG-BAR-0312` | 2,300.00 | MOGOGOSHIEK |
| VODKA 250ML | VODKA | `MOG-BAR-0174` | 600.00 | MOGOGOSHIEK |
| VODKA 350ML | VODKA | `MOG-BAR-0175` | 800.00 | MOGOGOSHIEK |
| VODKA 750ML | VODKA | `MOG-BAR-0176` | 1,600.00 | MOGOGOSHIEK |
| All Seasons 750ml | Whisky | `FGB-WHK-0003` | 1,500.00 | BOMET TOWN |
| Best Cream 750ml | Whisky | `FGB-WHK-0002` | 1,500.00 | BOMET TOWN |
| Best Whisky 750ml | Whisky | `FGB-WHK-0001` | 1,300.00 | BOMET TOWN |
| Black & White 350ml | Whisky | `FGB-WHK-0022` | 800.00 | BOMET TOWN |
| Black & White 750ml | Whisky | `FGB-WHK-0023` | 1,500.00 | BOMET TOWN |
| Bond 7 250ml | Whisky | `FGB-WHK-0006` | 600.00 | BOMET TOWN |
| Bond 7 350ml | Whisky | `FGB-WHK-0007` | 800.00 | BOMET TOWN |
| Bond 7 750ml | Whisky | `FGB-WHK-0008` | 1,700.00 | BOMET TOWN |
| Captain Morgan 250ml | Whisky | `FGB-WHK-0034` | 500.00 | BOMET TOWN |
| Captain Morgan 750ml | Whisky | `FGB-WHK-0035` | 1,300.00 | BOMET TOWN |
| Captain Morgan Melon 750ml | Whisky | `FGB-WHK-0036` | 1,500.00 | BOMET TOWN |
| Famous Grouse | Whisky | `FGB-WHK-0037` | 2,500.00 | BOMET TOWN |
| Gordons 350ml | Whisky | `FGB-WHK-0026` | 1,500.00 | BOMET TOWN |
| Gordons 750ml | Whisky | `FGB-WHK-0027` | 3,000.00 | BOMET TOWN |
| Grants 1L | Whisky | `FGB-WHK-0010` | 3,000.00 | BOMET TOWN |
| Grants 750ml | Whisky | `FGB-WHK-0009` | 2,500.00 | BOMET TOWN |
| Hunters 250ml | Whisky | `FGB-WHK-0019` | 500.00 | BOMET TOWN |
| Hunters 350ml | Whisky | `FGB-WHK-0020` | 700.00 | BOMET TOWN |
| Hunters 750ml | Whisky | `FGB-WHK-0021` | 1,300.00 | BOMET TOWN |
| Jack Daniels 1L | Whisky | `FGB-WHK-0030` | 5,000.00 | BOMET TOWN |
| Jack Daniels 350ml | Whisky | `FGB-WHK-0028` | 2,400.00 | BOMET TOWN |
| Jack Daniels 700ml | Whisky | `FGB-WHK-0029` | 4,000.00 | BOMET TOWN |
| Jameson 1L | Whisky | `FGB-WHK-0033` | 4,000.00 | BOMET TOWN |
| Jameson 350ml | Whisky | `FGB-WHK-0031` | 1,600.00 | BOMET TOWN |
| Jameson 750ml | Whisky | `FGB-WHK-0032` | 3,200.00 | BOMET TOWN |
| JW Black 1L | Whisky | `FGB-WHK-0017` | 5,000.00 | BOMET TOWN |
| JW Black 350ml | Whisky | `FGB-WHK-0015` | 2,100.00 | BOMET TOWN |
| JW Black 750ml | Whisky | `FGB-WHK-0016` | 4,000.00 | BOMET TOWN |
| JW Blonde 750ml | Whisky | `FGB-WHK-0018` | 3,000.00 | BOMET TOWN |
| JW Red 1L | Whisky | `FGB-WHK-0014` | 3,000.00 | BOMET TOWN |
| JW Red 250ml | Whisky | `FGB-WHK-0011` | 1,000.00 | BOMET TOWN |
| JW Red 350ml | Whisky | `FGB-WHK-0012` | 1,300.00 | BOMET TOWN |
| JW Red 750ml | Whisky | `FGB-WHK-0013` | 2,500.00 | BOMET TOWN |
| Savanna | Whisky | `FGB-WHK-0024` | 350.00 | BOMET TOWN |
| Tang 10 | Whisky | `FGB-WHK-0025` | 6,000.00 | BOMET TOWN |
| V&A 250ml | Whisky | `FGB-WHK-0041` | 400.00 | BOMET TOWN |
| V&A 750ml | Whisky | `FGB-WHK-0042` | 1,200.00 | BOMET TOWN |
| VAT 69 350ml | Whisky | `FGB-WHK-0004` | 1,100.00 | BOMET TOWN |
| VAT 69 750ml | Whisky | `FGB-WHK-0005` | 1,900.00 | BOMET TOWN |
| William Lawsons 1L | Whisky | `FGB-WHK-0040` | 3,000.00 | BOMET TOWN |
| William Lawsons 350ml | Whisky | `FGB-WHK-0038` | 1,000.00 | BOMET TOWN |
| William Lawsons 750ml | Whisky | `FGB-WHK-0039` | 2,100.00 | BOMET TOWN |
| ALL SEASONS | WHISKY | `MOG-BAR-0263` | 1,400.00 | MOGOGOSHIEK |
| BEST WHISKY 250ML | WHISKY | `MOG-BAR-0217` | 500.00 | MOGOGOSHIEK |
| BEST WHISKY 750ML | WHISKY | `MOG-BAR-0218` | 1,400.00 | MOGOGOSHIEK |
| BLACK & WHITE 350ML | WHISKY | `MOG-BAR-0212` | 800.00 | MOGOGOSHIEK |
| BLACK & WHITE 750ML | WHISKY | `MOG-BAR-0213` | 1,400.00 | MOGOGOSHIEK |
| BOND 7 250ML | WHISKY | `MOG-BAR-0194` | 600.00 | MOGOGOSHIEK |
| BOND 7 350ML | WHISKY | `MOG-BAR-0195` | 800.00 | MOGOGOSHIEK |
| BOND 7 750ML | WHISKY | `MOG-BAR-0196` | 1,700.00 | MOGOGOSHIEK |
| BULLEIT BOURBON | WHISKY | `MOG-BAR-0300` | 5,800.00 | MOGOGOSHIEK |
| DOUBLE BLACK 1 LTR | WHISKY | `MOG-BAR-0307` | 7,000.00 | MOGOGOSHIEK |
| FAMOUS GROUSE | WHISKY | `MOG-BAR-0197` | 2,500.00 | MOGOGOSHIEK |
| GLENFIDICH 12 YRS | WHISKY | `MOG-BAR-0198` | 8,500.00 | MOGOGOSHIEK |
| GLENFIDICH 15 YRS | WHISKY | `MOG-BAR-0199` | 12,000.00 | MOGOGOSHIEK |
| GLENFIDICH 18 YRS | WHISKY | `MOG-BAR-0200` | 17,500.00 | MOGOGOSHIEK |
| GRANTS 1 LTR | WHISKY | `MOG-BAR-0211` | 3,200.00 | MOGOGOSHIEK |
| GRANTS 350ML | WHISKY | `MOG-BAR-0209` | 1,600.00 | MOGOGOSHIEK |
| GRANTS 750ML | WHISKY | `MOG-BAR-0210` | 2,500.00 | MOGOGOSHIEK |
| HENNESY 1 LTR | WHISKY | `MOG-BAR-0204` | 13,500.00 | MOGOGOSHIEK |
| HENNESY 700ML | WHISKY | `MOG-BAR-0203` | 7,500.00 | MOGOGOSHIEK |
| HUNTERS 250ML | WHISKY | `MOG-BAR-0214` | 600.00 | MOGOGOSHIEK |
| HUNTERS 350ML | WHISKY | `MOG-BAR-0215` | 800.00 | MOGOGOSHIEK |
| HUNTERS 750ML | WHISKY | `MOG-BAR-0216` | 1,300.00 | MOGOGOSHIEK |
| J. WALKER BLACK 1 LTR | WHISKY | `MOG-BAR-0193` | 5,500.00 | MOGOGOSHIEK |
| J. WALKER BLACK 250ML | WHISKY | `MOG-BAR-0190` | 1,300.00 | MOGOGOSHIEK |
| J. WALKER BLACK 350ML | WHISKY | `MOG-BAR-0191` | 2,500.00 | MOGOGOSHIEK |
| J. WALKER BLACK 750ML | WHISKY | `MOG-BAR-0192` | 4,500.00 | MOGOGOSHIEK |
| J. WALKER BLONDE | WHISKY | `MOG-BAR-0417` | 4,000.00 | MOGOGOSHIEK |
| J. WALKER RED 1 LTR | WHISKY | `MOG-BAR-0189` | 3,000.00 | MOGOGOSHIEK |
| J. WALKER RED 250ML | WHISKY | `MOG-BAR-0186` | 1,000.00 | MOGOGOSHIEK |
| J. WALKER RED 350ML | WHISKY | `MOG-BAR-0187` | 1,700.00 | MOGOGOSHIEK |
| J. WALKER RED 750ML | WHISKY | `MOG-BAR-0188` | 2,500.00 | MOGOGOSHIEK |
| JACK DANIELS 1 LTR | WHISKY | `MOG-BAR-0207` | 6,000.00 | MOGOGOSHIEK |
| JACK DANIELS 350ML | WHISKY | `MOG-BAR-0205` | 2,500.00 | MOGOGOSHIEK |
| JACK DANIELS 750ML | WHISKY | `MOG-BAR-0206` | 4,500.00 | MOGOGOSHIEK |
| JAMESON 1 LTR | WHISKY | `MOG-BAR-0183` | 4,500.00 | MOGOGOSHIEK |
| JAMESON 350ML | WHISKY | `MOG-BAR-0181` | 1,600.00 | MOGOGOSHIEK |
| JAMESON 750ML | WHISKY | `MOG-BAR-0182` | 3,500.00 | MOGOGOSHIEK |
| MARTEL 750ML | WHISKY | `MOG-BAR-0201` | 8,500.00 | MOGOGOSHIEK |
| MARTEL VSOP | WHISKY | `MOG-BAR-0202` | 12,500.00 | MOGOGOSHIEK |
| SINGLETON 12 YRS | WHISKY | `MOG-BAR-0422` | 5,800.00 | MOGOGOSHIEK |
| SOUTHERN COMFORT | WHISKY | `MOG-BAR-0180` | 3,200.00 | MOGOGOSHIEK |
| VAT 69 350ML | WHISKY | `MOG-BAR-0184` | 1,000.00 | MOGOGOSHIEK |
| VAT 69 750ML | WHISKY | `MOG-BAR-0185` | 1,800.00 | MOGOGOSHIEK |
| WILLIAM LAWSONS 1 LTR | WHISKY | `MOG-BAR-0413` | 2,500.00 | MOGOGOSHIEK |
| WILLIAM LAWSONS 750ML | WHISKY | `MOG-BAR-0208` | 2,200.00 | MOGOGOSHIEK |
| 4th Street | Wines | `FGB-WIN-0003` | 1,300.00 | BOMET TOWN |
| Amarula 350ml | Wines | `FGB-WIN-0008` | 1,600.00 | BOMET TOWN |
| Amarula 750ml | Wines | `FGB-WIN-0009` | 2,500.00 | BOMET TOWN |
| Asconi | Wines | `FGB-WIN-0012` | 2,000.00 | BOMET TOWN |
| Baileys 350ml | Wines | `FGB-WIN-0010` | 1,600.00 | BOMET TOWN |
| Baileys 750ml | Wines | `FGB-WIN-0011` | 2,800.00 | BOMET TOWN |
| Caprice Sweet Red | Wines | `FGB-WIN-0005` | 1,100.00 | BOMET TOWN |
| Casabuena Sangaria | Wines | `FGB-WIN-0004` | 1,100.00 | BOMET TOWN |
| Cellar Cask | Wines | `FGB-WIN-0001` | 1,400.00 | BOMET TOWN |
| Drostdy Hof | Wines | `FGB-WIN-0013` | 1,300.00 | BOMET TOWN |
| Four Cousins | Wines | `FGB-WIN-0006` | 1,200.00 | BOMET TOWN |
| Heineken | Wines | `FGB-WIN-0002` | 350.00 | BOMET TOWN |
| Kingfisher | Wines | `FGB-WIN-0007` | 300.00 | BOMET TOWN |
| Robertson | Wines | `FGB-WIN-0014` | 2,000.00 | BOMET TOWN |
| 4TH STREET RED | WINES | `MOG-BAR-0219` | 1,200.00 | MOGOGOSHIEK |
| 4TH STREET WHITE | WINES | `MOG-BAR-0220` | 1,200.00 | MOGOGOSHIEK |
| ASCONI | WINES | `MOG-BAR-0231` | 2,200.00 | MOGOGOSHIEK |
| CAPRICE RED | WINES | `MOG-BAR-0225` | 1,300.00 | MOGOGOSHIEK |
| CAPRICE WHITE | WINES | `MOG-BAR-0226` | 1,300.00 | MOGOGOSHIEK |
| CASABUENA RED | WINES | `MOG-BAR-0227` | 1,200.00 | MOGOGOSHIEK |
| CASABUENA WHITE | WINES | `MOG-BAR-0228` | 1,200.00 | MOGOGOSHIEK |
| CELLAR CASK RED | WINES | `MOG-BAR-0222` | 1,200.00 | MOGOGOSHIEK |
| CELLAR CASK WHITE | WINES | `MOG-BAR-0221` | 1,200.00 | MOGOGOSHIEK |
| DROSDTY HOF RED | WINES | `MOG-BAR-0223` | 1,200.00 | MOGOGOSHIEK |
| DROSDTY HOF WHITE | WINES | `MOG-BAR-0224` | 1,200.00 | MOGOGOSHIEK |
| FOUR COUSINS RED | WINES | `MOG-BAR-0229` | 1,400.00 | MOGOGOSHIEK |
| FOUR COUSINS WHITE | WINES | `MOG-BAR-0230` | 1,400.00 | MOGOGOSHIEK |
| NUDEBURG | WINES | `MOG-BAR-0166` | 2,800.00 | MOGOGOSHIEK |
| ROBERTSON | WINES | `MOG-BAR-0401` | 1,700.00 | MOGOGOSHIEK |

## Kitchen POS Items (restaurant_menu_items)

These 482 items are sold at the kitchen/restaurant POS. They are **composed dishes**, not raw stock.
The system's Food Control Standards / Recipes define what raw ingredients each dish consumes.

| Category | Count |
|----------|------:|
| menu | 157 |
| WHISKY | 45 |
| SNACKS | 25 |
| HOT BEVERAGES | 21 |
| BOTTLED BEER | 19 |
| CHICKEN BROILERS | 15 |
| WINES | 15 |
| COLD BEVERAGES | 15 |
| OTHERS | 15 |
| BEEF | 14 |
| MUTTON | 14 |
| CANNED BEERS | 14 |
| SPECIALS | 13 |
| SOFT DRINKS | 12 |
| VEGETABLES | 12 |
| ACCOMPANIMENT | 11 |
| CHICKEN KIENYEJI | 9 |
| RUM & LIQUOR | 8 |
| BRANDY | 7 |
| SOUPS | 6 |
| EGGS | 6 |
| FISH DISHES | 6 |
| GIN | 6 |
| VODKA | 4 |
| DESSERTS | 3 |
| SPIRITS | 3 |
| ENERGY DRINKS | 3 |
| TOTS | 2 |
| SALADS | 2 |

### Full Kitchen POS Listing

| SKU | Name | Category | Price (KES) | Cost (KES) | Available | Branch |
|-----|------|----------|------------:|-----------:|-----------|--------|
| `FGH-CHB-0012` | 1 Kg Chicken Dry Fry | menu | 1,400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0006` | 1 Kg Chicken Pan Fry | menu | 1,600.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0003` | 1 Kg Chicken Wet Fry | menu | 1,400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0011` | 1/2 Kg Chicken Dry Fry | menu | 700.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0005` | 1/2 Kg Chicken Pan Fry | menu | 800.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0002` | 1/2 Kg Chicken Wet Fry | menu | 700.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0011` | 1/2 Kg Kuku Kienyeji Dry Fry | menu | 1,000.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0005` | 1/2 Kg Kuku Kienyeji Pan Fry | menu | 1,100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0002` | 1/2 Kg Kuku Kienyeji Wet Fry | menu | 1,100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-797692d9-1146-4c86-b348-fe3774a733f1` | 1/4 Kg Chicken Dry Fry | menu | 350.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0004` | 1/4 Kg Chicken Pan Fry | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0001` | 1/4 Kg Chicken Wet Fry | menu | 350.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0010` | 1/4 Kg Kuku Kienyeji Dry Fry | menu | 500.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0004` | 1/4 Kg Kuku Kienyeji Pan Fry | menu | 550.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0001` | 1/4 Kg Kuku Kienyeji Wet Fry | menu | 550.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-36d1b188-928d-40d6-86d1-b50a992fd9a0` | 20 Litre Container | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BSD-0004` | Banana 2 Pieces | menu | 40.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-71b4c3b0-288c-4efb-bfc7-021b203bc2e4` | Beans | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0005` | Beef Pan Fry 1 Kg | menu | 1,600.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0004` | Beef Pan Fry 1/2 Kg | menu | 800.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0003` | Beef Pan Fry 1/4 Kg | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0002` | Beef Stew 1 Kg | menu | 1,600.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-c89e6e19-0b4c-489b-9688-02fa6c2c90ae` | Beef Stew 1/2 Kg | menu | 800.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0001` | Beef Stew 1/4 Kg | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0008` | Beef Wet Fry 1 Kg | menu | 1,600.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0007` | Beef Wet Fry 1/2 Kg | menu | 800.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BEF-0006` | Beef Wet Fry 1/4 Kg | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-79eebd8c-8969-431e-a8f7-49defee12b7a` | Bhajia | menu | 250.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0016` | Black Coffee | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0003` | Black Tea | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0005` | Boiled Eggs Broiler | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0006` | Boiled Eggs Kienyeji | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0004` | Brown Chapati | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-5f348f46-12d2-4caa-bebe-5d2a0f67399c` | Cabbage Mixed (Beef) | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-FST-0005` | Cabbage Mixed (Mbuzi) | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-7bcf03d1-b7ed-434c-83a3-aa34653ece71` | Cabbage Plain | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0003` | Chapati | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SWR-0003` | Chapati Roll Broiler | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SWR-0004` | Chapati Roll Kienyeji | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-FST-0001` | Chips | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-3a25aaf6-80b3-484e-8936-017c6e07013f` | Chips Masala | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0017` | Chocolate / Milo | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0010` | Cocoa | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-cb48a0e0-8aea-460a-a9d1-2f0fbd2bce0a` | Coffee Cup | menu | 20.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0013` | Cookies Pair | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0010` | Corn Flakes | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0009` | Dawa | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0010` | Delmonte Juice 1 Litre | menu | 350.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0008` | Dried Chapati | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0009` | Egg Fry Macho | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SWR-0001` | Egg Sandwich | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BRK-0001` | FG Breakfast | menu | 300.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BRK-0002` | FG Special | menu | 500.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-FSH-0001` | Fish Dry Whole | menu | 550.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-FSH-0002` | Fish Wet Whole | menu | 600.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SWR-0005` | French Toast | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0011` | Fresh Juice Passion/Mango | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0005` | Fresh Milk Glass | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0007` | Fried Eggs Broiler | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0008` | Fried Eggs Kienyeji | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0012` | Full Kuku Kienyeji Dry Fry | menu | 2,000.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0006` | Full Kuku Kienyeji Pan Fry | menu | 2,200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-00b69d3b-1829-453c-8aa5-53109fd90bad` | Garlic Chips | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0008` | Ginger Tea | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-96b1112c-12ba-402c-8fa3-181a1289853b` | Githeri | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0012` | Half Cake | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0007` | Honey Plain | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0012` | Hot Lemon | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0007` | KCC Mala | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0006` | KCC Milk Packet | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0017` | Kebab | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-KUK-0003` | Kuku Kienyeji Wet Fry FULL | menu | 2,200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0006` | Lemon Coffee Honey | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0004` | Lemon Tea | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0005` | Lemon Tea Honey | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0001` | Mahamri | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-d4e8a5eb-b27d-427b-9841-6bec2971d290` | Managu Mixed (Beef) | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-84ac0dab-a119-484b-b476-a5a9a9962133` | Managu Plain | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0011` | Marble Cake | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-032e785f-4334-481a-82c0-a542ae0fce32` | Mashed Potatoes | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-83899057-ec37-450d-8e9e-4935237dbcd7` | Matoke | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0012` | Mbuzi Boiled 1 Kg | menu | 1,400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0011` | Mbuzi Boiled 1/2 Kg | menu | 700.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0010` | Mbuzi Boiled 1/4 Kg | menu | 350.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0009` | Mbuzi Choma 1 Kg | menu | 1,400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0008` | Mbuzi Choma 1/2 Kg | menu | 700.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0007` | Mbuzi Choma 1/4 Kg | menu | 350.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0006` | Mbuzi Pan Fry 1 Kg | menu | 1,600.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0005` | Mbuzi Pan Fry 1/2 Kg | menu | 800.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0004` | Mbuzi Pan Fry 1/4 Kg | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0003` | Mbuzi Wet Fry 1 Kg | menu | 1,600.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0002` | Mbuzi Wet Fry 1/2 Kg | menu | 800.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-MBZ-0001` | Mbuzi Wet Fry 1/4 Kg | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0012` | Milk Shake | menu | 250.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0009` | Minute Maid 500ml | menu | 120.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-97eed7f9-e5ae-42ad-9779-e89caf4a1fab` | Mixed Veg | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-ab60542e-924c-4cfc-99a5-d1fbe637f700` | Mokimo | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0008` | Mursik Glass | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0002` | Ndazi | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BSD-0003` | Nduma | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0007` | Pancake | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-ad0ec5a8-e5f8-4a1f-8c7e-10a4f4c0dac4` | Peas Miji | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-567129d9-2756-4400-9138-aebeedff03be` | Pilau | menu | 250.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-FST-0007` | Pilau Special (Mbuzi) | menu | 300.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-PLT-0001` | Platter For 2 | menu | 1,500.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-PLT-0002` | Platter For 4 | menu | 4,000.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-PLT-0003` | Platter For 6 | menu | 6,000.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-PLT-0004` | Platter For 9 | menu | 9,000.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0010` | Poached Eggs | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BSD-0001` | Porridge | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-c32bc4eb-3b3c-431b-91dc-406f30026c33` | Potato Wedges | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0015` | Queen Cakes | menu | 80.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-3ca0c9db-f527-48f4-bfd0-9d0baa23906a` | Rice Plain | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-6c395b7a-2ea3-4b50-90a5-e7be98c34354` | Roast Potatoes | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0005` | Samosa | menu | 60.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0006` | Sausage | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-2d48e94a-4323-4449-8bc6-5af685dad747` | Saute Potatoes | menu | 250.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0014` | Scones | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0002` | Scrambled Eggs Broiler | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0001` | Scrambled Eggs Kienyeji | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0013` | Smoothies | menu | 250.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0001` | Soda 300ml | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0002` | Soda 300ml Take Away | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-daa046f2-fbcc-4333-8802-9830644103ec` | Spaghetti Bolognalae | menu | 300.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-1235a28d-cac7-4eed-a5d1-a5842657d587` | Spaghetti Napolitan | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0004` | Spanish Omelette Broiler | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-EGD-0003` | Spanish Omelette Kienyeji | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-FST-0006` | Special Cabbage (Mbuzi) | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-72e13ecc-a28c-4441-b2f8-0fe13e232cfe` | Special Cabbage( Beef) | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-a0c97bba-5472-4091-99b8-ae7da0eba286` | Special Chicken | menu | 400.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-7c8c778f-4d7b-469d-b5c4-a807306e3d92` | Special Githeri (Beef) | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-64f2df66-d9a8-481f-b715-d21cc725a77b` | Special Kebab | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-1e478299-1a83-4024-ad28-45ad4a6e9a9d` | Special Managu (Beef) | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-10f37d06-71fa-4e76-8061-1c743dd8c49f` | Special Mayai | menu | 200.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-599af8b0-60cf-487d-bb58-132e6dc24f64` | Special Mix Managu (Beef) | menu | 270.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-73e5f78d-35a6-4a0e-a655-77b60b2a5d01` | Special Pilau (Beef) | menu | 300.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CHB-0010` | Special Rice (Mbuzi) | menu | 250.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-e40c8658-a434-4535-bd5e-5807c5a118bd` | Special Samosa | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-1fbd380f-abe2-466b-8a15-5bc2ca69efa5` | Special Sausage | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-0b9a60e7-c84c-4ae0-90f2-61944032f83b` | Special Sukuma (Beef) | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0013` | Special Tea | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-9c1e74a2-c183-45d5-962b-e9b8b7276197` | Sukuma Mixed (Beef) | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-83b5c8a6-a1bf-4dbd-af0b-38ff60c1e502` | Sukuma Plain | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-BSD-0002` | Sweet Potatoes | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0011` | Tea Masala | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0001` | Tea Mug | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0002` | Tea Pot | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0016` | Tea Scones 2 Pieces | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-37d93f18-2e99-407f-9bfb-84ad3087d21c` | Tins | menu | 20.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SNP-0009` | Toasted Bread | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-a49f3c09-5410-4b5b-b959-269a9893fdfa` | Ugali Brown | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `MENU-37f9f25d-e9c1-48a0-ba9d-a7b469c4f5ff` | Ugali White | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-SWR-0002` | Vegetable Sandwich | menu | 150.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0004` | Water 1 Litre | menu | 100.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-CBV-0003` | Water 500ml | menu | 50.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0015` | White Coffee | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `FGH-HBV-0014` | White Tea | menu | 70.00 | 0.00 | ✓ | BOMET TOWN |
| `MOG-RES-0069` | CHIPS FRY | ACCOMPANIMENT | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0070` | CHIPS MASALA | ACCOMPANIMENT | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0266` | CHIPS TAKEAWAY | ACCOMPANIMENT | 170.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0308` | GITHERI | ACCOMPANIMENT | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0076` | PILAU PLAIN | ACCOMPANIMENT | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0075` | RICE PLAIN | ACCOMPANIMENT | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0071` | ROAST POTATOES | ACCOMPANIMENT | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0272` | SAUTE POTATOES | ACCOMPANIMENT | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0074` | UGALI (BROWN) | ACCOMPANIMENT | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0073` | UGALI (WHITE) | ACCOMPANIMENT | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0079` | VEGETABLE RICE | ACCOMPANIMENT | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0111` | 1 KG BEEF CHOMA | BEEF | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0109` | 1/2 BEEF BOILED | BEEF | 650.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0108` | 1/2 BEEF CHOMA | BEEF | 650.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0114` | 1/2 BEEF WET FRY | BEEF | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0107` | 1/4 BEEF BOILED | BEEF | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0106` | 1/4 BEEF CHOMA | BEEF | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0113` | 1/4 BEEF WET FRY | BEEF | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0112` | 1KG BEEF BOILED | BEEF | 1,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0115` | 1KG BEEF WET FRY | BEEF | 1,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0110` | 3/4 BEEF CHOMA | BEEF | 850.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0259` | MATUMBO | BEEF | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0279` | PAN FRY BEEF 1/2 | BEEF | 850.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0278` | PAN FRY BEEF 1/4 | BEEF | 450.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0430` | TUMBUKIZA 1/2 | BEEF | 900.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0137` | BALOZI | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0135` | BLACK ICE | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0154` | DESPARADO | BOTTLED BEER | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0136` | GUINNESS | BOTTLED BEER | 280.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0151` | HEINEKEN | BOTTLED BEER | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0153` | HUNTERS GOLD | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0157` | KINGFISHER | BOTTLED BEER | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0140` | MANYATTA | BOTTLED BEER | 280.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0133` | PILSNER LAGER | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0139` | PUNCH | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0156` | SAVANA CIDER | BOTTLED BEER | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0130` | SNAPP | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0129` | TUSKER CIDER | BOTTLED BEER | 280.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0131` | TUSKER LAGER | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0243` | TUSKER LITE | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0132` | TUSKER MALT | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0138` | WHITE CAP CRISPS | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0134` | WHITE CAP LAGER | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0265` | WINDHOEK | BOTTLED BEER | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0171` | RICHOT 250ML | BRANDY | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0172` | RICHOT 350ML | BRANDY | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0173` | RICHOT 750ML | BRANDY | 1,700.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0170` | VICEROY 10 YRS | BRANDY | 4,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0167` | VICEROY 250ML | BRANDY | 650.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0168` | VICEROY 350ML | BRANDY | 900.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0169` | VICEROY 750ML | BRANDY | 1,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0149` | BALOZI CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0299` | BLACK ICE CAN | CANNED BEERS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0152` | FAXE | CANNED BEERS | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0298` | GORDONS CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0141` | GUARANA | CANNED BEERS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0142` | GUINNESS CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0297` | MANYATTA CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0148` | PILSNER CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0150` | SNAPP CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0143` | TUSKER CIDER CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0144` | TUSKER LAGER CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0147` | TUSKER LITE CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0146` | TUSKER MALT CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0145` | WHITE CAP CAN | CANNED BEERS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0088` | 1/2 CHOMA CHICKEN BROILER | CHICKEN BROILERS | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0085` | 1/2 DRY FRY CHICKEN BROILER | CHICKEN BROILERS | 700.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0087` | 1/2 PAN FRY CHICKEN BROILER | CHICKEN BROILERS | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0086` | 1/2 WET FRY CHICKEN BROILER | CHICKEN BROILERS | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0092` | 1/4 CHICKEN CURRY | CHICKEN BROILERS | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0081` | 1/4 CHICKEN DRY FRY BROILER | CHICKEN BROILERS | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0093` | 1/4 CHICKEN MERRYLAND | CHICKEN BROILERS | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0084` | 1/4 CHOMA CHICKEN BROILER | CHICKEN BROILERS | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0082` | 1/4 WET FRY CHICKEN BROILER | CHICKEN BROILERS | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0256` | BROILER PAN FRY 1/4 | CHICKEN BROILERS | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0094` | CHICKEN MASALA | CHICKEN BROILERS | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0314` | CHICKEN SPECIAL BROILER | CHICKEN BROILERS | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0089` | FULL CHICKEN BROILER WET FRY | CHICKEN BROILERS | 1,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0091` | FULL CHICKEN DRY FRY BROILER | CHICKEN BROILERS | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0090` | FULL CHICKEN PAN FRY BROILER | CHICKEN BROILERS | 1,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0098` | 1/2 DRY FRY CHICKEN KIENYEJI | CHICKEN KIENYEJI | 900.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0099` | 1/2 WET FRY CHICKEN KIENYEJI | CHICKEN KIENYEJI | 950.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0274` | 1/4 BOILED CHICKEN KIENYEJI | CHICKEN KIENYEJI | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0095` | 1/4 KIENYEJI CHICKEN CHOMA | CHICKEN KIENYEJI | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0097` | 1/4 KIENYEJI CHICKEN PAN FRY | CHICKEN KIENYEJI | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0096` | 1/4 KIENYEJI CHICKEN WET FRY | CHICKEN KIENYEJI | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0100` | FULL CHICKEN DRY FRY KIENYEJI | CHICKEN KIENYEJI | 1,700.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0102` | FULL CHICKEN PAN FRY KIENYEJI | CHICKEN KIENYEJI | 1,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0101` | FULL CHICKEN WET FRY KIENYEJI | CHICKEN KIENYEJI | 1,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0018` | COCKTAIL JUICE | COLD BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0016` | FRESH MILK GLASS | COLD BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0251` | KERINGET 1 LTR | COLD BEVERAGES | 120.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0250` | KERINGET 1/2 LTR | COLD BEVERAGES | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0242` | MALA | COLD BEVERAGES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0017` | MANGO JUICE | COLD BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0253` | MILK PACKET | COLD BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0022` | MILK SHAKE (SMOOTHIE) | COLD BEVERAGES | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0021` | MILK SHAKE (STRAWBERRY) | COLD BEVERAGES | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0020` | MILK SHAKE (VANILLA) | COLD BEVERAGES | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0249` | MINERAL WATER 1 LTR | COLD BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0248` | MINERAL WATER 1/2 LTR | COLD BEVERAGES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0019` | PINEAPPLE JUICE | COLD BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0252` | SODA (300ML) | COLD BEVERAGES | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0280` | STAFF GLASS MILK | COLD BEVERAGES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0262` | FRUIT PLATTER | DESSERTS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0261` | FRUIT SALAD | DESSERTS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0049` | HONEY | DESSERTS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0271` | BOILED EGGS (BROILER) | EGGS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0269` | BOILED EGGS (KIENYEJI) | EGGS | 120.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0035` | EGG SANDWICH | EGGS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0032` | FRIED EGGS (2PCS) | EGGS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0036` | SCRAMBLED EGGS (BROILER) | EGGS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0273` | SCRAMBLED EGGS KIENYEJI | EGGS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0126` | MONSTER | ENERGY DRINKS | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0118` | PREDATOR | ENERGY DRINKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0158` | REDBULL | ENERGY DRINKS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0044` | FISH COCONUT CREAM | FISH DISHES | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0043` | FISH CURRY | FISH DISHES | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0241` | FISH DRY FRY | FISH DISHES | 550.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0045` | FISH STEW | FISH DISHES | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0046` | FISH WET FRY | FISH DISHES | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0425` | PAN FRY FISH | FISH DISHES | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0160` | GILBEYS 250ML | GIN | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0161` | GILBEYS 350ML | GIN | 850.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0162` | GILBEYS 750ML | GIN | 1,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0165` | GORDONS DRY GIN 1 LTR | GIN | 3,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0163` | GORDONS DRY GIN 350ML | GIN | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0164` | GORDONS DRY GIN 750ML | GIN | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0286` | BLACK COFFEE | HOT BEVERAGES | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0010` | BLACK COFFEE FLASK (SMALL) | HOT BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0008` | BLACK COFFEE MUG | HOT BEVERAGES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0284` | BLACK TEA MEDIUM | HOT BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0282` | BLACK TEA MUG | HOT BEVERAGES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0283` | BLACK TEA SMALL FLASK | HOT BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0014` | DAWA | HOT BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0007` | GINGER TEA | HOT BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0013` | LEMON TEA BIG MUG | HOT BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0015` | PORRIDGE | HOT BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0006` | SPECIAL TEA FLASK (SMALL) | HOT BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0288` | SPECIAL TEA MEDIUM | HOT BEVERAGES | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0004` | TEA FLASK LARGE | HOT BEVERAGES | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0003` | TEA FLASK MEDIUM | HOT BEVERAGES | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0002` | TEA FLASK SMALL | HOT BEVERAGES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0005` | TEA MASALA/GINGER (LARGE) | HOT BEVERAGES | 450.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0001` | TEA MUG | HOT BEVERAGES | 40.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0012` | WHITE CHOCOLATE/MILO MUG | HOT BEVERAGES | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0011` | WHITE COFFEE FLASK SMALL | HOT BEVERAGES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0009` | WHITE COFFEE MUG | HOT BEVERAGES | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0285` | WHITE TEA MUG | HOT BEVERAGES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0245` | 1/2 MBUZI CHOMA | MUTTON | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0104` | 1/2 MBUZI WET FRY | MUTTON | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0254` | 1/4 LIVER PAN FRY | MUTTON | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0255` | 1/4 LIVER WET FRY | MUTTON | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0275` | 1/4 MBUZI BOILED | MUTTON | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0244` | 1/4 MBUZI CHOMA | MUTTON | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0103` | 1/4 MBUZI WET FRY | MUTTON | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0247` | 1KG MBUZI CHOMA | MUTTON | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0105` | 1KG MBUZI WET FRY | MUTTON | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0246` | 3/4 MBUZI CHOMA | MUTTON | 900.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0375` | MBUZI TUMBUKIZA | MUTTON | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0277` | PAN FRY MBUZI 1/2 | MUTTON | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0276` | PAN FRY MBUZI 1/4 | MUTTON | 400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0287` | PAN FRY MBUZI 1KG | MUTTON | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0240` | GLASS BREAKAGE | OTHERS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0420` | HALL HIRE | OTHERS | 1,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0426` | LEMON SLICES | OTHERS | 20.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0421` | LUNCH BUFFET | OTHERS | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0268` | MARA MOJA | OTHERS | 20.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0267` | NESCAFE | OTHERS | 20.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0238` | POOL TOKEN | OTHERS | 30.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0310` | SERVICE CHARGE | OTHERS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0311` | TAKE AWAY CUP | OTHERS | 20.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0258` | TIN | OTHERS | 20.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0418` | TRANSPORT | OTHERS | 60.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0239` | TRUST STUDDED | OTHERS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0424` | USED COOKING OIL | OTHERS | 90.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0428` | WHISKY GLASS | OTHERS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0429` | WINE GLASS | OTHERS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0264` | AMARULA 350ML | RUM & LIQUOR | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0301` | AMARULA 750ML | RUM & LIQUOR | 2,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0302` | BAILEYS 350ML | RUM & LIQUOR | 1,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0303` | BAILEYS 750ML | RUM & LIQUOR | 3,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0235` | CAMINO | RUM & LIQUOR | 5,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0232` | CAPTAIN MORGAN 250ML | RUM & LIQUOR | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0233` | CAPTAIN MORGAN 750ML | RUM & LIQUOR | 1,300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0281` | V&A | RUM & LIQUOR | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0047` | KACHUMBARI | SALADS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0048` | SALADS | SALADS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0054` | BHAJIA | SNACKS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0320` | BREAD ROLL 2PCS | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0423` | BREAKFAST | SNACKS | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0025` | CHAPATI (BROWN) | SNACKS | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0024` | CHAPATI (WHITE) | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0034` | CHAPATI ROLL | SNACKS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0038` | CHICKEN SANDWICH | SNACKS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0318` | COOKIES 2PCS | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0042` | CORN FLAKES | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0027` | DOUGHNUT | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0031` | KEBAB | SNACKS | 80.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0040` | KEBAB SPECIAL | SNACKS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0026` | MAHAMRI | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0023` | MANDAZI (3PCS) | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0315` | MARBLE CAKE | SNACKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0033` | MAYAI FRIED (KIENYEJI) | SNACKS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0030` | PANCAKE (1 PAIR) | SNACKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0028` | SAMOSA | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0029` | SAUSAGE | SNACKS | 60.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0319` | SCONES 2PCS | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0317` | SMOKIES | SNACKS | 60.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0037` | SPANISH OMELETTE (BROILER) | SNACKS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0270` | SPANISH OMELETTE (KIENYEJI) | SNACKS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0406` | TEA AND SNACKS | SNACKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0316` | TEA SCONE | SNACKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0155` | ALVARO | SOFT DRINKS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0122` | DASANI 1 LTR | SOFT DRINKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0121` | DASANI 500ML | SOFT DRINKS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0159` | DELMONTE | SOFT DRINKS | 350.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0124` | KERINGET WATER 1 LTR | SOFT DRINKS | 120.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0123` | KERINGET WATER 500ML | SOFT DRINKS | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0128` | LIME LEMONADE | SOFT DRINKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0125` | MINUTE MAID | SOFT DRINKS | 120.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0120` | NOVIDA | SOFT DRINKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0116` | SODA 300ML | SOFT DRINKS | 70.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0117` | SODA 500ML | SOFT DRINKS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0127` | TONIC SODA | SOFT DRINKS | 120.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0051` | BEEF STOCK SOUP | SOUPS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0053` | BONE MARROW SOUP PLAIN | SOUPS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0052` | CLEAR SOUP | SOUPS | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0257` | SOUP CHAPATI 2PCS | SOUPS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0260` | SOUP SPECIAL | SOUPS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0050` | TOMATO SOUP | SOUPS | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0313` | CABBAGE MIX SPECIAL | SPECIALS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0309` | CHAPATI SPECIAL 1PC | SPECIALS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0419` | GITHERI SPECIAL | SPECIALS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0055` | MARU BHAJIA | SPECIALS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0427` | MAYAI SPECIAL | SPECIALS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0057` | NAAN BREAD | SPECIALS | 80.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0078` | PILAU SPECIAL | SPECIALS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0077` | RICE SPECIAL | SPECIALS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0039` | SAMOSA SPECIAL | SPECIALS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0041` | SAUSAGE SPECIAL | SPECIALS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0080` | SPAGHETTI | SPECIALS | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0289` | SUKUMA MIX SPECIAL | SPECIALS | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0056` | VEGETABLE CURRY | SPECIALS | 300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0177` | KC 250ML | SPIRITS | 450.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0178` | KC 350ML | SPIRITS | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0179` | KC 750ML | SPIRITS | 1,100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0237` | CAMINO TOT | TOTS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0236` | JAGERMEISTER TOT | TOTS | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0065` | CABBAGE MIX | VEGETABLES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0064` | CABBAGE PLAIN | VEGETABLES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0066` | CABBAGE SPECIAL | VEGETABLES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0060` | MANAGU MIX | VEGETABLES | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0061` | MANAGU MIX SPECIAL | VEGETABLES | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0058` | MANAGU PLAIN | VEGETABLES | 100.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0059` | MANAGU SPECIAL PLAIN | VEGETABLES | 200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0072` | MASHED POTATOES | VEGETABLES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0067` | MINJI PLAIN | VEGETABLES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0068` | MIX VEGES | VEGETABLES | 250.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0063` | SUKUMA MIX | VEGETABLES | 150.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-RES-0062` | SUKUMA WIKI PLAIN | VEGETABLES | 50.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0312` | VODKA 1 LTR | VODKA | 2,300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0174` | VODKA 250ML | VODKA | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0175` | VODKA 350ML | VODKA | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0176` | VODKA 750ML | VODKA | 1,600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0263` | ALL SEASONS | WHISKY | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0217` | BEST WHISKY 250ML | WHISKY | 500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0218` | BEST WHISKY 750ML | WHISKY | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0212` | BLACK & WHITE 350ML | WHISKY | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0213` | BLACK & WHITE 750ML | WHISKY | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0194` | BOND 7 250ML | WHISKY | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0195` | BOND 7 350ML | WHISKY | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0196` | BOND 7 750ML | WHISKY | 1,700.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0300` | BULLEIT BOURBON | WHISKY | 5,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0307` | DOUBLE BLACK 1 LTR | WHISKY | 7,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0197` | FAMOUS GROUSE | WHISKY | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0198` | GLENFIDICH 12 YRS | WHISKY | 8,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0199` | GLENFIDICH 15 YRS | WHISKY | 12,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0200` | GLENFIDICH 18 YRS | WHISKY | 17,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0211` | GRANTS 1 LTR | WHISKY | 3,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0209` | GRANTS 350ML | WHISKY | 1,600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0210` | GRANTS 750ML | WHISKY | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0204` | HENNESY 1 LTR | WHISKY | 13,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0203` | HENNESY 700ML | WHISKY | 7,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0214` | HUNTERS 250ML | WHISKY | 600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0215` | HUNTERS 350ML | WHISKY | 800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0216` | HUNTERS 750ML | WHISKY | 1,300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0193` | J. WALKER BLACK 1 LTR | WHISKY | 5,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0190` | J. WALKER BLACK 250ML | WHISKY | 1,300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0191` | J. WALKER BLACK 350ML | WHISKY | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0192` | J. WALKER BLACK 750ML | WHISKY | 4,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0417` | J. WALKER BLONDE | WHISKY | 4,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0189` | J. WALKER RED 1 LTR | WHISKY | 3,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0186` | J. WALKER RED 250ML | WHISKY | 1,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0187` | J. WALKER RED 350ML | WHISKY | 1,700.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0188` | J. WALKER RED 750ML | WHISKY | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0207` | JACK DANIELS 1 LTR | WHISKY | 6,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0205` | JACK DANIELS 350ML | WHISKY | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0206` | JACK DANIELS 750ML | WHISKY | 4,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0183` | JAMESON 1 LTR | WHISKY | 4,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0181` | JAMESON 350ML | WHISKY | 1,600.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0182` | JAMESON 750ML | WHISKY | 3,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0201` | MARTEL 750ML | WHISKY | 8,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0202` | MARTEL VSOP | WHISKY | 12,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0422` | SINGLETON 12 YRS | WHISKY | 5,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0180` | SOUTHERN COMFORT | WHISKY | 3,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0184` | VAT 69 350ML | WHISKY | 1,000.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0185` | VAT 69 750ML | WHISKY | 1,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0413` | WILLIAM LAWSONS 1 LTR | WHISKY | 2,500.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0208` | WILLIAM LAWSONS 750ML | WHISKY | 2,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0219` | 4TH STREET RED | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0220` | 4TH STREET WHITE | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0231` | ASCONI | WINES | 2,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0225` | CAPRICE RED | WINES | 1,300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0226` | CAPRICE WHITE | WINES | 1,300.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0227` | CASABUENA RED | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0228` | CASABUENA WHITE | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0222` | CELLAR CASK RED | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0221` | CELLAR CASK WHITE | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0223` | DROSDTY HOF RED | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0224` | DROSDTY HOF WHITE | WINES | 1,200.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0229` | FOUR COUSINS RED | WINES | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0230` | FOUR COUSINS WHITE | WINES | 1,400.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0166` | NUDEBURG | WINES | 2,800.00 | 0.00 | ✓ | MOGOGOSHIEK |
| `MOG-BAR-0401` | ROBERTSON | WINES | 1,700.00 | 0.00 | ✓ | MOGOGOSHIEK |

## ⚠️ Misplaced POS Items Inside simple_items

**181 items** in `simple_items` belong to POS-only categories
(KITCHEN MENU, PASTRY, food, FOOD, beverage, soft drinks).
These are managed via `restaurant_menu_items` and should be **removed from the stock catalog**.

| SKU | Item Name | Category | Branch |
|-----|-----------|----------|--------|
| `FGH-FOOD-FRESHM-0001` | Fresh Milk | food | global |
| `FGH-FOOD-KENTAS-0001` | KENTASTE COCONUT OIL | food | global |
| `FGH-FOOD-SPAGHE-0001` | SPAGHETTI | food | global |
| `FGB-STK-BRC-0002` | KENTASTE COCONUT OIL | FOOD | global |
| `FGB-STK-BEV-0012` | LIGHT SOY SAUCE | FOOD | global |
| `FG-414` | SPAGETTI | FOOD | global |
| `FGH-CHB-0012` | 1 Kg Chicken Dry Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0006` | 1 Kg Chicken Pan Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0003` | 1 Kg Chicken Wet Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0011` | 1/2 Kg Chicken Dry Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0005` | 1/2 Kg Chicken Pan Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0002` | 1/2 Kg Chicken Wet Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0011` | 1/2 Kg Kuku Kienyeji Dry Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0005` | 1/2 Kg Kuku Kienyeji Pan Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0002` | 1/2 Kg Kuku Kienyeji Wet Fry | KITCHEN MENU | BOMET TOWN |
| `MENU-797692d9-1146-4c86-b348-fe3774a733f1` | 1/4 Kg Chicken Dry Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0004` | 1/4 Kg Chicken Pan Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0001` | 1/4 Kg Chicken Wet Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-CHB-0010` | 1/4 Kg Kienyeji Chicken Boiled | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0010` | 1/4 Kg Kuku Kienyeji Dry Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0004` | 1/4 Kg Kuku Kienyeji Pan Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0001` | 1/4 Kg Kuku Kienyeji Wet Fry | KITCHEN MENU | BOMET TOWN |
| `MENU-36d1b188-928d-40d6-86d1-b50a992fd9a0` | 20 Litre Container | KITCHEN MENU | BOMET TOWN |
| `FGH-BSD-0004` | Banana 2 Pieces | KITCHEN MENU | BOMET TOWN |
| `MENU-71b4c3b0-288c-4efb-bfc7-021b203bc2e4` | Beans | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0005` | Beef Pan Fry 1 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0004` | Beef Pan Fry 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0003` | Beef Pan Fry 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0002` | Beef Stew 1 Kg | KITCHEN MENU | BOMET TOWN |
| `MENU-c89e6e19-0b4c-489b-9688-02fa6c2c90ae` | Beef Stew 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0001` | Beef Stew 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0008` | Beef Wet Fry 1 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0007` | Beef Wet Fry 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-BEF-0006` | Beef Wet Fry 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `MENU-79eebd8c-8969-431e-a8f7-49defee12b7a` | Bhajia | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0016` | Black Coffee | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0003` | Black Tea | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0005` | Boiled Eggs Broiler | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0006` | Boiled Eggs Kienyeji | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0004` | Brown Chapati | KITCHEN MENU | BOMET TOWN |
| `FGH-FST-0007` | Burger | KITCHEN MENU | BOMET TOWN |
| `MENU-5f348f46-12d2-4caa-bebe-5d2a0f67399c` | Cabbage Mixed | KITCHEN MENU | BOMET TOWN |
| `MENU-7bcf03d1-b7ed-434c-83a3-aa34653ece71` | Cabbage Plain | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0003` | Chapati | KITCHEN MENU | BOMET TOWN |
| `FGH-SWR-0003` | Chapati Roll Broiler | KITCHEN MENU | BOMET TOWN |
| `FGH-SWR-0004` | Chapati Roll Kienyeji | KITCHEN MENU | BOMET TOWN |
| `FGH-FST-0001` | Chips | KITCHEN MENU | BOMET TOWN |
| `FGH-FST-0005` | Chips Gizzard | KITCHEN MENU | BOMET TOWN |
| `FGH-FST-0006` | Chips Liver | KITCHEN MENU | BOMET TOWN |
| `MENU-3a25aaf6-80b3-484e-8936-017c6e07013f` | Chips Masala | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0017` | Chocolate / Milo | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0010` | Cocoa | KITCHEN MENU | BOMET TOWN |
| `MENU-cb48a0e0-8aea-460a-a9d1-2f0fbd2bce0a` | Coffee Cup | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0013` | Cookies Pair | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0010` | Corn Flakes | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0009` | Dawa | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0010` | Delmonte Juice 1 Litre | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0008` | Dried Chapati | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0009` | Egg Fry Macho | KITCHEN MENU | BOMET TOWN |
| `FGH-SWR-0001` | Egg Sandwich | KITCHEN MENU | BOMET TOWN |
| `FGH-BRK-0001` | FG Breakfast | KITCHEN MENU | BOMET TOWN |
| `FGH-BRK-0002` | FG Special | KITCHEN MENU | BOMET TOWN |
| `FGH-FSH-0001` | Fish Dry Whole | KITCHEN MENU | BOMET TOWN |
| `FGH-FSH-0002` | Fish Wet Whole | KITCHEN MENU | BOMET TOWN |
| `FGH-SWR-0005` | French Toast | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0011` | Fresh Juice Passion/Mango | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0005` | Fresh Milk Glass | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0007` | Fried Eggs Broiler | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0008` | Fried Eggs Kienyeji | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0012` | Full Kuku Kienyeji Dry Fry | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0006` | Full Kuku Kienyeji Pan Fry | KITCHEN MENU | BOMET TOWN |
| `MENU-00b69d3b-1829-453c-8aa5-53109fd90bad` | Garlic Chips | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0008` | Ginger Tea | KITCHEN MENU | BOMET TOWN |
| `MENU-96b1112c-12ba-402c-8fa3-181a1289853b` | Githeri | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0012` | Half Cake | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0007` | Honey Plain | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0012` | Hot Lemon | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0007` | KCC Mala | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0006` | KCC Milk Packet | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0017` | Kebab | KITCHEN MENU | BOMET TOWN |
| `FGH-KUK-0003` | Kuku Kienyeji Wet Fry FULL | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0006` | Lemon Coffee Honey | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0004` | Lemon Tea | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0005` | Lemon Tea Honey | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0001` | Mahamri | KITCHEN MENU | BOMET TOWN |
| `MENU-d4e8a5eb-b27d-427b-9841-6bec2971d290` | Managu Mixed | KITCHEN MENU | BOMET TOWN |
| `MENU-84ac0dab-a119-484b-b476-a5a9a9962133` | Managu Plain | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0011` | Marble Cake | KITCHEN MENU | BOMET TOWN |
| `MENU-032e785f-4334-481a-82c0-a542ae0fce32` | Mashed Potatoes | KITCHEN MENU | BOMET TOWN |
| `MENU-83899057-ec37-450d-8e9e-4935237dbcd7` | Matoke | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0012` | Mbuzi Boiled 1 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0011` | Mbuzi Boiled 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0010` | Mbuzi Boiled 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0009` | Mbuzi Choma 1 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0008` | Mbuzi Choma 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0007` | Mbuzi Choma 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0006` | Mbuzi Pan Fry 1 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0005` | Mbuzi Pan Fry 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0004` | Mbuzi Pan Fry 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0003` | Mbuzi Wet Fry 1 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0002` | Mbuzi Wet Fry 1/2 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-MBZ-0001` | Mbuzi Wet Fry 1/4 Kg | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0012` | Milk Shake | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0009` | Minute Maid 500ml | KITCHEN MENU | BOMET TOWN |
| `MENU-97eed7f9-e5ae-42ad-9779-e89caf4a1fab` | Mixed Veg | KITCHEN MENU | BOMET TOWN |
| `MENU-ab60542e-924c-4cfc-99a5-d1fbe637f700` | Mokimo | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0008` | Mursik Glass | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0002` | Ndazi | KITCHEN MENU | BOMET TOWN |
| `FGH-BSD-0003` | Nduma | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0007` | Pancake | KITCHEN MENU | BOMET TOWN |
| `MENU-ad0ec5a8-e5f8-4a1f-8c7e-10a4f4c0dac4` | Peas Miji | KITCHEN MENU | BOMET TOWN |
| `MENU-567129d9-2756-4400-9138-aebeedff03be` | Pilau | KITCHEN MENU | BOMET TOWN |
| `FGH-PLT-0001` | Platter For 2 | KITCHEN MENU | BOMET TOWN |
| `FGH-PLT-0002` | Platter For 4 | KITCHEN MENU | BOMET TOWN |
| `FGH-PLT-0003` | Platter For 6 | KITCHEN MENU | BOMET TOWN |
| `FGH-PLT-0004` | Platter For 9 | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0010` | Poached Eggs | KITCHEN MENU | BOMET TOWN |
| `FGH-BSD-0001` | Porridge | KITCHEN MENU | BOMET TOWN |
| `MENU-c32bc4eb-3b3c-431b-91dc-406f30026c33` | Potato Wedges | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0015` | Queen Cakes | KITCHEN MENU | BOMET TOWN |
| `MENU-3ca0c9db-f527-48f4-bfd0-9d0baa23906a` | Rice Plain | KITCHEN MENU | BOMET TOWN |
| `MENU-6c395b7a-2ea3-4b50-90a5-e7be98c34354` | Roast Potatoes | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0005` | Samosa | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0006` | Sausage | KITCHEN MENU | BOMET TOWN |
| `MENU-2d48e94a-4323-4449-8bc6-5af685dad747` | Saute Potatoes | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0014` | Scones | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0002` | Scrambled Eggs Broiler | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0001` | Scrambled Eggs Kienyeji | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0013` | Smoothies | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0001` | Soda 300ml | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0002` | Soda 300ml Take Away | KITCHEN MENU | BOMET TOWN |
| `MENU-daa046f2-fbcc-4333-8802-9830644103ec` | Spaghetti Bolognalae | KITCHEN MENU | BOMET TOWN |
| `MENU-1235a28d-cac7-4eed-a5d1-a5842657d587` | Spaghetti Napolitan | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0004` | Spanish Omelette Broiler | KITCHEN MENU | BOMET TOWN |
| `FGH-EGD-0003` | Spanish Omelette Kienyeji | KITCHEN MENU | BOMET TOWN |
| `MENU-72e13ecc-a28c-4441-b2f8-0fe13e232cfe` | Special Cabbage | KITCHEN MENU | BOMET TOWN |
| `MENU-a0c97bba-5472-4091-99b8-ae7da0eba286` | Special Chicken | KITCHEN MENU | BOMET TOWN |
| `MENU-7c8c778f-4d7b-469d-b5c4-a807306e3d92` | Special Githeri | KITCHEN MENU | BOMET TOWN |
| `MENU-64f2df66-d9a8-481f-b715-d21cc725a77b` | Special Kebab | KITCHEN MENU | BOMET TOWN |
| `MENU-1e478299-1a83-4024-ad28-45ad4a6e9a9d` | Special Managu | KITCHEN MENU | BOMET TOWN |
| `MENU-10f37d06-71fa-4e76-8061-1c743dd8c49f` | Special Mayai | KITCHEN MENU | BOMET TOWN |
| `MENU-599af8b0-60cf-487d-bb58-132e6dc24f64` | Special Mix Managu | KITCHEN MENU | BOMET TOWN |
| `MENU-73e5f78d-35a6-4a0e-a655-77b60b2a5d01` | Special Pilau | KITCHEN MENU | BOMET TOWN |
| `MENU-e40c8658-a434-4535-bd5e-5807c5a118bd` | Special Samosa | KITCHEN MENU | BOMET TOWN |
| `MENU-1fbd380f-abe2-466b-8a15-5bc2ca69efa5` | Special Sausage | KITCHEN MENU | BOMET TOWN |
| `MENU-0b9a60e7-c84c-4ae0-90f2-61944032f83b` | Special Sukuma | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0013` | Special Tea | KITCHEN MENU | BOMET TOWN |
| `MENU-9c1e74a2-c183-45d5-962b-e9b8b7276197` | Sukuma Mixed | KITCHEN MENU | BOMET TOWN |
| `MENU-83b5c8a6-a1bf-4dbd-af0b-38ff60c1e502` | Sukuma Plain | KITCHEN MENU | BOMET TOWN |
| `FGH-BSD-0002` | Sweet Potatoes | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0011` | Tea Masala | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0001` | Tea Mug | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0002` | Tea Pot | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0016` | Tea Scones 2 Pieces | KITCHEN MENU | BOMET TOWN |
| `MENU-37d93f18-2e99-407f-9bfb-84ad3087d21c` | Tins | KITCHEN MENU | BOMET TOWN |
| `FGH-SNP-0009` | Toasted Bread | KITCHEN MENU | BOMET TOWN |
| `MENU-a49f3c09-5410-4b5b-b959-269a9893fdfa` | Ugali Brown | KITCHEN MENU | BOMET TOWN |
| `MENU-37f9f25d-e9c1-48a0-ba9d-a7b469c4f5ff` | Ugali White | KITCHEN MENU | BOMET TOWN |
| `FGH-SWR-0002` | Vegetable Sandwich | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0004` | Water 1L | KITCHEN MENU | BOMET TOWN |
| `FGH-CBV-0003` | Water 500ml | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0015` | White Coffee | KITCHEN MENU | BOMET TOWN |
| `FGH-HBV-0014` | White Tea | KITCHEN MENU | BOMET TOWN |
| `FG-PSTRY-015` | Bread 600grams | PASTRY | global |
| `FG-PSTRY-016` | Bread 700grams | PASTRY | global |
| `FG-PSTRY-009` | Bread Roll | PASTRY | global |
| `FG-PSTRY-002` | Brown Chapati | PASTRY | global |
| `FG-PSTRY-013` | Cookies | PASTRY | global |
| `FG-PSTRY-012` | Croissant | PASTRY | global |
| `FG-PSTRY-006` | Doughnut | PASTRY | global |
| `FG-PSTRY-017` | Kebab | PASTRY | global |
| `FG-PSTRY-007` | Mahamri | PASTRY | global |
| `FG-PSTRY-018` | Mandazi Bites | PASTRY | global |
| `FG-PSTRY-001` | Marble Cake | PASTRY | global |
| `FG-PSTRY-004` | Ndazi | PASTRY | global |
| `FG-PSTRY-014` | Queen Cakes | PASTRY | global |
| `FG-PSTRY-005` | Samosa | PASTRY | global |
| `FG-PSTRY-008` | Sausage Roll | PASTRY | global |
| `FG-PSTRY-010` | Scones | PASTRY | global |
| `FG-PSTRY-011` | Tea Scones | PASTRY | global |
| `FG-PSTRY-003` | White Chapati | PASTRY | global |

## Central Stock Catalog (simple_items — Real Inventory Only)

### By Category

| Category | Count |
|----------|------:|
| DRY GOODS | 218 |
| BAR DRINKS | 162 |
| WHISKY | 60 |
| SPIRITS | 27 |
| BEERS | 22 |
| WINES | 22 |
| SOFT DRINKS | 18 |
| CANNED BEERS | 16 |
| GIN | 9 |
| CLEANING MATERIALS | 6 |
| COGNAC | 6 |
| LIQUERS | 6 |
| VODKA | 4 |
| CONDOM | 3 |
| ENERGY DRINKS | 3 |
| TOTS | 2 |
| beverage | 1 |
| NON CONSUMABLES | 1 |
| soft drinks | 1 |

### By Store Type

| Store Type | Count |
|------------|------:|
| foodstuffs | 230 |
| bar_store | 193 |
| (unknown) | 162 |
| non_consumables | 2 |

### Name Duplicates in Stock Catalog

**16** item names appear under 2+ SKUs:

#### "Coke Zero"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-BEV-0003` | BAR DRINKS | bottle | 0.00 | 100.00 | 0.00 |  | global |
| `FG-445` | SOFT DRINKS | pcs | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "Guarana"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-CAN-0005` | BAR DRINKS | can | 175.96 | 250.00 | 1,000.00 |  | BOMET TOWN |
| `FG-450` | BEERS | crate | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "Jager Tot"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-WIN-0012` | BAR DRINKS | tot | 0.00 | 200.00 | 0.00 |  | global |
| `FG-452` | TOTS | pcs | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "KC pineapple 750ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGH-BEV-KCPINE-0001` | beverage | bottle | 0.00 | 0.00 | 1,000.00 | foodstuffs | global |
| `FG-430` | WHISKY | bottle | 0.00 | 0.00 | 15.00 | bar_store | global |

#### "Minute Maid"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-BEV-0007` | BAR DRINKS | bottle | 0.00 | 100.00 | 0.00 |  | global |
| `FG-447` | SOFT DRINKS | pcs | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "Novida"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-BEV-0004` | BAR DRINKS | bottle | 0.00 | 80.00 | 0.00 |  | global |
| `FG-446` | SOFT DRINKS | pcs | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "Predator"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-BEV-0008` | BAR DRINKS | bottle | 0.00 | 100.00 | 0.00 |  | global |
| `FG-448` | SOFT DRINKS | pcs | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "Soda 300ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-BEV-0001` | BAR DRINKS | bottle | 0.00 | 70.00 | 0.00 |  | global |
| `FG-420` | SOFT DRINKS | pcs | 31.00 | 31.00 | 954.00 | bar_store | global |

#### "Soda 500ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-SDR-0001` | BAR DRINKS | bottle | 50.00 | 100.00 | 1,000.00 |  | BOMET TOWN |
| `FGB-STK-BEV-0002` | BAR DRINKS | bottle | 0.00 | 100.00 | 0.00 |  | global |

#### "Tonic Soda"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-BEV-0010` | BAR DRINKS | bottle | 0.00 | 120.00 | 0.00 |  | global |
| `FG-449` | SOFT DRINKS | pcs | 0.00 | 0.00 | 0.00 | bar_store | global |

#### "V&A 250ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-WHK-0041` | BAR DRINKS | bottle | 310.00 | 400.00 | 996.00 |  | BOMET TOWN |
| `FG-381` | SPIRITS | pcs | 296.00 | 296.00 | 4.00 | bar_store | global |

#### "V&A 750ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-WHK-0042` | BAR DRINKS | bottle | 803.00 | 1,200.00 | 1,000.00 |  | BOMET TOWN |
| `FG-304` | SPIRITS | pcs | 768.00 | 768.00 | 1.00 | bar_store | global |

#### "Vodka 250ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-VOD-0001` | BAR DRINKS | bottle | 0.00 | 600.00 | 0.00 |  | global |
| `FG-232` | VODKA | pcs | 416.00 | 416.00 | 6.00 | bar_store | global |

#### "Vodka 350ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-STK-VOD-0002` | BAR DRINKS | bottle | 0.00 | 800.00 | 0.00 |  | global |
| `FG-233` | VODKA | pcs | 576.00 | 576.00 | 0.00 | bar_store | global |

#### "Water 1L"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FGB-SDR-0002` | BAR DRINKS | bottle | 42.00 | 100.00 | 1,000.00 |  | BOMET TOWN |
| `FG-417` | SOFT DRINKS | pcs | 41.00 | 41.00 | 1,000.00 | bar_store | global |

#### "Water 500ml"

| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |
|-----|----------|------|-----:|-------:|----:|------------|--------|
| `FG-70` | DRY GOODS | pcs | 21.00 | 41.00 | 1,000.00 | foodstuffs | global |
| `FG-418` | SOFT DRINKS | pcs | 21.00 | 21.00 | 1,000.00 | bar_store | global |

### Category Name Case Mismatches

| Variants | Total Items |
|----------|------------:|
| `soft drinks` / `SOFT DRINKS` | 19 |

### Full Stock Item Listing

> Real inventory only — POS-only categories excluded

#### BAR DRINKS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `MOG-BAR-0219` | 4TH STREET RED | each | 0.00 | 1,200.00 | 0.00 |  |
| `MOG-BAR-0220` | 4TH STREET WHITE | each | 0.00 | 1,200.00 | 0.00 |  |
| `MOG-BAR-0263` | ALL SEASONS | each | 0.00 | 1,400.00 | 0.00 |  |
| `FGB-STK-WHK-0032` | All Seasons 3/4 | bottle | 0.00 | 1,400.00 | 0.00 |  |
| `FGB-STK-MIX-0003` | Alvaro | can | 0.00 | 200.00 | 0.00 |  |
| `FGB-STK-CRM-0001` | Amarula 1/2 | bottle | 0.00 | 1,800.00 | 0.00 |  |
| `FGB-WIN-0008` | Amarula 350ml *(BOMET TOWN)* | bottle | 1,173.00 | 1,600.00 | 1,000.00 |  |
| `FGB-STK-CRM-0002` | Amarula 750 ml | bottle | 0.00 | 3,000.00 | 0.00 |  |
| `FGB-WIN-0009` | Amarula 750ml *(BOMET TOWN)* | bottle | 2,086.00 | 2,500.00 | 996.00 |  |
| `FGB-STK-WIN-0008` | Asconi 750 ml | bottle | 0.00 | 2,000.00 | 0.00 |  |
| `FGB-STK-BTL-0010` | B. Ice | bottle | 0.00 | 250.00 | 0.00 |  |
| `FGB-STK-CRM-0004` | Baileys 1/2 | bottle | 0.00 | 1,800.00 | 0.00 |  |
| `FGB-STK-CRM-0005` | Baileys 750 ml | bottle | 0.00 | 3,000.00 | 0.00 |  |
| `FGB-STK-CRM-0003` | Best Cream | bottle | 0.00 | 1,400.00 | 0.00 |  |
| `FGB-STK-WHK-0018` | Best Whisky 1/4 | bottle | 0.00 | 500.00 | 0.00 |  |
| `FGB-STK-WHK-0019` | Best Whisky 3/4 | bottle | 0.00 | 1,400.00 | 0.00 |  |
| `FGB-STK-WHK-0038` | Black & White 1/2 | bottle | 0.00 | 800.00 | 0.00 |  |
| `FGB-STK-WHK-0039` | Black & White 3/4 | bottle | 0.00 | 1,500.00 | 0.00 |  |
| `FGB-STK-WHK-0016` | Bond 7 1/2 | bottle | 0.00 | 800.00 | 0.00 |  |
| `FGB-STK-WHK-0015` | Bond 7 1/4 | bottle | 0.00 | 600.00 | 0.00 |  |
| `FGB-STK-WHK-0017` | Bond 7 3/4 | bottle | 0.00 | 0.00 | 0.00 |  |
| `FGB-OTH-0004` | Bulleit Bourbon *(BOMET TOWN)* | bottle | 3,167.00 | 5,000.00 | 1,000.00 |  |
| `FGB-OTH-0001` | Camino *(BOMET TOWN)* | bottle | 2,000.00 | 4,000.00 | 1,000.00 |  |
| `MOG-BAR-0225` | CAPRICE RED | each | 0.00 | 0.00 | 0.00 |  |
| `MOG-BAR-0226` | CAPRICE WHITE | each | 0.00 | 0.00 | 0.00 |  |
| `FGB-STK-WIN-0009` | Casabuena 1 Ltr | bottle | 0.00 | 1,300.00 | 0.00 |  |
| `MOG-BAR-0227` | CASABUENA RED | each | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-WIN-0004` | Casabuena Sangaria *(BOMET TOWN)* | bottle | 712.00 | 1,100.00 | 997.00 |  |
| `MOG-BAR-0228` | CASABUENA WHITE | each | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-STK-WIN-0002` | Cellar Cask | bottle | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-STK-WIN-0004` | Chamdor 3/4 | bottle | 0.00 | 1,000.00 | 0.00 |  |
| `FGB-STK-BEV-0003` | Coke Zero | bottle | 0.00 | 100.00 | 0.00 |  |
| `FGB-STK-BEV-0006` | Dasani 1 Ltr | bottle | 0.00 | 100.00 | 0.00 |  |
| `FGB-STK-BEV-0005` | Dasani 1/2 | bottle | 0.00 | 50.00 | 0.00 |  |
| `MOG-BAR-0121` | DASANI 500ML | each | 0.00 | 50.00 | 0.00 |  |
| `FGB-STK-MIX-0007` | Delmonte | bottle | 0.00 | 350.00 | 0.00 |  |
| `FGB-BER-0011` | Desperado *(BOMET TOWN)* | bottle | 285.00 | 350.00 | 996.00 |  |
| `FGB-STK-WHK-0031` | Double Black 1 Ltr | bottle | 0.00 | 7,000.00 | 0.00 |  |
| `FGB-COG-0002` | Double Black 1L *(BOMET TOWN)* | bottle | 5,875.00 | 7,500.00 | 1,000.00 |  |
| `FGB-STK-WHK-0030` | Double Black 750 ml | bottle | 0.00 | 5,800.00 | 0.00 |  |
| `MOG-BAR-0223` | DROSDTY HOF RED | each | 0.00 | 1,200.00 | 0.00 |  |
| `MOG-BAR-0224` | DROSDTY HOF WHITE | each | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-STK-WIN-0003` | Drostdy-Hof | bottle | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-WHK-0037` | Famous Grouse *(BOMET TOWN)* | bottle | 1,750.00 | 2,500.00 | 1,000.00 |  |
| `FGB-STK-CAN-0011` | FAXE | can | 0.00 | 0.00 | 0.00 |  |
| `FGB-STK-WIN-0006` | Four Cousins | bottle | 0.00 | 1,400.00 | 0.00 |  |
| `FGB-STK-GIN-0002` | Gilbeys Gin 1/2 | bottle | 0.00 | 800.00 | 0.00 |  |
| `FGB-STK-GIN-0001` | Gilbeys Gin 1/4 | bottle | 0.00 | 600.00 | 0.00 |  |
| `FGB-STK-GIN-0003` | Gilbeys Gin 750 ml | bottle | 0.00 | 1,700.00 | 0.00 |  |
| `FGB-STK-WHK-0021` | Glenfiddich 12 Yrs | bottle | 0.00 | 7,500.00 | 0.00 |  |
| `FGB-STK-WHK-0022` | Glenfiddich 15 Yrs | bottle | 0.00 | 7,500.00 | 0.00 |  |
| `MOG-BAR-0198` | GLENFIDICH 12 YRS | each | 0.00 | 8,500.00 | 0.00 |  |
| `MOG-BAR-0199` | GLENFIDICH 15 YRS | each | 0.00 | 12,000.00 | 0.00 |  |
| `MOG-BAR-0200` | GLENFIDICH 18 YRS | each | 0.00 | 17,500.00 | 0.00 |  |
| `FGB-CAN-0012` | Gordons Can *(BOMET TOWN)* | can | 175.96 | 300.00 | 1,000.00 |  |
| `MOG-BAR-0165` | GORDONS DRY GIN 1 LTR | each | 0.00 | 3,200.00 | 0.00 |  |
| `MOG-BAR-0163` | GORDONS DRY GIN 350ML | each | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-STK-GIN-0005` | Gordons Dry Gin 750 ml | bottle | 0.00 | 2,500.00 | 0.00 |  |
| `MOG-BAR-0164` | GORDONS DRY GIN 750ML | each | 0.00 | 2,500.00 | 0.00 |  |
| `FGB-STK-WHK-0035` | Grants 1/2 | bottle | 0.00 | 1,600.00 | 0.00 |  |
| `FGB-STK-WHK-0036` | Grants 3/4 | bottle | 0.00 | 2,500.00 | 0.00 |  |
| `FGB-CAN-0005` | Guarana *(BOMET TOWN)* | can | 175.96 | 250.00 | 1,000.00 |  |
| `FGB-CAN-0010` | Guarana Punch *(BOMET TOWN)* | can | 175.96 | 250.00 | 1,000.00 |  |
| `FGB-BER-0005` | Guiness *(BOMET TOWN)* | bottle | 204.00 | 300.00 | 1,000.00 |  |
| `FGB-CAN-0001` | Guiness Can *(BOMET TOWN)* | can | 216.71 | 300.00 | 1,000.00 |  |
| `FGB-STK-WHK-0023` | Hennessy | bottle | 0.00 | 7,500.00 | 0.00 |  |
| `FGB-COG-0001` | Hennessy 750ml *(BOMET TOWN)* | bottle | 4,600.00 | 6,500.00 | 1,000.00 |  |
| `FGB-STK-WHK-0024` | Hennessy VSOP | bottle | 0.00 | 8,500.00 | 0.00 |  |
| `MOG-BAR-0204` | HENNESY 1 LTR | each | 0.00 | 13,500.00 | 0.00 |  |
| `MOG-BAR-0203` | HENNESY 700ML | each | 0.00 | 7,500.00 | 0.00 |  |
| `FGB-WHK-0019` | Hunters 250ml *(BOMET TOWN)* | bottle | 306.00 | 306.00 | 994.00 |  |
| `FGB-WHK-0020` | Hunters 350ml *(BOMET TOWN)* | bottle | 443.00 | 443.00 | 999.00 |  |
| `FGB-WHK-0021` | Hunters 750ml *(BOMET TOWN)* | bottle | 938.00 | 938.00 | 1,000.00 |  |
| `FGB-BER-0012` | Hunters Beer *(BOMET TOWN)* | bottle | 203.00 | 203.00 | 1,000.00 |  |
| `MOG-BAR-0153` | HUNTERS GOLD | each | 0.00 | 0.00 | 0.00 |  |
| `MOG-BAR-0193` | J. WALKER BLACK 1 LTR | each | 0.00 | 5,500.00 | 0.00 |  |
| `MOG-BAR-0190` | J. WALKER BLACK 250ML | each | 0.00 | 1,300.00 | 0.00 |  |
| `MOG-BAR-0191` | J. WALKER BLACK 350ML | each | 0.00 | 2,500.00 | 0.00 |  |
| `MOG-BAR-0192` | J. WALKER BLACK 750ML | each | 0.00 | 4,500.00 | 0.00 |  |
| `MOG-BAR-0417` | J. WALKER BLONDE | each | 0.00 | 4,000.00 | 0.00 |  |
| `MOG-BAR-0189` | J. WALKER RED 1 LTR | each | 0.00 | 3,000.00 | 0.00 |  |
| `MOG-BAR-0186` | J. WALKER RED 250ML | each | 0.00 | 1,000.00 | 0.00 |  |
| `MOG-BAR-0187` | J. WALKER RED 350ML | each | 0.00 | 1,700.00 | 0.00 |  |
| `MOG-BAR-0188` | J. WALKER RED 750ML | each | 0.00 | 2,500.00 | 0.00 |  |
| `FGB-STK-WHK-0012` | J.W Black 1 Ltr | bottle | 0.00 | 5,500.00 | 0.00 |  |
| `FGB-STK-WHK-0010` | J.W Black 1/2 | bottle | 0.00 | 2,200.00 | 0.00 |  |
| `FGB-STK-WHK-0009` | J.W Black 250 ml | bottle | 0.00 | 1,300.00 | 0.00 |  |
| `FGB-STK-WHK-0011` | J.W Black 750 ml | bottle | 0.00 | 4,500.00 | 0.00 |  |
| `FGB-STK-WHK-0014` | J.W Black Green Label 1 L | bottle | 0.00 | 7,500.00 | 0.00 |  |
| `FGB-STK-WHK-0013` | J.W Blonde 750 ml | bottle | 0.00 | 3,000.00 | 0.00 |  |
| `FGB-STK-WHK-0008` | J.W Red 1 Ltr | bottle | 0.00 | 3,000.00 | 0.00 |  |
| `FGB-STK-WHK-0005` | J.W Red 250 ml | bottle | 0.00 | 800.00 | 0.00 |  |
| `FGB-STK-WHK-0006` | J.W Red 375 ml | bottle | 0.00 | 1,700.00 | 0.00 |  |
| `FGB-STK-WHK-0007` | J.W Red 750 ml | bottle | 0.00 | 2,500.00 | 0.00 |  |
| `FGB-STK-WHK-0043` | J&B 750 ml | bottle | 0.00 | 2,400.00 | 0.00 |  |
| `FGB-WHK-0030` | Jack Daniels 1L *(BOMET TOWN)* | bottle | 3,300.00 | 5,000.00 | 1,000.00 |  |
| `FGB-STK-WHK-0027` | Jack Daniels 350 ml | bottle | 0.00 | 2,500.00 | 0.00 |  |
| `FGB-STK-WHK-0028` | Jack Daniels 750 ml | bottle | 0.00 | 4,500.00 | 0.00 |  |
| `MOG-BAR-0206` | JACK DANIELS 750ML | each | 0.00 | 4,500.00 | 0.00 |  |
| `FGB-STK-WIN-0010` | Jager | bottle | 0.00 | 6,600.00 | 0.00 |  |
| `FGB-STK-WIN-0012` | Jager Tot | tot | 0.00 | 200.00 | 0.00 |  |
| `FGB-OTH-0002` | Jagermeister *(BOMET TOWN)* | bottle | 2,200.00 | 4,000.00 | 1,000.00 |  |
| `MOG-BAR-0236` | JAGERMEISTER TOT | each | 0.00 | 200.00 | 0.00 |  |
| `FGB-STK-WHK-0001` | Jameson 1/2 | bottle | 0.00 | 1,600.00 | 0.00 |  |
| `FGB-WHK-0033` | Jameson 1L *(BOMET TOWN)* | bottle | 3,168.00 | 4,000.00 | 998.00 |  |
| `FGB-STK-WHK-0002` | Jameson 750 ml | bottle | 0.00 | 3,000.00 | 0.00 |  |
| `FGB-WHK-0017` | JW Black 1L *(BOMET TOWN)* | bottle | 3,911.00 | 5,000.00 | 997.00 |  |
| `FGB-WHK-0015` | JW Black 350ml *(BOMET TOWN)* | bottle | 1,720.00 | 2,100.00 | 1,000.00 |  |
| `FGB-WHK-0016` | JW Black 750ml *(BOMET TOWN)* | bottle | 3,236.00 | 3,236.00 | 1,000.00 |  |
| `FGB-WHK-0018` | JW Blonde 750ml *(BOMET TOWN)* | bottle | 1,991.00 | 3,000.00 | 1,000.00 |  |
| `FGB-WHK-0014` | JW Red 1L *(BOMET TOWN)* | bottle | 2,147.00 | 3,000.00 | 990.00 |  |
| `FGB-WHK-0011` | JW Red 250ml *(BOMET TOWN)* | bottle | 560.00 | 1,000.00 | 1,000.00 |  |
| `FGB-WHK-0012` | JW Red 350ml *(BOMET TOWN)* | bottle | 853.00 | 1,300.00 | 999.00 |  |
| `FGB-WHK-0013` | JW Red 750ml *(BOMET TOWN)* | bottle | 1,799.00 | 2,500.00 | 995.00 |  |
| `FGB-STK-SPR-0001` | K.C 250 ml | bottle | 0.00 | 450.00 | 0.00 |  |
| `FGB-STK-SPR-0002` | K.C 350 ml | bottle | 0.00 | 700.00 | 0.00 |  |
| `FGB-STK-SPR-0003` | K.C 750 ml | bottle | 0.00 | 1,200.00 | 0.00 |  |
| `MOG-BAR-0124` | Keringet Water 1L | each | 0.00 | 120.00 | 0.00 |  |
| `MOG-BAR-0123` | Keringet Water 500ml | each | 0.00 | 70.00 | 0.00 |  |
| `FGB-STK-BEV-0011` | Lime Lemonade | bottle | 0.00 | 100.00 | 0.00 |  |
| `MOG-BAR-0201` | MARTEL 750ML | each | 0.00 | 8,500.00 | 0.00 |  |
| `FGB-COG-0003` | Martel VS *(BOMET TOWN)* | bottle | 4,764.00 | 8,500.00 | 1,000.00 |  |
| `FGB-COG-0004` | Martel VSOP *(BOMET TOWN)* | bottle | 7,865.00 | 13,000.00 | 1,000.00 |  |
| `FGB-STK-WHK-0025` | Martell | bottle | 0.00 | 8,500.00 | 0.00 |  |
| `FGB-STK-WHK-0026` | Martell VSOP | bottle | 0.00 | 12,500.00 | 0.00 |  |
| `FGB-STK-BEV-0007` | Minute Maid | bottle | 0.00 | 100.00 | 0.00 |  |
| `FGB-STK-BEV-0004` | Novida | bottle | 0.00 | 80.00 | 0.00 |  |
| `MOG-BAR-0166` | NUDEBURG | each | 0.00 | 2,800.00 | 0.00 |  |
| `FGB-BER-0009` | Pilsner *(BOMET TOWN)* | bottle | 169.00 | 250.00 | 1,000.00 |  |
| `FGB-STK-SPR-0004` | Popov 250 ml | bottle | 0.00 | 350.00 | 0.00 |  |
| `FGB-STK-BEV-0008` | Predator | bottle | 0.00 | 100.00 | 0.00 |  |
| `MOG-BAR-0139` | PUNCH | each | 0.00 | 250.00 | 0.00 |  |
| `FGB-CAN-0011` | Raspberry Twist *(BOMET TOWN)* | can | 175.96 | 250.00 | 1,000.00 |  |
| `FGB-ENR-0001` | Redbull *(BOMET TOWN)* | can | 181.00 | 181.00 | 996.00 |  |
| `FGB-STK-BRC-0006` | Richot 1/2 | bottle | 0.00 | 800.00 | 0.00 |  |
| `FGB-STK-BRC-0005` | Richot 1/4 | bottle | 0.00 | 600.00 | 0.00 |  |
| `FGB-STK-BRC-0007` | Richot 750 ml | bottle | 0.00 | 1,800.00 | 0.00 |  |
| `FGB-STK-BRC-0008` | Robertson | bottle | 0.00 | 1,800.00 | 0.00 |  |
| `FGB-WHK-0024` | Savanna *(BOMET TOWN)* | bottle | 251.00 | 350.00 | 1,000.00 |  |
| `FGB-STK-MIX-0004` | Savanna Cider | bottle | 0.00 | 350.00 | 0.00 |  |
| `FGB-COG-0005` | Singletone 12YRS *(BOMET TOWN)* | bottle | 5,375.00 | 6,000.00 | 1,000.00 |  |
| `FGB-STK-BEV-0001` | Soda 300ml | bottle | 0.00 | 70.00 | 0.00 |  |
| `FGB-SDR-0001` | Soda 500ml *(BOMET TOWN)* | bottle | 50.00 | 100.00 | 1,000.00 |  |
| `FGB-STK-BEV-0002` | Soda 500ml | bottle | 0.00 | 100.00 | 0.00 |  |
| `MOG-BAR-0180` | SOUTHERN COMFORT | each | 0.00 | 3,200.00 | 0.00 |  |
| `FGB-WHK-0025` | Tang 10 *(BOMET TOWN)* | bottle | 3,167.00 | 6,000.00 | 1,000.00 |  |
| `FGB-STK-BEV-0010` | Tonic Soda | bottle | 0.00 | 120.00 | 0.00 |  |
| `FGB-STK-OTH-0002` | Trust Kiss | pcs | 0.00 | 100.00 | 0.00 |  |
| `FGB-OTH-0006` | Trust Studded *(BOMET TOWN)* | pcs | 39.50 | 100.00 | 976.00 |  |
| `MOG-BAR-0281` | V&A | each | 0.00 | 1,200.00 | 0.00 |  |
| `FGB-STK-CRM-0006` | V&A 1/4 | bottle | 0.00 | 400.00 | 0.00 |  |
| `FGB-WHK-0041` | V&A 250ml *(BOMET TOWN)* | bottle | 310.00 | 400.00 | 996.00 |  |
| `FGB-WHK-0042` | V&A 750ml *(BOMET TOWN)* | bottle | 803.00 | 1,200.00 | 1,000.00 |  |
| `FGB-SPR-0014` | Viceroy 350ml *(BOMET TOWN)* | bottle | 653.00 | 653.00 | 966.00 |  |
| `MOG-BAR-0312` | VODKA 1 LTR | each | 0.00 | 2,300.00 | 0.00 |  |
| `FGB-STK-VOD-0001` | Vodka 250ml | bottle | 0.00 | 600.00 | 0.00 |  |
| `FGB-STK-VOD-0002` | Vodka 350ml | bottle | 0.00 | 800.00 | 0.00 |  |
| `FGB-SDR-0002` | Water 1L *(BOMET TOWN)* | bottle | 42.00 | 100.00 | 1,000.00 |  |
| `FGB-BER-0013` | White Cap *(BOMET TOWN)* | bottle | 195.92 | 250.00 | 1,000.00 |  |
| `MOG-BAR-0138` | WHITE CAP CRISPS | each | 0.00 | 0.00 | 0.00 |  |
| `FGB-WHK-0040` | William Lawsons 1L *(BOMET TOWN)* | bottle | 2,229.00 | 3,000.00 | 1,000.00 |  |
| `FGB-STK-WHK-0033` | William Lawsons 3/4 | bottle | 0.00 | 2,200.00 | 0.00 |  |

#### BEERS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-190` | BALOZI | crate | 4,225.00 | 250.00 | 1,000.00 | bar_store |
| `FG-191` | BLACK ICE | crate | 3,982.00 | 250.00 | 1,000.00 | bar_store |
| `FG-192` | DESPARADO | pcs | 285.00 | 285.00 | 6.00 | bar_store |
| `FG-450` | GUARANA | crate | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-193` | GUINNESS | crate | 5,109.00 | 300.00 | 1,000.00 | bar_store |
| `FG-194` | HEINEKEN | pcs | 263.00 | 263.00 | 0.00 | bar_store |
| `FG-320` | HUNTERS CIDER DRY | pcs | 203.00 | 203.00 | 33.00 | bar_store |
| `FG-195` | HUNTERS CIDER GOLD | pcs | 203.00 | 203.00 | 12.00 | bar_store |
| `FG-315` | KINGFISHER | pcs | 192.00 | 192.00 | 0.00 | bar_store |
| `FG-196` | MANYATTA | pcs | 215.00 | 300.00 | 1,000.00 | bar_store |
| `FG-197` | PILSNER LAGER | crate | 4,227.00 | 250.00 | 1,000.00 | bar_store |
| `FG-198` | SAVANA CIDER | pcs | 251.00 | 251.00 | 0.00 | bar_store |
| `FG-199` | SIKERA | crate | 3,275.00 | 250.00 | 1,000.00 | bar_store |
| `FG-200` | SNAPP | crate | 3,982.00 | 250.00 | 1,000.00 | bar_store |
| `FG-201` | SUMMIT LAGER | pcs | 240.00 | 300.00 | 1,000.00 | bar_store |
| `FG-202` | TUSKER CIDER | crate | 5,552.00 | 250.00 | 1,000.00 | bar_store |
| `FG-203` | TUSKER LAGER | crate | 4,225.00 | 250.00 | 1,000.00 | bar_store |
| `FG-204` | TUSKER LITE | crate | 4,667.00 | 250.00 | 1,000.00 | bar_store |
| `FG-205` | TUSKER MALT | crate | 4,075.00 | 250.00 | 1,000.00 | bar_store |
| `FG-206` | WHITE CAP LAGER | crate | 4,075.00 | 250.00 | 1,000.00 | bar_store |
| `FG-207` | WHITE CAP LITE | crate | 4,075.00 | 250.00 | 1,000.00 | bar_store |
| `FG-395` | WINDHOEK | pcs | 190.00 | 190.00 | 0.00 | bar_store |

#### beverage

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FGH-BEV-KCPINE-0001` | KC pineapple 750ml | bottle | 0.00 | 0.00 | 1,000.00 | foodstuffs |

#### CANNED BEERS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-425` | ALVARO CAN | pcs | 0.00 | 0.00 | 1,000.00 | bar_store |
| `FG-208` | BALOZI CAN | pcs | 199.20 | 300.00 | 1,000.00 | bar_store |
| `FG-209` | BLACK ICE CAN | pcs | 175.96 | 300.00 | 1,000.00 | bar_store |
| `FG-210` | FAXE CAN | pcs | 825.00 | 825.00 | 0.00 | bar_store |
| `FG-211` | GUINNESS CAN | pcs | 216.71 | 300.00 | 1,000.00 | bar_store |
| `FG-422` | HEINKEIN CAN | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-451` | MANYATTA CAN | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-212` | PILSNER CAN | pcs | 138.75 | 300.00 | 1,000.00 | bar_store |
| `FG-423` | QUARANA PUNCH | pcs | 0.00 | 0.00 | 1,000.00 | bar_store |
| `FG-424` | SAVANNA RASPBERRY TWIST | pcs | 0.00 | 0.00 | 1,000.00 | bar_store |
| `FG-213` | SNAPP CAN | pcs | 175.96 | 300.00 | 1,000.00 | bar_store |
| `FG-214` | TUSKER CIDER CAN | pcs | 234.00 | 300.00 | 1,000.00 | bar_store |
| `FG-215` | TUSKER LAGER CAN | pcs | 199.10 | 300.00 | 1,000.00 | bar_store |
| `FG-216` | TUSKER LITE CAN | pcs | 243.00 | 300.00 | 1,000.00 | bar_store |
| `FG-217` | TUSKER MALT CAN | pcs | 242.00 | 300.00 | 1,000.00 | bar_store |
| `FG-218` | WHITE CAP CAN | pcs | 242.00 | 242.00 | 1,000.00 | bar_store |

#### CLEANING MATERIALS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-118` | CERAMIC STAIN REMOVER | ltr | 0.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-115` | GROUT STAIN REMOVER | ltr | 0.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-117` | INDUSTRIAL JIK | ltr | 0.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-116` | SCOURING POWDER | pcs | 0.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-113` | TOILET DISINFECTANT | ltr | 0.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-176` | WASHING POWDER | kg | 1,200.00 | 1,200.00 | 1,000.00 | foodstuffs |

#### COGNAC

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-256` | DOUBLE BLACK 1LTR | pcs | 5,640.00 | 5,640.00 | 4.00 | bar_store |
| `FG-257` | DOUBLE BLACK 750ML | pcs | 4,160.00 | 4,160.00 | 1.00 | bar_store |
| `FG-267` | HENNESSY VSOP 700ML | pcs | 9,200.00 | 9,200.00 | 3.00 | bar_store |
| `FG-402` | HENNESY | pcs | 4,600.00 | 4,600.00 | 1.00 | bar_store |
| `FG-287` | MARTEL VS 700ML | pcs | 4,764.00 | 4,764.00 | 4.00 | bar_store |
| `FG-288` | MARTEL VSOP 700ML | pcs | 5,800.00 | 5,800.00 | 2.00 | bar_store |

#### CONDOM

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-444` | KISS | pcs | 0.00 | 0.00 | 0.00 | foodstuffs |
| `FG-397` | STUDDED | pcs | 50.00 | 950.00 | 949.00 | foodstuffs |
| `FG-NC-001` | TRUST CLASSIC | pcs | 30.00 | 0.00 | 976.00 | non_consumables |

#### DRY GOODS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-363` | 13KG GAS | pcs | 2,400.00 | 2,400.00 | 1,000.00 | foodstuffs |
| `FG-151` | 50KG GAS | pcs | 1,050.00 | 8,500.00 | 1,000.00 | foodstuffs |
| `FG-157` | 6KG GAS | pcs | 1,250.00 | 1,050.00 | 1,000.00 | foodstuffs |
| `FG-153` | 6KGS | pcs | 350.00 | 1,250.00 | 1,000.00 | foodstuffs |
| `FG-9` | AIR FRESHENERS | pcs | 1,980.00 | 1,980.00 | 974.00 | foodstuffs |
| `FG-2` | AJAB UGALI | bale | 265.00 | 265.00 | 538.00 | foodstuffs |
| `FG-383` | ATTARMARK | pcs | 1,284.00 | 265.00 | 993.00 | foodstuffs |
| `FG-82` | BACON | pkt | 400.00 | 400.00 | 1,000.00 | foodstuffs |
| `FG-189` | BAKED BEANS | pcs | 20.00 | 400.00 | 1,000.00 | foodstuffs |
| `FG-61` | BAKING POWDER | pcs | 10.00 | 20.00 | 994.00 | foodstuffs |
| `FG-150` | BANANAS | pcs | 180.00 | 10.00 | 1,000.00 | foodstuffs |
| `FG-40` | BARSOAP | pcs | 70.00 | 202.00 | 994.00 | foodstuffs |
| `FG-5` | BASMATTI RICE | kg | 10.00 | 10.00 | 895.00 | foodstuffs |
| `FG-354` | BATTERIES AA | pcs | 50.00 | 70.00 | 1,000.00 | foodstuffs |
| `FG-369` | BATTERIES AAA | pcs | 850.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-392` | BAYGON | pcs | 250.00 | 650.00 | 1,000.00 | foodstuffs |
| `FG-339` | BEEF MASALA | pcs | 680.00 | 250.00 | 1,000.00 | foodstuffs |
| `FG-79` | BEEF STEAK | pcs | 32.50 | 680.00 | 1,000.00 | foodstuffs |
| `FG-44` | BELLA TISSUE | pcs | 45.00 | 22.00 | 430.00 | foodstuffs |
| `FG-385` | BICABORNATE | pcs | 10.00 | 45.00 | 970.00 | foodstuffs |
| `FG-38` | BIRO PENS | pcs | 150.00 | 10.00 | 976.00 | foodstuffs |
| `FG-46` | BLACK PEPPER | pcs | 2,970.00 | 150.00 | 999.00 | foodstuffs |
| `FG-7` | BLUE BAND | pcs | 60.00 | 2,970.00 | 1,000.00 | foodstuffs |
| `FG-170` | BROCOLLI | kg | 60.00 | 60.00 | 1,000.00 | foodstuffs |
| `FG-15` | BROILERS | pcs | 600.00 | 600.00 | 352.00 | foodstuffs |
| `FG-20` | BROILERS EGGS | pcs | 450.00 | 450.00 | 1,000.00 | foodstuffs |
| `FG-370` | BROOMS | pcs | 50.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-111` | BROWN BREAD | pcs | 57.00 | 57.00 | 1,000.00 | foodstuffs |
| `FG-352` | BROWN KHAKI | pcs | 200.00 | 200.00 | 1,000.00 | foodstuffs |
| `FG-91` | BUTTERNUT | kg | 80.00 | 80.00 | 1,000.00 | foodstuffs |
| `FG-32` | CABBAGES | pcs | 45.00 | 50.00 | 605.00 | foodstuffs |
| `FG-341` | CARDAMOMS | pkt | 85.00 | 150.00 | 1,000.00 | foodstuffs |
| `FG-8` | CARRIER BAGS #15 | pcs | 150.00 | 85.00 | 979.00 | foodstuffs |
| `FG-351` | CARRIER BAGS #22 | pkt | 125.00 | 125.00 | 977.00 | foodstuffs |
| `FG-107` | CARROTS | kg | 30.00 | 80.00 | 878.00 | foodstuffs |
| `FG-109` | CHARCOAL | sack | 1,450.00 | 1,450.00 | 969.50 | foodstuffs |
| `FG-77` | CHICKEN BITES | pkt | 375.00 | 375.00 | 1,000.00 | foodstuffs |
| `FG-340` | CHICKEN MASALA | pcs | 250.00 | 250.00 | 999.00 | foodstuffs |
| `FG-124` | CHILLI SAUCE | pcs | 450.00 | 450.00 | 999.00 | foodstuffs |
| `FG-344` | CHILLIE SAUCE SATCHETS | pkt | 900.00 | 900.00 | 1,000.00 | foodstuffs |
| `FG-122` | CINAMON | pcs | 230.00 | 230.00 | 999.00 | foodstuffs |
| `FG-60` | COCONUT CREAM | pcs | 285.00 | 320.00 | 1,000.00 | foodstuffs |
| `FG-59` | COCONUT MILK | pcs | 290.00 | 300.00 | 1,000.00 | foodstuffs |
| `FG-129` | COFFEE CUPS | pcs | 375.00 | 375.00 | 850.00 | foodstuffs |
| `FG-186` | COLGATE | pcs | 800.00 | 800.00 | 1,000.00 | foodstuffs |
| `FG-4` | COOKING OIL | can | 4,600.00 | 5,050.00 | 971.00 | foodstuffs |
| `FG-76` | CORN FLOUR | pkt | 107.00 | 107.00 | 978.00 | foodstuffs |
| `FG-119` | CORNFLAKES | pkt | 350.00 | 350.00 | 1,000.00 | foodstuffs |
| `FG-132` | COTTON | pkt | 200.00 | 200.00 | 1,000.00 | foodstuffs |
| `FG-185` | COURGETS | kg | 40.00 | 40.00 | 1,000.00 | foodstuffs |
| `FG-168` | CUCUMBER | pcs | 40.00 | 40.00 | 1,000.00 | foodstuffs |
| `FG-57` | CURRY POWDER | pcs | 250.00 | 250.00 | 1,000.00 | foodstuffs |
| `FG-162` | DANA JEERA | pcs | 215.00 | 215.00 | 1,000.00 | foodstuffs |
| `FG-155` | DANIA | kg | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-63` | DARKSOY SAUCE | pcs | 350.00 | 325.00 | 976.00 | foodstuffs |
| `FG-187` | DETTOL | ltr | 225.00 | 225.00 | 1,000.00 | foodstuffs |
| `FG-393` | DHANIA | kg | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-93` | DOOM | pcs | 500.00 | 1,300.00 | 1,000.00 | foodstuffs |
| `FG-407` | DORMANTS | pcs | 1,300.00 | 345.00 | 1,000.00 | foodstuffs |
| `FG-368` | DOWNY | ltr | 500.00 | 300.00 | 970.00 | foodstuffs |
| `FG-12` | DRINKING CHOCOLATE | pcs | 100.00 | 30.00 | 990.00 | foodstuffs |
| `FG-138` | EASY WARM | pcs | 800.00 | 800.00 | 1,000.00 | foodstuffs |
| `FG-51` | EGG YELLOW | pcs | 60.00 | 21.00 | 891.00 | foodstuffs |
| `FG-166` | EGGS KIENYEJI | pcs | 25.00 | 25.00 | 1,000.00 | foodstuffs |
| `FG-358` | ENVELOPE A4 | pcs | 10.00 | 10.00 | 1,000.00 | foodstuffs |
| `FG-359` | ENVELOPE A5 | pcs | 5.00 | 5.00 | 1,000.00 | foodstuffs |
| `FG-3` | EXE ALL PURPOSE | pkt | 155.00 | 166.00 | 906.00 | foodstuffs |
| `FG-399` | FALCON RICE | kg | 100.00 | 100.00 | 996.00 | foodstuffs |
| `FG-390` | FAMILA WIMBI | pkt | 100.00 | 100.00 | 994.00 | foodstuffs |
| `FG-96` | FILM | pcs | 700.00 | 700.00 | 991.00 | foodstuffs |
| `FG-18` | FISH | kg | 280.00 | 280.00 | 530.00 | foodstuffs |
| `FG-145` | FISH FILLETS | kg | 275.00 | 275.00 | 1,000.00 | foodstuffs |
| `FG-58` | FISH MASALA | pcs | 200.00 | 200.00 | 998.00 | foodstuffs |
| `FG-97` | FOIL | pcs | 1,400.00 | 1,400.00 | 990.00 | foodstuffs |
| `FG-443` | FRESH MILK | ltr | 0.00 | 0.00 | 0.00 | foodstuffs |
| `FG-45` | GARAM MASALA | pcs | 190.00 | 190.00 | 997.00 | foodstuffs |
| `FG-92` | GARLIC | pcs | 25.00 | 25.00 | 955.00 | foodstuffs |
| `FG-49` | GARLIC POWDER | pcs | 180.00 | 180.00 | 990.00 | foodstuffs |
| `FG-88` | GINGER | kg | 250.00 | 200.00 | 976.00 | foodstuffs |
| `FG-48` | GINGER POWDER | pcs | 150.00 | 150.00 | 999.00 | foodstuffs |
| `FG-366` | GRAM FLOUR | pkt | 450.00 | 450.00 | 1,000.00 | foodstuffs |
| `FG-371` | HAIRNETS | pcs | 1.00 | 1.00 | 780.00 | foodstuffs |
| `FG-95` | HAND TOWELS | pcs | 162.00 | 162.00 | 914.00 | foodstuffs |
| `FG-387` | HAND WASH | ltr | 60.00 | 60.00 | 966.00 | foodstuffs |
| `FG-43` | HANNAN TISSUE | pcs | 35.00 | 35.00 | 1,000.00 | foodstuffs |
| `FG-348` | HARPIC | ltr | 160.00 | 160.00 | 1,000.00 | foodstuffs |
| `FG-89` | HOHO | pcs | 10.00 | 10.00 | 870.00 | foodstuffs |
| `FG-67` | HONEY CARTON | ctn | 2,700.00 | 2,700.00 | 1,000.00 | foodstuffs |
| `FG-342` | HONEY PIECES | pcs | 150.00 | 150.00 | 935.00 | foodstuffs |
| `FG-34` | IDP | pcs | 1,150.00 | 1,120.00 | 996.00 | foodstuffs |
| `FG-98` | JIK | ltr | 100.00 | 100.00 | 997.00 | foodstuffs |
| `FG-389` | JOGOO WIMBI | pkt | 100.00 | 100.00 | 998.00 | foodstuffs |
| `FG-160` | JUICE STRAWS | pkt | 180.00 | 180.00 | 993.00 | foodstuffs |
| `FG-94` | JUMBO TISSUE | pcs | 105.00 | 105.00 | 980.00 | foodstuffs |
| `FG-181` | KAMANDE | kg | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-163` | KETCHUP | pcs | 500.00 | 500.00 | 1,000.00 | foodstuffs |
| `FG-22` | KHAKI PAPERS | pkt | 290.00 | 290.00 | 975.00 | foodstuffs |
| `FG-108` | KIENYEJI EGGS | pcs | 20.00 | 20.00 | 1,000.00 | foodstuffs |
| `FG-137` | KITCHEN CLEANER | pcs | 240.00 | 240.00 | 998.00 | foodstuffs |
| `FG-404` | KITCHEN ROLL | pcs | 0.00 | 0.00 | 962.00 | foodstuffs |
| `FG-37` | KUKU KIENYEJI | pcs | 800.00 | 800.00 | 1,000.00 | foodstuffs |
| `FG-171` | LEEKS | kg | 30.00 | 30.00 | 1,000.00 | foodstuffs |
| `FG-175` | LEMON SQUEZER | pcs | 500.00 | 500.00 | 1,000.00 | foodstuffs |
| `FG-87` | LEMONS | kg | 80.00 | 80.00 | 881.00 | foodstuffs |
| `FG-169` | LETTUCE | pcs | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-64` | LIGHT SOY SAUCE | pcs | 350.00 | 300.00 | 1,000.00 | foodstuffs |
| `FG-183` | MACORONI | pkt | 350.00 | 350.00 | 1,000.00 | foodstuffs |
| `FG-104` | MANAGU | kg | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-35` | MANGOES | pcs | 40.00 | 40.00 | 815.00 | foodstuffs |
| `FG-367` | MARA MOJA | pcs | 100.00 | 100.00 | 999.00 | foodstuffs |
| `FG-357` | MARKER PENS | pcs | 30.00 | 30.00 | 1,000.00 | foodstuffs |
| `FG-400` | MASTER MAIZE MEAL | pkt | 150.00 | 150.00 | 1,000.00 | foodstuffs |
| `FG-99` | MATCHBOX | pcs | 26.00 | 26.00 | 988.00 | foodstuffs |
| `FG-165` | MATOKE | kg | 300.00 | 300.00 | 1,000.00 | foodstuffs |
| `FG-416` | MAYONAISE | pcs | 620.00 | 620.00 | 1,000.00 | foodstuffs |
| `FG-374` | MAYONNAISE 5LTRS | pcs | 1,150.00 | 1,150.00 | 995.00 | foodstuffs |
| `FG-149` | MBUZI | kg | 700.00 | 700.00 | 1,000.00 | foodstuffs |
| `FG-29` | MELONS | pcs | 350.00 | 350.00 | 982.00 | foodstuffs |
| `FG-406` | MFALME | pcs | 758.00 | 758.00 | 1,000.00 | foodstuffs |
| `FG-106` | MILK PACKET | ctn | 650.00 | 680.00 | 947.00 | foodstuffs |
| `FG-13` | MILO SATCHETS | pcs | 20.00 | 20.00 | 997.00 | foodstuffs |
| `FG-80` | MINCED MEAT | kg | 680.00 | 680.00 | 1,000.00 | foodstuffs |
| `FG-26` | MINTS | pcs | 130.00 | 204.00 | 1,000.00 | foodstuffs |
| `FG-169-2` | MIXED BLUT | pcs | 550.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-17` | MIXED VEGES | pkt | 180.00 | 180.00 | 980.00 | foodstuffs |
| `FG-388` | MOPPERS | pcs | 250.00 | 250.00 | 1,000.00 | foodstuffs |
| `FG-345` | MOZERELA CHEESE | pkt | 1,250.00 | 1,250.00 | 1,000.00 | foodstuffs |
| `FG-188` | MULTIPURPOSE DETERGENT | ltr | 50.00 | 50.00 | 600.00 | foodstuffs |
| `FG-105` | MURSIK | ltr | 80.00 | 80.00 | 1,000.00 | foodstuffs |
| `FG-62` | MUSHROOM CAN | pcs | 560.00 | 560.00 | 1,000.00 | foodstuffs |
| `FG-81` | MUTTON | kg | 680.00 | 680.00 | 1,000.00 | foodstuffs |
| `FG-182` | NDENGU | kg | 50.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-36` | NDUMA | pcs | 100.00 | 150.00 | 1,000.00 | foodstuffs |
| `FG-133` | NESCAFE | pcs | 10.00 | 10.00 | 635.00 | foodstuffs |
| `FG-184` | NOTEBOOKS | pcs | 35.00 | 35.00 | 1,000.00 | foodstuffs |
| `FG-84` | ONIONS | kg | 65.00 | 130.00 | 849.00 | foodstuffs |
| `FG-140` | ORDINARY GLASSES | pcs | 65.00 | 50.00 | 418.00 | foodstuffs |
| `FG-55` | OREGANO | pcs | 50.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-50` | PAPRIKA | pcs | 190.00 | 195.00 | 999.00 | foodstuffs |
| `FG-31` | PAWPAW | pcs | 130.00 | 200.00 | 1,000.00 | foodstuffs |
| `FG-146` | PEAS | kg | 70.00 | 70.00 | 1,000.00 | foodstuffs |
| `FG-180` | PEPPER | pcs | 10.00 | 10.00 | 1,000.00 | foodstuffs |
| `FG-52` | PILAU MASALA | pcs | 50.00 | 285.00 | 993.00 | foodstuffs |
| `FG-53` | PILAU MASALA WHOLE | pcs | 50.00 | 280.00 | 1,000.00 | foodstuffs |
| `FG-154` | PILIPILI | pcs | 190.00 | 5.00 | 1,000.00 | foodstuffs |
| `FG-30` | PINEAPLES | pcs | 150.00 | 150.00 | 945.00 | foodstuffs |
| `FG-83` | PORKCHOPS | pkt | 1,085.00 | 1,085.00 | 1,000.00 | foodstuffs |
| `FG-86` | POTATOES | kg | 50.00 | 55.00 | 0.00 | foodstuffs |
| `FG-373` | PRESTIGE | pcs | 363.00 | 370.00 | 987.00 | foodstuffs |
| `FG-39` | PURE WIMBI | pkt | 200.00 | 200.00 | 996.00 | foodstuffs |
| `FG-401` | REAM | pcs | 235.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-384` | ROSEMARY LEAVE | pcs | 21.00 | 10.00 | 1,000.00 | foodstuffs |
| `FG-41` | ROUND SOAPS | pcs | 460.00 | 21.00 | 1,000.00 | foodstuffs |
| `FG-391` | ROYCO CUBES | pcs | 75.00 | 118.00 | 977.00 | foodstuffs |
| `FG-375` | SACKS | pcs | 460.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-343` | SALT PER 2KG | pkt | 568.00 | 75.00 | 984.00 | foodstuffs |
| `FG-73` | SALT SATCHETS | pkt | 60.00 | 460.00 | 990.00 | foodstuffs |
| `FG-16` | SAUSAGES | pcs | 160.00 | 568.00 | 855.00 | foodstuffs |
| `FG-28` | SCRUBBERS | pcs | 160.00 | 50.00 | 978.00 | foodstuffs |
| `FG-14` | SELFRAISING | pkt | 160.00 | 165.00 | 959.00 | foodstuffs |
| `FG-121` | SERVIETTES | pcs | 260.00 | 70.00 | 622.00 | foodstuffs |
| `FG-42` | SHOWER GEL | pcs | 130.00 | 18.00 | 1,000.00 | foodstuffs |
| `FG-382` | SIMPLEX TISSUE | pkt | 25.00 | 25.00 | 940.00 | foodstuffs |
| `FG-103` | SKUMA | kg | 0.00 | 0.00 | 1,000.00 | foodstuffs |
| `FG-78` | SMOKIES | pcs | 427.00 | 427.00 | 1,000.00 | foodstuffs |
| `FG-68` | SODA | ctn | 780.00 | 780.00 | 1,000.00 | foodstuffs |
| `FG-173` | SODA TAKE AWAY | ctn | 1,480.00 | 1,480.00 | 1,000.00 | foodstuffs |
| `FG-177` | SOUP SPOONS | pcs | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-90` | SPAGETTI | pcs | 250.00 | 115.00 | 1,000.00 | foodstuffs |
| `FG-161` | SPRING ONIONS | pkt | 137.50 | 100.00 | 1,000.00 | foodstuffs |
| `FG-356` | STAPLE PINS | kg | 150.00 | 150.00 | 1,000.00 | foodstuffs |
| `FG-27` | STEELWOOL | pcs | 150.00 | 20.00 | 994.00 | foodstuffs |
| `FG-144` | STRAWBERRY ICECREAM | pkt | 280.00 | 970.00 | 999.00 | foodstuffs |
| `FG-353` | STRAWS | pkt | 450.00 | 50.00 | 989.00 | foodstuffs |
| `FG-1` | SUGAR KG | kg | 950.00 | 128.00 | 941.00 | foodstuffs |
| `FG-74` | SUGARSATCHETS | pkt | 158.00 | 1,500.00 | 986.00 | foodstuffs |
| `FG-427` | SUKUMA WIKI | kg | 100.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-347` | SWEET POTATOES | pcs | 1,500.00 | 50.00 | 995.00 | foodstuffs |
| `FG-167` | SWEETBANANA | pcs | 10.00 | 15.00 | 1,000.00 | foodstuffs |
| `FG-174` | T-BONE STEAK | pcs | 50.00 | 2,075.00 | 1,000.00 | foodstuffs |
| `FG-128` | TAKA AWAY FORKS | pcs | 15.00 | 100.00 | 993.00 | foodstuffs |
| `FG-372` | TAKE AWAY SPOONS | pcs | 2,075.00 | 100.00 | 995.00 | foodstuffs |
| `FG-21` | TAKE AWAY TINS | pcs | 100.00 | 115.00 | 926.00 | foodstuffs |
| `FG-75` | TEA BAGS | pkt | 115.00 | 300.00 | 998.00 | foodstuffs |
| `FG-364` | TEA FLASK 1 LTR | pcs | 300.00 | 1,500.00 | 1,000.00 | foodstuffs |
| `FG-365` | TEA FLASK 1/2 LTR | pcs | 1,500.00 | 750.00 | 1,000.00 | foodstuffs |
| `FG-65` | TEA MASALA | pcs | 750.00 | 290.00 | 1,000.00 | foodstuffs |
| `FG-172` | TEALEAVES | pcs | 290.00 | 160.00 | 986.00 | foodstuffs |
| `FG-33` | THERMAL ROLLS | pcs | 180.00 | 150.00 | 834.00 | foodstuffs |
| `FG-360` | THUMB TACKS | pcs | 150.00 | 100.00 | 1,000.00 | foodstuffs |
| `FG-120` | TOILETBALLS | pcs | 100.00 | 125.00 | 978.00 | foodstuffs |
| `FG-11` | TOMATO PASTE | pcs | 125.00 | 370.00 | 970.00 | foodstuffs |
| `FG-24` | TOMATO SAUCE | pcs | 390.00 | 400.00 | 985.00 | foodstuffs |
| `FG-25` | TOMATO SAUCE TAKE AWAY | pcs | 400.00 | 870.00 | 993.00 | foodstuffs |
| `FG-85` | TOMATOES | kg | 870.00 | 90.00 | 610.00 | foodstuffs |
| `FG-408` | TOOTBRUSH | pcs | 90.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-349` | TOOTHBRUSH | pcs | 50.00 | 30.00 | 1,000.00 | foodstuffs |
| `FG-350` | TOOTHPASTE | pcs | 30.00 | 50.00 | 1,000.00 | foodstuffs |
| `FG-127` | TOOTHPICKS | pkt | 50.00 | 195.00 | 987.00 | foodstuffs |
| `FG-130` | TUMBLERS | pcs | 195.00 | 195.00 | 842.00 | foodstuffs |
| `FG-54` | TUMERIC | pcs | 124.00 | 176.00 | 984.00 | foodstuffs |
| `FG-398` | U MIX | pcs | 150.00 | 260.00 | 1,000.00 | foodstuffs |
| `FG-394` | VANILLA ESSENCE | pcs | 260.00 | 130.00 | 999.00 | foodstuffs |
| `FG-19` | VANILLA ICE CREAM | pkt | 900.00 | 970.00 | 998.00 | foodstuffs |
| `FG-23` | VIM | pcs | 285.00 | 110.00 | 992.00 | foodstuffs |
| `FG-126` | VINEGAR | pcs | 380.00 | 380.00 | 997.00 | foodstuffs |
| `FG-70` | Water 500ml | pcs | 21.00 | 41.00 | 1,000.00 | foodstuffs |
| `FG-110` | WEETABIX | pkt | 450.00 | 450.00 | 1,000.00 | foodstuffs |
| `FG-141` | WHISKY GLASS | pcs | 100.00 | 100.00 | 556.00 | foodstuffs |
| `FG-112` | WHITE BREADE | pcs | 57.00 | 57.00 | 1,000.00 | foodstuffs |
| `FG-123` | WHITEPEPPER | pcs | 200.00 | 258.00 | 1,000.00 | foodstuffs |
| `FG-134` | WHOLEMEAL | pkt | 265.00 | 265.00 | 1,000.00 | foodstuffs |
| `FG-136` | WINDOW CLEANER | pcs | 255.00 | 230.00 | 1,000.00 | foodstuffs |
| `FG-142` | WINE GLASS | pcs | 230.00 | 150.00 | 988.00 | foodstuffs |
| `FG-101` | WIPEX | pcs | 150.00 | 130.00 | 1,000.00 | foodstuffs |
| `FG-66` | YEAST | pcs | 130.00 | 275.00 | 990.00 | foodstuffs |
| `FG-164` | YELLOW BEANS | kg | 97.71 | 70.00 | 972.00 | foodstuffs |
| `FG-158` | ZESTAJAM | pcs | 400.00 | 400.00 | 1,000.00 | foodstuffs |

#### ENERGY DRINKS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-346` | BEETROOTS | pcs | 30.00 | 30.00 | 1,000.00 | bar_store |
| `FG-219` | MONSTER | pcs | 202.00 | 202.00 | 12.00 | bar_store |
| `FG-220` | RED BULL | pcs | 181.00 | 181.00 | 74.00 | bar_store |

#### GIN

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-221` | GILBEYS 250ML | pcs | 416.00 | 416.00 | 1.00 | bar_store |
| `FG-222` | GILBEYS 350ML | pcs | 576.00 | 576.00 | 0.00 | bar_store |
| `FG-223` | GILBEYS 750ML | pcs | 1,240.00 | 1,240.00 | 9.00 | bar_store |
| `FG-224` | GORDONS 1LTR | pcs | 1,850.00 | 2,500.00 | 1,000.00 | bar_store |
| `FG-225` | GORDONS 350ML | pcs | 1,008.00 | 1,008.00 | 17.00 | bar_store |
| `FG-314` | GORDONS 750ML | pcs | 2,000.00 | 2,000.00 | 19.00 | bar_store |
| `FG-405` | TANGUARAY 1 LTR | pcs | 3,167.00 | 3,167.00 | 1,000.00 | bar_store |
| `FG-242` | TANGUERAY 10YRS | pcs | 3,200.00 | 4,500.00 | 1,000.00 | bar_store |
| `FG-294` | TANGUERAY 750ML | pcs | 4,250.00 | 4,250.00 | 1,000.00 | bar_store |

#### LIQUERS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-300` | AMARULA CREAM 375ML | pcs | 1,173.00 | 1,173.00 | 2.00 | bar_store |
| `FG-301` | AMARULA CREAM 750ML | pcs | 2,086.00 | 2,086.00 | 0.00 | bar_store |
| `FG-302` | BAILEYS 350ML | pcs | 1,200.00 | 1,200.00 | 2.00 | bar_store |
| `FG-303` | BAILEYS 750ML | pcs | 2,160.00 | 2,160.00 | 2.00 | bar_store |
| `FG-244` | BEST CREAM 750ML | pcs | 1,089.00 | 1,089.00 | 2.00 | bar_store |
| `FG-319` | SHERIDANS | pcs | 4,500.00 | 4,500.00 | 1,000.00 | bar_store |

#### NON CONSUMABLES

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-NC-002` | POOL TOKENS | pcs | 30.00 | 0.00 | 1,000.00 | non_consumables |

#### soft drinks

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FGH-BEV-DELMON-0001` | DELMONTE APPLE BLEND | pcs | 0.00 | 0.00 | 1,000.00 | foodstuffs |

#### SOFT DRINKS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-445` | COKE ZERO | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-327` | DELMONTE (MANGO BLEND) | pcs | 242.00 | 242.00 | 0.00 | bar_store |
| `FG-330` | DELMONTE (MIXED BERRY BLEND) | pcs | 242.00 | 242.00 | 0.00 | bar_store |
| `FG-329` | DELMONTE (PASSION BLEND) | pcs | 242.00 | 242.00 | 968.00 | bar_store |
| `FG-332` | DELMONTE (PINEAPPLE BLEND) | pcs | 242.00 | 242.00 | 0.00 | bar_store |
| `FG-331` | DELMONTE TROPICAL BLEND) | pcs | 242.00 | 242.00 | 2.00 | bar_store |
| `FG-328` | DELMONTE(APPLE) | pcs | 1,005.00 | 1,005.00 | 3.00 | bar_store |
| `FG-333` | LEMONADE | pcs | 39.00 | 39.00 | 0.00 | bar_store |
| `FG-447` | MINUTE MAID | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-446` | NOVIDA | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-448` | PREDATOR | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-420` | Soda 300ml | pcs | 31.00 | 31.00 | 954.00 | bar_store |
| `FG-419` | SODA TAKE AWAY 500ML | pcs | 60.00 | 60.00 | 1,000.00 | bar_store |
| `FG-415` | TAKE AWAY SODA | pcs | 0.00 | 0.00 | 1,000.00 | bar_store |
| `FG-449` | TONIC SODA | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-421` | Water 10L | pcs | 86.00 | 86.00 | 1,000.00 | bar_store |
| `FG-417` | Water 1L | pcs | 41.00 | 41.00 | 1,000.00 | bar_store |
| `FG-418` | Water 500ml | pcs | 21.00 | 21.00 | 1,000.00 | bar_store |

#### SPIRITS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-334` | CAMINO BLANCO 750ML | pcs | 2,100.00 | 2,100.00 | 3.00 | bar_store |
| `FG-335` | CAMINO REAL GOLD | pcs | 2,300.00 | 2,300.00 | 0.00 | bar_store |
| `FG-413` | CAPTAIN  MUCKPIT 750 ML | pcs | 1,080.00 | 1,080.00 | 1,000.00 | foodstuffs |
| `FG-379` | CAPTAIN MORGAN 250ML | pcs | 336.00 | 336.00 | 0.00 | bar_store |
| `FG-380` | CAPTAIN MORGAN 750ML | pcs | 920.00 | 920.00 | 0.00 | bar_store |
| `FG-412` | CAPTAIN MUCKPIT 250ML | pcs | 384.00 | 384.00 | 1,000.00 | foodstuffs |
| `FG-254` | DON JOLUO ANEJO | pcs | 7,167.00 | 7,167.00 | 1,000.00 | bar_store |
| `FG-255` | DON JOLUO RPSDO | pcs | 5,417.00 | 5,417.00 | 1,000.00 | bar_store |
| `FG-268` | HUNTERS CHOICE 250ML | pcs | 306.00 | 306.00 | 0.00 | bar_store |
| `FG-269` | HUNTERS CHOICE 350ML | pcs | 443.00 | 443.00 | 15.00 | bar_store |
| `FG-270` | HUNTERS CHOICE 750ML | pcs | 938.00 | 938.00 | 17.00 | bar_store |
| `FG-336` | JAGERMEISTER 1 LTR | pcs | 3,100.00 | 3,100.00 | 1.00 | bar_store |
| `FG-337` | JAGERMEISTER 700ML | pcs | 2,200.00 | 2,200.00 | 5.00 | bar_store |
| `FG-239` | KANE EXTRA 250ML | pcs | 250.00 | 350.00 | 1,000.00 | bar_store |
| `FG-240` | KANE EXTRA 750ML | pcs | 750.00 | 1,000.00 | 1,000.00 | bar_store |
| `FG-286` | MALIBU | pcs | 1,713.00 | 1,713.00 | 1.00 | bar_store |
| `FG-289` | MARTINI BIANCO | pcs | 2,200.00 | 2,200.00 | 1,000.00 | bar_store |
| `FG-226` | RICHOT 250ML | pcs | 416.00 | 416.00 | 3.00 | bar_store |
| `FG-227` | RICHOT 350ML | pcs | 576.00 | 576.00 | 0.00 | bar_store |
| `FG-228` | RICHOT 750ML | pcs | 1,240.00 | 1,240.00 | 0.00 | bar_store |
| `FG-293` | SOUTHERN COMFORT 750ML | pcs | 1,800.00 | 1,800.00 | 1.00 | bar_store |
| `FG-381` | V&A 250ml | pcs | 296.00 | 296.00 | 4.00 | bar_store |
| `FG-304` | V&A 750ml | pcs | 768.00 | 768.00 | 1.00 | bar_store |
| `FG-403` | VICEROY 10 YRS | pcs | 3,235.00 | 3,235.00 | 1,000.00 | bar_store |
| `FG-229` | VICEROY 250ml | pcs | 447.00 | 447.00 | 984.00 | bar_store |
| `FG-230` | VICEROY 375ML | pcs | 653.00 | 653.00 | 89.00 | bar_store |
| `FG-231` | VICEROY 750ml | pcs | 1,260.00 | 1,260.00 | 952.00 | bar_store |

#### TOTS

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-453` | CAMINO TOT | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-452` | JAGER TOT | pcs | 0.00 | 0.00 | 0.00 | bar_store |

#### VODKA

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-235` | SCOTISH LEADER 750ML | pcs | 1,735.00 | 2,500.00 | 1,000.00 | bar_store |
| `FG-232` | Vodka 250ml | pcs | 416.00 | 416.00 | 6.00 | bar_store |
| `FG-233` | Vodka 350ml | pcs | 576.00 | 576.00 | 0.00 | bar_store |
| `FG-234` | Vodka 750ml | pcs | 1,240.00 | 1,240.00 | 0.00 | bar_store |

#### WHISKY

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-243` | ALL SEASONS 750ML | pcs | 1,080.00 | 1,080.00 | 0.00 | bar_store |
| `FG-246` | BEST WHISKY 250ML | pcs | 318.00 | 318.00 | 0.00 | bar_store |
| `FG-245` | BEST WHISKY 750ML | pcs | 1,005.00 | 1,005.00 | 0.00 | bar_store |
| `FG-247` | BLACK & WHITE 350ML | pcs | 576.00 | 576.00 | 0.00 | bar_store |
| `FG-248` | BLACK & WHITE 750ML | pcs | 1,120.00 | 1,120.00 | 0.00 | bar_store |
| `FG-410` | BLACK AND WHITE 1LTR | pcs | 1,548.00 | 1,548.00 | 1,000.00 | bar_store |
| `FG-249` | BOND 7 250ML | pcs | 416.00 | 416.00 | 14.00 | bar_store |
| `FG-250` | BOND 7 350ML | pcs | 576.00 | 576.00 | 0.00 | bar_store |
| `FG-251` | BOND 7 750ML | pcs | 1,240.00 | 1,240.00 | 0.00 | bar_store |
| `FG-426` | BULLET BOURBON | pcs | 0.00 | 0.00 | 1,000.00 | bar_store |
| `FG-253` | CHIVAS REGAL 1 LTR | pcs | 4,000.00 | 4,000.00 | 1,000.00 | bar_store |
| `FG-252` | CHIVAS REGAL 750ML | pcs | 3,700.00 | 3,700.00 | 1,000.00 | bar_store |
| `FG-259` | FAMOUS GROUSE 750ML | pcs | 285.00 | 285.00 | 2.00 | bar_store |
| `FG-260` | GLENFIDICH 18YRS 700ML | pcs | 13,100.00 | 13,100.00 | 0.00 | bar_store |
| `FG-261` | GLENFIDICH SINGLE MALT 12 YRS | pcs | 5,925.00 | 5,925.00 | 1.00 | bar_store |
| `FG-262` | GLENFIDICH SINGLE MALT 15 YRS | pcs | 8,550.00 | 8,550.00 | 1.00 | bar_store |
| `FG-263` | GRANTS 1 LTR | pcs | 1,950.00 | 1,950.00 | 0.00 | bar_store |
| `FG-264` | GRANTS 350ML | pcs | 750.00 | 750.00 | 5.00 | bar_store |
| `FG-265` | GRANTS 750ML | pcs | 1,650.00 | 1,650.00 | 0.00 | bar_store |
| `FG-275` | GREEN LABEL 1 LTR | pcs | 5,500.00 | 5,500.00 | 1,000.00 | bar_store |
| `FG-272` | J D HONEY 1 LTR | pcs | 3,500.00 | 3,500.00 | 1,000.00 | bar_store |
| `FG-271` | J D HONEY 750ML | pcs | 2,500.00 | 2,500.00 | 1,000.00 | bar_store |
| `FG-376` | J W BLACK 1LTR | pcs | 3,911.00 | 3,911.00 | 100.00 | bar_store |
| `FG-377` | J W BLACK 250ML | pcs | 1,040.00 | 1,040.00 | 0.00 | bar_store |
| `FG-273` | J W BLACK 375ML | pcs | 1,720.00 | 1,720.00 | 38.00 | bar_store |
| `FG-274` | J W BLACK 750ML | pcs | 3,236.00 | 3,236.00 | 62.00 | bar_store |
| `FG-411` | J W BLONDE | pcs | 1,991.00 | 1,991.00 | 5.00 | bar_store |
| `FG-279` | J W GOLD RESERVE | pcs | 7,000.00 | 7,000.00 | 0.00 | bar_store |
| `FG-276` | J W RED 1 LTR | pcs | 2,147.00 | 2,147.00 | 15.00 | bar_store |
| `FG-378` | J W RED 250ML | pcs | 560.00 | 560.00 | 0.00 | bar_store |
| `FG-277` | J W RED 375 ML | pcs | 853.00 | 853.00 | 19.00 | bar_store |
| `FG-278` | J W RED 750ML | pcs | 1,799.00 | 1,800.00 | 994.00 | bar_store |
| `FG-282` | JACK DANIELS 1 LTR | pcs | 3,300.00 | 3,300.00 | 6.00 | bar_store |
| `FG-280` | JACK DANIELS 350ML | pcs | 1,650.00 | 1,650.00 | 0.00 | bar_store |
| `FG-281` | JACK DANIELS 700ML | pcs | 2,800.00 | 2,800.00 | 3.00 | bar_store |
| `FG-241` | JACK DANIELS HONEY 750ML | pcs | 3,500.00 | 3,500.00 | 0.00 | bar_store |
| `FG-285` | JAMESON 1 LTR | pcs | 3,168.00 | 3,168.00 | 1.00 | bar_store |
| `FG-283` | JAMESON 350ML | pcs | 1,186.00 | 1,186.00 | 3.00 | bar_store |
| `FG-284` | JAMESON 750ML | pcs | 2,376.00 | 2,376.00 | 0.00 | bar_store |
| `FGH-OTH-JAMESO-0001` | JAMESON BLACK BARREL | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-236` | KC 250ML | pcs | 256.00 | 256.00 | 0.00 | bar_store |
| `FG-237` | KC 350ML | pcs | 352.00 | 352.00 | 18.00 | bar_store |
| `FG-238` | KC 750ML | pcs | 672.00 | 672.00 | 0.00 | bar_store |
| `FG-434` | KC GINGER 250ML | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-436` | KC GINGER 750ML | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-428` | KC PINEAPPLE 250ML | bottle | 0.00 | 0.00 | 28.00 | bar_store |
| `FG-429` | KC PINEAPPLE 350ML | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-430` | KC PINEAPPLE 750ML | bottle | 0.00 | 0.00 | 15.00 | bar_store |
| `FG-431` | KC SMOOTH 250ML | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-432` | KC SMOOTH 350ML | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-433` | KC SMOOTH 750ML | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-454` | ROBERTSON WHISKY | pcs | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-290` | SINGLETON 12 YRS | pcs | 5,375.00 | 5,375.00 | 4.00 | bar_store |
| `FG-291` | SINGLETON 15 YRS | pcs | 6,500.00 | 6,500.00 | 4.00 | bar_store |
| `FG-292` | SINGLETON 18 YRS | pcs | 8,750.00 | 8,750.00 | 0.00 | bar_store |
| `FG-295` | VAT 69 350ML | pcs | 760.00 | 760.00 | 1,048.00 | bar_store |
| `FG-296` | VAT 69 750ML | pcs | 1,400.00 | 1,400.00 | 1,000.00 | bar_store |
| `FG-299` | WILLIAM LAWSONS 1 LTR | pcs | 2,229.00 | 2,229.00 | 5.00 | bar_store |
| `FG-297` | William Lawsons 350ml | pcs | 869.00 | 869.00 | 5.00 | bar_store |
| `FG-298` | William Lawsons 750ml | pcs | 1,750.00 | 1,750.00 | 1.00 | bar_store |

#### WINES

| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |
|-----|-----------|------|----------:|-------------:|----:|------------|
| `FG-305` | 4TH STREET SWEET RED | pcs | 905.00 | 905.00 | 4.00 | bar_store |
| `FG-307` | ASCONI | pcs | 1,630.00 | 1,630.00 | 6.00 | bar_store |
| `FG-308` | CAPRICE SWEET RED | pcs | 922.00 | 922.00 | 1.00 | bar_store |
| `FG-323` | CAPRICE SWEET WHITE | pcs | 922.00 | 922.00 | 0.00 | bar_store |
| `FG-309` | CASABUENA SANGRIA RED | pcs | 755.00 | 755.00 | 995.00 | bar_store |
| `FG-326` | CASABUENA SANGRIA WHITE | pcs | 755.00 | 755.00 | 999.00 | bar_store |
| `FG-439` | CELLAR CASK RED | bottle | 925.00 | 925.00 | 9.00 | bar_store |
| `FG-440` | CELLAR CASK WHITE | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-310` | CHAMDOR | pcs | 850.00 | 850.00 | 1,000.00 | bar_store |
| `FG-311` | DROSDTY HOF CLARET | pcs | 921.00 | 921.00 | 5.00 | bar_store |
| `FG-322` | DROSDTY HOF PREMIUM | pcs | 1,750.00 | 1,750.00 | 2.00 | bar_store |
| `FG-438` | DROSTDY HOF RED | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-437` | DROSTDY HOF WHITE | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-312` | FOUR COUSINS RED | pcs | 800.00 | 800.00 | 1.00 | bar_store |
| `FG-321` | FOUR COUSINS WHITE | pcs | 800.00 | 800.00 | 5.00 | bar_store |
| `FG-313` | FRONTERA | pcs | 1,000.00 | 1,000.00 | 1,000.00 | bar_store |
| `FG-316` | NEDERBURG RED | pcs | 1,986.00 | 1,986.00 | 3.00 | bar_store |
| `FG-409` | NEDERBURG WHITE | pcs | 1,609.00 | 1,609.00 | 0.00 | bar_store |
| `FG-317` | PENASOL | pcs | 850.00 | 850.00 | 1,000.00 | bar_store |
| `FG-441` | ROBERTSON RED | bottle | 0.00 | 0.00 | 0.00 | bar_store |
| `FG-318` | ROBERTSON SWEET RED | pcs | 1,000.00 | 1,000.00 | 0.00 | bar_store |
| `FG-442` | ROBERTSON WHITE | bottle | 0.00 | 0.00 | 0.00 | bar_store |

---
*Generated by `analyse_catalog.mjs` — 587 stock items | 399 bar POS | 482 kitchen POS*