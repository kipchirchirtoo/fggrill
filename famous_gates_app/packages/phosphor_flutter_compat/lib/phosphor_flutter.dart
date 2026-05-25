library phosphor_flutter;

import 'package:flutter/material.dart';

enum PhosphorIconsStyle { regular, light, thin, duotone, fill }

class PhosphorIcons {
  PhosphorIcons._();

  // ── Core icons ─────────────────────────────────────────────────────────────
  static IconData user([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fd, fontFamily: 'MaterialIcons'); // person
  static IconData users([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7ef, fontFamily: 'MaterialIcons'); // people
  static IconData userCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fd, fontFamily: 'MaterialIcons'); // person
  static IconData userPlus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fe, fontFamily: 'MaterialIcons'); // person_add
  static IconData userMinus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fc, fontFamily: 'MaterialIcons'); // person_remove
  static IconData userGear([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fd, fontFamily: 'MaterialIcons'); // person
  static IconData userCheck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fd, fontFamily: 'MaterialIcons'); // person
  static IconData userX([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7fd, fontFamily: 'MaterialIcons'); // person

  static IconData buildings([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home
  static IconData building([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home
  static IconData buildingOffice([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home
  static IconData buildingApartment([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home

  static IconData chartLine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e5, fontFamily: 'MaterialIcons'); // trending_up
  static IconData chartBar([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe26a, fontFamily: 'MaterialIcons'); // bar_chart
  static IconData chartPie([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe919, fontFamily: 'MaterialIcons'); // pie_chart
  static IconData chartArea([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e5, fontFamily: 'MaterialIcons'); // trending_up

  static IconData fileText([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list
  static IconData file([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list
  static IconData filePdf([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list
  static IconData fileImage([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list
  static IconData fileCsv([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list

  static IconData shield([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData shieldCheck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData shieldWarning([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData shieldX([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock

  static IconData lock([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData lockOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe898, fontFamily: 'MaterialIcons'); // lock_open
  static IconData lockKey([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData lockKeyOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe898, fontFamily: 'MaterialIcons'); // lock_open

  static IconData warning([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe002, fontFamily: 'MaterialIcons'); // error
  static IconData warningCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe002, fontFamily: 'MaterialIcons'); // error
  static IconData warningOctagon([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe002, fontFamily: 'MaterialIcons'); // error

  static IconData x([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5cd, fontFamily: 'MaterialIcons'); // close
  static IconData xCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5cd, fontFamily: 'MaterialIcons'); // close
  static IconData check([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe876, fontFamily: 'MaterialIcons'); // check
  static IconData checkCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe876, fontFamily: 'MaterialIcons'); // check

  static IconData listBullets([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe896, fontFamily: 'MaterialIcons'); // list
  static IconData list([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe896, fontFamily: 'MaterialIcons'); // list
  static IconData listNumbers([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe896, fontFamily: 'MaterialIcons'); // list
  static IconData listChecks([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe896, fontFamily: 'MaterialIcons'); // list

  static IconData treeStructure([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe940, fontFamily: 'MaterialIcons'); // account_tree
  static IconData folders([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe940, fontFamily: 'MaterialIcons'); // account_tree
  static IconData folder([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c7, fontFamily: 'MaterialIcons'); // folder
  static IconData folderOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c8, fontFamily: 'MaterialIcons'); // folder_open

  static IconData signOut([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe9ba, fontFamily: 'MaterialIcons'); // logout
  static IconData signIn([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe9b9, fontFamily: 'MaterialIcons'); // login

  static IconData magnifyingGlass([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8b6, fontFamily: 'MaterialIcons'); // search
  static IconData funnel([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe17a, fontFamily: 'MaterialIcons'); // filter_list

  static IconData bell([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f4, fontFamily: 'MaterialIcons'); // notifications
  static IconData bellRinging([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f4, fontFamily: 'MaterialIcons'); // notifications
  static IconData bellSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f4, fontFamily: 'MaterialIcons'); // notifications
  static IconData bellSlash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7f5, fontFamily: 'MaterialIcons'); // notifications_none

  static IconData cube([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe922, fontFamily: 'MaterialIcons'); // psychology
  static IconData package([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list

  static IconData bookmark([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe866, fontFamily: 'MaterialIcons'); // bookmark
  static IconData bookmarkSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe866, fontFamily: 'MaterialIcons'); // bookmark

  static IconData eye([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe417, fontFamily: 'MaterialIcons'); // visibility
  static IconData eyeSlash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe418, fontFamily: 'MaterialIcons'); // visibility_off

  static IconData clock([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe192, fontFamily: 'MaterialIcons'); // access_time
  static IconData clockCounterClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe627, fontFamily: 'MaterialIcons'); // autorenew

  static IconData calendar([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe916, fontFamily: 'MaterialIcons'); // calendar_today
  static IconData calendarCheck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe916, fontFamily: 'MaterialIcons'); // calendar_today

  static IconData plus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe145, fontFamily: 'MaterialIcons'); // add
  static IconData minus([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe15b, fontFamily: 'MaterialIcons'); // remove
  static IconData pencil([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c9, fontFamily: 'MaterialIcons'); // edit
  static IconData pencilSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c9, fontFamily: 'MaterialIcons'); // edit
  static IconData pencilLine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c9, fontFamily: 'MaterialIcons'); // edit

  static IconData trash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe872, fontFamily: 'MaterialIcons'); // delete
  static IconData trashSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe872, fontFamily: 'MaterialIcons'); // delete

  static IconData download([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5c4, fontFamily: 'MaterialIcons'); // download
  static IconData downloadSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5c4, fontFamily: 'MaterialIcons'); // download

  static IconData upload([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c6, fontFamily: 'MaterialIcons'); // upload
  static IconData uploadSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe2c6, fontFamily: 'MaterialIcons'); // upload

  static IconData printer([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8ad, fontFamily: 'MaterialIcons'); // print

  static IconData arrowsLeftRight([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe627, fontFamily: 'MaterialIcons'); // autorenew
  static IconData arrowsCounterClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe627, fontFamily: 'MaterialIcons'); // autorenew

  static IconData caretRight([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe315, fontFamily: 'MaterialIcons'); // chevron_right
  static IconData caretLeft([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe314, fontFamily: 'MaterialIcons'); // chevron_left
  static IconData caretDown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe313, fontFamily: 'MaterialIcons'); // expand_more
  static IconData caretUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe316, fontFamily: 'MaterialIcons'); // expand_less

  static IconData gear([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8b8, fontFamily: 'MaterialIcons'); // settings
  static IconData gearSix([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8b8, fontFamily: 'MaterialIcons'); // settings

  static IconData robot([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe922, fontFamily: 'MaterialIcons'); // psychology
  static IconData brain([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe922, fontFamily: 'MaterialIcons'); // psychology
  static IconData activity([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe87d, fontFamily: 'MaterialIcons'); // favorite
  static IconData heartbeat([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe87d, fontFamily: 'MaterialIcons'); // favorite

  static IconData notebook([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe80c, fontFamily: 'MaterialIcons'); // menu_book
  static IconData note([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe80c, fontFamily: 'MaterialIcons'); // menu_book
  static IconData notePencil([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe80c, fontFamily: 'MaterialIcons'); // menu_book

  static IconData terminal([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe868, fontFamily: 'MaterialIcons'); // terminal
  static IconData code([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe86f, fontFamily: 'MaterialIcons'); // code

  static IconData mapPin([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe55c, fontFamily: 'MaterialIcons'); // place
  static IconData mapTrifold([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe55c, fontFamily: 'MaterialIcons'); // place

  static IconData database([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1a0, fontFamily: 'MaterialIcons'); // storage
  static IconData server([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1a0, fontFamily: 'MaterialIcons'); // storage
  static IconData memory([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1a0, fontFamily: 'MaterialIcons'); // storage

  static IconData queue([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list

  static IconData envelope([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0be, fontFamily: 'MaterialIcons'); // email
  static IconData envelopeSimple([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0be, fontFamily: 'MaterialIcons'); // email
  static IconData envelopeOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0be, fontFamily: 'MaterialIcons'); // email

  static IconData cloudArrowUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d8, fontFamily: 'MaterialIcons'); // cloud_upload
  static IconData cloud([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d8, fontFamily: 'MaterialIcons'); // cloud_upload

  static IconData wrench([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe869, fontFamily: 'MaterialIcons'); // build

  static IconData crosshair([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0a2, fontFamily: 'MaterialIcons'); // gps_fixed
  static IconData target([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0a2, fontFamily: 'MaterialIcons'); // gps_fixed

  static IconData star([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe838, fontFamily: 'MaterialIcons'); // star
  static IconData starHalf([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe838, fontFamily: 'MaterialIcons'); // star
  static IconData sparkle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0c9, fontFamily: 'MaterialIcons'); // auto_awesome

  static IconData house([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home
  static IconData houseLine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home

  static IconData bed([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home
  static IconData bedSingle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88a, fontFamily: 'MaterialIcons'); // home

  static IconData key([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData keyhole([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock

  static IconData car([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe566, fontFamily: 'MaterialIcons'); // directions_car
  static IconData truck([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe566, fontFamily: 'MaterialIcons'); // directions_car

  static IconData wifi([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe63e, fontFamily: 'MaterialIcons'); // wifi
  static IconData wifiSlash([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe648, fontFamily: 'MaterialIcons'); // wifi_off

  static IconData wine([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf1e8, fontFamily: 'MaterialIcons'); // local_bar

  static IconData layoutDashboard([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe871, fontFamily: 'MaterialIcons'); // space_dashboard
  static IconData fork([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe56c, fontFamily: 'MaterialIcons'); // restaurant
  static IconData forkKnife([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe56c, fontFamily: 'MaterialIcons'); // restaurant
  static IconData slidersHorizontal([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe429, fontFamily: 'MaterialIcons'); // tune
  static IconData identificationCard([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea67, fontFamily: 'MaterialIcons'); // badge
  static IconData chatCircle([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0b7, fontFamily: 'MaterialIcons'); // chat
  static IconData fileSpreadsheet([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe262, fontFamily: 'MaterialIcons'); // table_chart
  static IconData warehouse([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0af, fontFamily: 'MaterialIcons'); // domain
  static IconData packageArrowUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf09b, fontFamily: 'MaterialIcons'); // upload
  static IconData cookingPot([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe56c, fontFamily: 'MaterialIcons'); // restaurant
  static IconData clockClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe627, fontFamily: 'MaterialIcons'); // autorenew
  static IconData receipt([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xef6e, fontFamily: 'MaterialIcons'); // receipt
  static IconData question([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8fd, fontFamily: 'MaterialIcons'); // help_outline
  static IconData spinner([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe1c4, fontFamily: 'MaterialIcons'); // hourglass_empty
  static IconData moon([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe855, fontFamily: 'MaterialIcons'); // access_time
  static IconData chefHat([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe56c, fontFamily: 'MaterialIcons'); // restaurant
  static IconData currencyDollar([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe57d, fontFamily: 'MaterialIcons'); // attach_money
  static IconData trophy([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xef1f, fontFamily: 'MaterialIcons'); // emoji_events
  static IconData arrowUpRight([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e5, fontFamily: 'MaterialIcons'); // trending_up
  static IconData bookOpen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe80c, fontFamily: 'MaterialIcons'); // menu_book
  static IconData clipboardText([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c3, fontFamily: 'MaterialIcons'); // assignment
  static IconData pen([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe3c9, fontFamily: 'MaterialIcons'); // edit
  static IconData certificate([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8f7, fontFamily: 'MaterialIcons'); // grade
  static IconData megaphone([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0f2, fontFamily: 'MaterialIcons'); // campaign
  static IconData shoppingBag([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xf1cc, fontFamily: 'MaterialIcons'); // shopping_bag
  static IconData fileArrowDown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe5c4, fontFamily: 'MaterialIcons'); // download
  static IconData bank([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe57d, fontFamily: 'MaterialIcons'); // attach_money
  static IconData calendarBlank([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe916, fontFamily: 'MaterialIcons'); // calendar_today
  static IconData clockCountdown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe192, fontFamily: 'MaterialIcons'); // access_time
  static IconData identificationBadge([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xea67, fontFamily: 'MaterialIcons'); // badge
  static IconData fingerprint([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe90d, fontFamily: 'MaterialIcons'); // fingerprint
  static IconData money([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe57d, fontFamily: 'MaterialIcons'); // attach_money
  static IconData phone([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0b0, fontFamily: 'MaterialIcons'); // phone
  static IconData creditCard([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe870, fontFamily: 'MaterialIcons'); // credit_card
  static IconData arrowsClockwise([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe627, fontFamily: 'MaterialIcons'); // autorenew
  static IconData coins([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe57d, fontFamily: 'MaterialIcons'); // attach_money
  static IconData palette([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe40a, fontFamily: 'MaterialIcons'); // palette
  static IconData globe([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe7c1, fontFamily: 'MaterialIcons'); // public
  static IconData info([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe88e, fontFamily: 'MaterialIcons'); // info
  static IconData gitPullRequest([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8d6, fontFamily: 'MaterialIcons'); // view_list
  static IconData trendUp([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e5, fontFamily: 'MaterialIcons'); // trending_up
  static IconData prohibit([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe897, fontFamily: 'MaterialIcons'); // lock
  static IconData paperPlaneTilt([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe0e1, fontFamily: 'MaterialIcons'); // send
  static IconData wallet([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe57d, fontFamily: 'MaterialIcons'); // attach_money
  static IconData shoppingCart([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8cc, fontFamily: 'MaterialIcons'); // shopping_cart
  static IconData trendDown([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe8e4, fontFamily: 'MaterialIcons'); // trending_down
  static IconData tag([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe925, fontFamily: 'MaterialIcons'); // local_offer
  static IconData wifiHigh([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe63e, fontFamily: 'MaterialIcons'); // wifi
  static IconData sun([PhosphorIconsStyle style = PhosphorIconsStyle.regular]) =>
      const IconData(0xe855, fontFamily: 'MaterialIcons'); // wb_sunny
}
