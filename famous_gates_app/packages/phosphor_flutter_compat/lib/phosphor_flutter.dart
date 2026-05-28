library phosphor_flutter;

import 'package:flutter/material.dart';

enum PhosphorIconsStyle { regular, light, thin, duotone, fill }

/// Compatibility shim mapping Phosphor icon names → nearest Material Icons codepoints.
/// All codepoints are from the MaterialIcons font bundled with Flutter.
///
/// Reference: flutter/packages/flutter/lib/src/material/icons.dart
class PhosphorIcons {
  PhosphorIcons._();

  // ── People ─────────────────────────────────────────────────────────────────
  /// person (0xe7fd)
  static IconData user([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fd, fontFamily: 'MaterialIcons');
  /// people (0xe7ef)
  static IconData users([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7ef, fontFamily: 'MaterialIcons');
  /// account_circle (0xe853)
  static IconData userCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe853, fontFamily: 'MaterialIcons');
  /// person_add (0xe7fe)
  static IconData userPlus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fe, fontFamily: 'MaterialIcons');
  /// person_remove (0xf384)
  static IconData userMinus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf384, fontFamily: 'MaterialIcons');
  /// manage_accounts (0xf02e)
  static IconData userGear([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf02e, fontFamily: 'MaterialIcons');
  /// how_to_reg (0xe879)
  static IconData userCheck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe879, fontFamily: 'MaterialIcons');
  /// person_off (0xf386)
  static IconData userX([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf386, fontFamily: 'MaterialIcons');

  // ── Buildings ──────────────────────────────────────────────────────────────
  /// business (0xe0af)
  static IconData buildings([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0af, fontFamily: 'MaterialIcons');
  /// domain (0xe0af) — same as business, best match for single building
  static IconData building([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0af, fontFamily: 'MaterialIcons');
  /// corporate_fare (0xf142)
  static IconData buildingOffice([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf142, fontFamily: 'MaterialIcons');
  /// apartment (0xea40)
  static IconData buildingApartment([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea40, fontFamily: 'MaterialIcons');

  // ── Charts ─────────────────────────────────────────────────────────────────
  /// trending_up (0xe8e5)
  static IconData chartLine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e5, fontFamily: 'MaterialIcons');
  /// bar_chart (0xe26a)
  static IconData chartBar([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe26a, fontFamily: 'MaterialIcons');
  /// pie_chart (0xe6c4)
  static IconData chartPie([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe6c4, fontFamily: 'MaterialIcons');
  /// show_chart (0xe6e1)
  static IconData chartArea([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe6e1, fontFamily: 'MaterialIcons');

  // ── Files & Documents ──────────────────────────────────────────────────────
  /// description (0xe873)
  static IconData fileText([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe873, fontFamily: 'MaterialIcons');
  /// insert_drive_file (0xe894)
  static IconData file([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe894, fontFamily: 'MaterialIcons');
  /// picture_as_pdf (0xe415)
  static IconData filePdf([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe415, fontFamily: 'MaterialIcons');
  /// image (0xe3f4)
  static IconData fileImage([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3f4, fontFamily: 'MaterialIcons');
  /// grid_on (0xe3ec)
  static IconData fileCsv([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3ec, fontFamily: 'MaterialIcons');
  /// cloud_download (0xe2c0)
  static IconData fileArrowDown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c0, fontFamily: 'MaterialIcons');
  /// table_chart (0xe265)
  static IconData fileSpreadsheet([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe265, fontFamily: 'MaterialIcons');

  // ── Security & Auth ────────────────────────────────────────────────────────
  /// security (0xe32a)
  static IconData shield([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe32a, fontFamily: 'MaterialIcons');
  /// verified_user (0xe8e8)
  static IconData shieldCheck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e8, fontFamily: 'MaterialIcons');
  /// gpp_maybe (0xf0a7)
  static IconData shieldWarning([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0a7, fontFamily: 'MaterialIcons');
  /// gpp_bad (0xf0a5)
  static IconData shieldX([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0a5, fontFamily: 'MaterialIcons');
  /// lock (0xe897)
  static IconData lock([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons');
  /// lock_open (0xe898)
  static IconData lockOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe898, fontFamily: 'MaterialIcons');
  /// vpn_key (0xe0da)
  static IconData lockKey([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0da, fontFamily: 'MaterialIcons');
  /// key_off (0xebd7)
  static IconData lockKeyOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xebd7, fontFamily: 'MaterialIcons');
  /// fingerprint (0xe90d)
  static IconData fingerprint([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe90d, fontFamily: 'MaterialIcons');

  // ── Warnings & Status ──────────────────────────────────────────────────────
  /// warning_amber (0xe002) — warning triangle
  static IconData warning([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe002, fontFamily: 'MaterialIcons');
  /// error_outline (0xe001)
  static IconData warningCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe001, fontFamily: 'MaterialIcons');
  /// report (0xe160)
  static IconData warningOctagon([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe160, fontFamily: 'MaterialIcons');
  /// info (0xe88e)
  static IconData info([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88e, fontFamily: 'MaterialIcons');

  // ── Actions ────────────────────────────────────────────────────────────────
  /// close (0xe5cd)
  static IconData x([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5cd, fontFamily: 'MaterialIcons');
  /// cancel (0xe5c9)
  static IconData xCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5c9, fontFamily: 'MaterialIcons');
  /// check (0xe876)
  static IconData check([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe876, fontFamily: 'MaterialIcons');
  /// check_circle (0xe86c)
  static IconData checkCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe86c, fontFamily: 'MaterialIcons');
  /// add (0xe145)
  static IconData plus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe145, fontFamily: 'MaterialIcons');
  /// remove (0xe15b)
  static IconData minus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe15b, fontFamily: 'MaterialIcons');
  /// delete (0xe872)
  static IconData trash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe872, fontFamily: 'MaterialIcons');
  /// delete_outline (0xe92e)
  static IconData trashSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe92e, fontFamily: 'MaterialIcons');
  /// edit (0xe3c9)
  static IconData pencil([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c9, fontFamily: 'MaterialIcons');
  /// edit_note (0xf0d2)
  static IconData pencilLine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0d2, fontFamily: 'MaterialIcons');
  /// edit_outlined (0xe3c9)
  static IconData pencilSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c9, fontFamily: 'MaterialIcons');
  /// create (0xe150)
  static IconData pen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe150, fontFamily: 'MaterialIcons');
  /// note_alt (0xf0c3)
  static IconData notePencil([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0c3, fontFamily: 'MaterialIcons');
  /// block (0xe14b)
  static IconData prohibit([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe14b, fontFamily: 'MaterialIcons');
  /// print (0xe8ad)
  static IconData printer([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8ad, fontFamily: 'MaterialIcons');
  /// upload (0xf09b)
  static IconData upload([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf09b, fontFamily: 'MaterialIcons');
  /// upload_file (0xf09c)
  static IconData uploadSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf09c, fontFamily: 'MaterialIcons');
  /// download (0xf090)
  static IconData download([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf090, fontFamily: 'MaterialIcons');
  /// download_for_offline (0xf091)
  static IconData downloadSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf091, fontFamily: 'MaterialIcons');
  /// refresh (0xe5d5)
  static IconData arrowsClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5d5, fontFamily: 'MaterialIcons');
  /// undo (0xe166)
  static IconData arrowsCounterClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe166, fontFamily: 'MaterialIcons');
  /// swap_horiz (0xe8d4)
  static IconData arrowsLeftRight([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d4, fontFamily: 'MaterialIcons');
  /// open_in_new (0xe89e)
  static IconData arrowUpRight([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe89e, fontFamily: 'MaterialIcons');
  /// send (0xe163)
  static IconData paperPlaneTilt([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe163, fontFamily: 'MaterialIcons');

  // ── Navigation & UI ────────────────────────────────────────────────────────
  /// format_list_bulleted (0xe241)
  static IconData listBullets([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe241, fontFamily: 'MaterialIcons');
  /// list (0xe896)
  static IconData list([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe896, fontFamily: 'MaterialIcons');
  /// format_list_numbered (0xe242)
  static IconData listNumbers([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe242, fontFamily: 'MaterialIcons');
  /// fact_check (0xf0c5)
  static IconData listChecks([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0c5, fontFamily: 'MaterialIcons');
  /// account_tree (0xe940)
  static IconData treeStructure([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe940, fontFamily: 'MaterialIcons');
  /// folder_copy (0xebbd)
  static IconData folders([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xebbd, fontFamily: 'MaterialIcons');
  /// folder (0xe2c7)
  static IconData folder([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c7, fontFamily: 'MaterialIcons');
  /// folder_open (0xe2c8)
  static IconData folderOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c8, fontFamily: 'MaterialIcons');
  /// logout (0xe9ba)
  static IconData signOut([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe9ba, fontFamily: 'MaterialIcons');
  /// login (0xe9b9)
  static IconData signIn([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe9b9, fontFamily: 'MaterialIcons');
  /// search (0xe8b6)
  static IconData magnifyingGlass([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8b6, fontFamily: 'MaterialIcons');
  /// filter_list (0xe17a)
  static IconData funnel([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe17a, fontFamily: 'MaterialIcons');
  /// dashboard (0xe871)
  static IconData layoutDashboard([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe871, fontFamily: 'MaterialIcons');
  /// tune (0xe429)
  static IconData slidersHorizontal([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe429, fontFamily: 'MaterialIcons');
  /// help_outline (0xe8fd)
  static IconData question([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8fd, fontFamily: 'MaterialIcons');
  /// home (0xe88a)
  static IconData house([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons');
  /// cottage (0xf02b)
  static IconData houseLine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf02b, fontFamily: 'MaterialIcons');
  /// keyboard_arrow_down (0xe313)
  static IconData caretDown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe313, fontFamily: 'MaterialIcons');
  /// keyboard_arrow_right (0xe315)
  static IconData caretRight([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe315, fontFamily: 'MaterialIcons');
  /// keyboard_arrow_left (0xe314)
  static IconData caretLeft([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe314, fontFamily: 'MaterialIcons');
  /// keyboard_arrow_up (0xe316)
  static IconData caretUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe316, fontFamily: 'MaterialIcons');

  // ── Notifications ──────────────────────────────────────────────────────────
  /// notifications (0xe7f4)
  static IconData bell([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f4, fontFamily: 'MaterialIcons');
  /// notifications_active (0xe7f7)
  static IconData bellRinging([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f7, fontFamily: 'MaterialIcons');
  /// circle_notifications (0xe994)
  static IconData bellSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe994, fontFamily: 'MaterialIcons');
  /// notifications_off (0xe7f6)
  static IconData bellSlash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f6, fontFamily: 'MaterialIcons');

  // ── Inventory & Logistics ──────────────────────────────────────────────────
  /// inventory_2 (0xe1b8)
  static IconData cube([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1b8, fontFamily: 'MaterialIcons');
  /// inventory (0xe1b7)
  static IconData package([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1b7, fontFamily: 'MaterialIcons');
  /// move_to_inbox (0xe168)
  static IconData packageArrowUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe168, fontFamily: 'MaterialIcons');
  /// local_shipping (0xe558)
  static IconData truck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe558, fontFamily: 'MaterialIcons');
  /// warehouse (0xf8ee)
  static IconData warehouse([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf8ee, fontFamily: 'MaterialIcons');
  /// local_grocery_store (0xe549)
  static IconData shoppingCart([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe549, fontFamily: 'MaterialIcons');
  /// shopping_bag (0xf1cc)
  static IconData shoppingBag([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf1cc, fontFamily: 'MaterialIcons');
  /// tag (0xe9ef)
  static IconData tag([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe9ef, fontFamily: 'MaterialIcons');

  // ── Finance & Payments ─────────────────────────────────────────────────────
  /// receipt_long (0xf395)
  static IconData receipt([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf395, fontFamily: 'MaterialIcons');
  /// account_balance (0xe84f)
  static IconData bank([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe84f, fontFamily: 'MaterialIcons');
  /// credit_card (0xe870)
  static IconData creditCard([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe870, fontFamily: 'MaterialIcons');
  /// attach_money (0xe227)
  static IconData currencyDollar([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe227, fontFamily: 'MaterialIcons');
  /// paid (0xf041)
  static IconData coins([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf041, fontFamily: 'MaterialIcons');
  /// payments (0xf3f4)
  static IconData money([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf3f4, fontFamily: 'MaterialIcons');
  /// account_balance_wallet (0xe850)
  static IconData wallet([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe850, fontFamily: 'MaterialIcons');
  /// trending_down (0xe8e4)
  static IconData trendDown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e4, fontFamily: 'MaterialIcons');
  /// trending_up (0xe8e5)
  static IconData trendUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e5, fontFamily: 'MaterialIcons');

  // ── Food & Hospitality ─────────────────────────────────────────────────────
  /// restaurant (0xe56c)
  static IconData forkKnife([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe56c, fontFamily: 'MaterialIcons');
  /// fork_left (0xebb8) — or use restaurant
  static IconData fork([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe56c, fontFamily: 'MaterialIcons');
  /// soup_kitchen (0xf866)
  static IconData cookingPot([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf866, fontFamily: 'MaterialIcons');
  /// sports_bar (0xf1e1)
  static IconData wine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf1e1, fontFamily: 'MaterialIcons');
  /// hotel (0xe53a)
  static IconData bed([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe53a, fontFamily: 'MaterialIcons');
  /// single_bed (0xf234)
  static IconData bedSingle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf234, fontFamily: 'MaterialIcons');
  /// emoji_food_beverage (0xea1b)
  static IconData chefHat([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea1b, fontFamily: 'MaterialIcons');

  // ── Communication ──────────────────────────────────────────────────────────
  /// chat_bubble_outline (0xe0ca)
  static IconData chatCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0ca, fontFamily: 'MaterialIcons');
  /// email (0xe0be)
  static IconData envelope([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0be, fontFamily: 'MaterialIcons');
  /// drafts (0xe151)
  static IconData envelopeOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe151, fontFamily: 'MaterialIcons');
  /// forward_to_inbox (0xf0d5)
  static IconData envelopeSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0d5, fontFamily: 'MaterialIcons');
  /// phone (0xe0cd)
  static IconData phone([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0cd, fontFamily: 'MaterialIcons');
  /// campaign (0xef49)
  static IconData megaphone([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xef49, fontFamily: 'MaterialIcons');

  // ── Time & Calendar ────────────────────────────────────────────────────────
  /// access_time (0xe192)
  static IconData clock([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe192, fontFamily: 'MaterialIcons');
  /// update (0xe923)
  static IconData clockClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe923, fontFamily: 'MaterialIcons');
  /// hourglass_bottom (0xea5c)
  static IconData clockCountdown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea5c, fontFamily: 'MaterialIcons');
  /// history (0xe889)
  static IconData clockCounterClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe889, fontFamily: 'MaterialIcons');
  /// calendar_today (0xe859)
  static IconData calendar([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe859, fontFamily: 'MaterialIcons');
  /// calendar_month (0xebcc)
  static IconData calendarBlank([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xebcc, fontFamily: 'MaterialIcons');
  /// event_available (0xe614)
  static IconData calendarCheck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe614, fontFamily: 'MaterialIcons');

  // ── Location & Map ─────────────────────────────────────────────────────────
  /// location_on (0xe0c8)
  static IconData mapPin([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0c8, fontFamily: 'MaterialIcons');
  /// map (0xe55b)
  static IconData mapTrifold([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe55b, fontFamily: 'MaterialIcons');
  /// globe (0xe894) — use language as closest
  static IconData globe([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe894, fontFamily: 'MaterialIcons');

  // ── Tech & Data ────────────────────────────────────────────────────────────
  /// storage (0xe1db)
  static IconData database([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1db, fontFamily: 'MaterialIcons');
  /// cloud (0xe2bd)
  static IconData cloud([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2bd, fontFamily: 'MaterialIcons');
  /// cloud_upload (0xe2c3)
  static IconData cloudArrowUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c3, fontFamily: 'MaterialIcons');
  /// dns (0xe875)
  static IconData server([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe875, fontFamily: 'MaterialIcons');
  /// memory (0xe322)
  static IconData memory([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe322, fontFamily: 'MaterialIcons');
  /// code (0xe86f)
  static IconData code([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe86f, fontFamily: 'MaterialIcons');
  /// terminal (0xeb8e)
  static IconData terminal([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xeb8e, fontFamily: 'MaterialIcons');
  /// smart_toy (0xf839)
  static IconData robot([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf839, fontFamily: 'MaterialIcons');
  /// queue (0xe8da)
  static IconData queue([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8da, fontFamily: 'MaterialIcons');
  /// wifi (0xe63e)
  static IconData wifi([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe63e, fontFamily: 'MaterialIcons');
  /// signal_wifi_4_bar (0xe1d8)
  static IconData wifiHigh([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1d8, fontFamily: 'MaterialIcons');
  /// wifi_off (0xe648)
  static IconData wifiSlash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe648, fontFamily: 'MaterialIcons');

  // ── Misc ───────────────────────────────────────────────────────────────────
  /// visibility (0xe417)
  static IconData eye([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe417, fontFamily: 'MaterialIcons');
  /// visibility_off (0xe418)
  static IconData eyeSlash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe418, fontFamily: 'MaterialIcons');
  /// settings (0xe8b8)
  static IconData gear([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8b8, fontFamily: 'MaterialIcons');
  /// manage_accounts (0xf02e)
  static IconData gearSix([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf02e, fontFamily: 'MaterialIcons');
  /// bookmark (0xe866)
  static IconData bookmark([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe866, fontFamily: 'MaterialIcons');
  /// bookmarks (0xe98b)
  static IconData bookmarkSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe98b, fontFamily: 'MaterialIcons');
  /// menu_book (0xea19)
  static IconData bookOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea19, fontFamily: 'MaterialIcons');
  /// note (0xe06f)
  static IconData note([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe06f, fontFamily: 'MaterialIcons');
  /// import_contacts (0xe1c4)
  static IconData notebook([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1c4, fontFamily: 'MaterialIcons');
  /// palette (0xe40a)
  static IconData palette([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe40a, fontFamily: 'MaterialIcons');
  /// psychology (0xea4a)
  static IconData brain([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea4a, fontFamily: 'MaterialIcons');
  /// auto_awesome (0xef53)
  static IconData sparkle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xef53, fontFamily: 'MaterialIcons');
  /// sync (0xe627)
  static IconData spinner([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe627, fontFamily: 'MaterialIcons');
  /// nightlight_round (0xef62)
  static IconData moon([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xef62, fontFamily: 'MaterialIcons');
  /// light_mode (0xe518)
  static IconData sun([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe518, fontFamily: 'MaterialIcons');
  /// local_car_wash (0xe546)
  static IconData car([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe546, fontFamily: 'MaterialIcons');
  /// build (0xe869)
  static IconData wrench([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe869, fontFamily: 'MaterialIcons');
  /// key (0xe73c)
  static IconData key([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe73c, fontFamily: 'MaterialIcons');
  /// lock_clock (0xf0a3)
  static IconData keyhole([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf0a3, fontFamily: 'MaterialIcons');
  /// badge (0xea67)
  static IconData identificationBadge([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea67, fontFamily: 'MaterialIcons');
  /// contact_page (0xf1ff)
  static IconData identificationCard([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf1ff, fontFamily: 'MaterialIcons');
  /// assignment (0xe85d)
  static IconData clipboardText([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe85d, fontFamily: 'MaterialIcons');
  /// call_merge (0xe0c1)
  static IconData gitPullRequest([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0c1, fontFamily: 'MaterialIcons');
  /// stars (0xe8d0)
  static IconData trophy([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d0, fontFamily: 'MaterialIcons');
  /// star (0xe838)
  static IconData star([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe838, fontFamily: 'MaterialIcons');
  /// star_half (0xe839)
  static IconData starHalf([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe839, fontFamily: 'MaterialIcons');
  /// gps_fixed (0xe1b3)
  static IconData crosshair([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1b3, fontFamily: 'MaterialIcons');
  /// my_location (0xe55c)
  static IconData target([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe55c, fontFamily: 'MaterialIcons');
  /// monitor_heart (0xf5a9)
  static IconData heartbeat([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf5a9, fontFamily: 'MaterialIcons');
  /// query_stats (0xf205)
  static IconData activity([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf205, fontFamily: 'MaterialIcons');
  /// school (0xe80c)
  static IconData certificate([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe80c, fontFamily: 'MaterialIcons');
}
