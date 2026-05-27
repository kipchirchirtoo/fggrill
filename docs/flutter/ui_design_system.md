# Flutter UI Design System

## Source of Truth

The canonical dashboard UI is the current Flutter Superadmin implementation:

- `famous_gates_app/lib/features/superadmin/presentation/superadmin_screen.dart`
- `famous_gates_app/lib/features/superadmin/presentation/widgets/superadmin_side_nav.dart`
- `famous_gates_app/lib/features/superadmin/presentation/widgets/superadmin_top_bar.dart`
- `famous_gates_app/lib/core/theme/app_theme.dart`
- shared table/card primitives in `famous_gates_app/lib/core/widgets`

All migrated dashboards must reuse this visual language.

## Theme Tokens

Colors from `AppColors`:

- Primary: `#1A3C5E`
- Accent: `#D4A843`
- Surface: `#FAF9F7`
- Card background: `#FFFFFF`
- Text primary: `#1A1A1A`
- Text secondary: `#6B7280`
- Success: `#16A34A`
- Warning: `#F59E0B`
- Error: `#DC2626`
- Divider: `#E5E7EB`

Typography:

- Font family: `SF Pro Display`
- Display large: 32, bold
- Display medium: 28, bold
- Display small: 24, bold
- Body large: 16
- Body medium: 14

## Dashboard Shell

Responsive rules:

- Mobile: width `< 768`, no permanent side nav, bottom nav plus menu sheet.
- Tablet: width `>= 768 && < 1024`, collapsed side nav width `64`.
- Desktop: width `>= 1024`, expanded side nav. Superadmin uses `240`; Admin shell currently uses `220`. Migration target is `240` unless an existing module has a measured layout issue.

Shell structure:

- Scaffold background `AppColors.kSurface`.
- Horizontal `Row`.
- Left side nav with white background, right border `AppColors.kDivider`, subtle shadow.
- Main content column with top bar and `Expanded` content.
- Page transitions use `AnimatedSwitcher` with 200ms duration where dashboard section content changes.

## Sidebar

Logo/header:

- Padding 24.
- Logo square 40x40, primary background, 10px radius, white initials.
- Expanded title and subtitle where not collapsed.

Navigation item:

- Horizontal margin 12, vertical margin 2.
- Padding horizontal 12, vertical 12.
- Radius 10.
- Active background: primary alpha 0.10.
- Active icon/text: primary.
- Inactive icon/text: text secondary.
- Collapsed mode centers icon and hides labels.

Group headers:

- Uppercase label, letter spacing.
- Text secondary, small size.
- Hidden or compacted in collapsed mode.

Logout:

- Bottom item or system group item.
- Must call `authNotifierProvider.notifier.logout()` directly. Do not pop Navigator from menu callbacks.

## Top Bar

Superadmin topbar:

- White background with bottom border `AppColors.kDivider`.
- Padding horizontal 24, vertical 16.
- Mobile hamburger when side nav is hidden.
- Breadcrumb text: `SuperAdmin > Dashboard`, 14px, secondary.
- Optional search field: width 280, height 40, filled `Colors.grey.shade50`, 8px radius.
- Notification button with red unread dot/badge.
- User menu with avatar initials and profile/settings/logout items.

Admin/auditor topbar compatible pattern:

- Height 60.
- Logo FG square 28x28, primary, radius 6.
- Title `Famous Gates — {Console Label}`.
- Live sync dot and branch chip.
- Notification bell and user avatar menu.

Migration rule: keep module-specific title/branch chip where required, but align spacing, colors, menu behavior, and logout handling with Superadmin.

## Cards

Use Material 3 cards with:

- White background.
- Radius 12.
- Elevation 2 for standalone cards; bordered/flat style is acceptable for dense tables.
- Padding 16-24 depending on density.
- Stat card icon in primary-tinted square.
- Values bold, labels text secondary.

## Tables

Use `DataTableWidget` or a shared descendant:

- Container radius 12 and `AppColors.kDivider` border.
- Header background primary with white 12px bold text.
- Rows padded horizontal 16, vertical 12.
- Alternating row background white / surface.
- Search field width 300 where present.
- Empty state uses icon, title, optional message and refresh button.
- Loading state uses skeleton rows.
- Row actions use compact popup menus or icon buttons with tooltips.

## Forms

Inputs:

- White filled fields.
- Outline border `AppColors.kDivider`.
- Focused border primary.
- Radius 8.
- Label and helper text use Material form conventions.

Validation:

- Use `Form` + validators for blocking validation.
- API validation errors should surface at field level when possible, otherwise snackbar/dialog.

## Dialogs and Sheets

Desktop dialogs:

- `AlertDialog` or custom `Dialog` with max width 420-720 depending on content.
- Radius 12.
- Header title, optional subtitle, body, footer buttons.
- Forms reset on close unless editing existing state intentionally.

Mobile:

- Use bottom sheets for long forms/lists.
- Top radius 20.
- Height capped around 70-90% depending on form length.

## Loading, Empty, Error

Loading:

- Prefer skeleton table rows for tables.
- Use centered progress only for whole-page first load.

Empty:

- Friendly neutral copy.
- Refresh/retry if the view is reloadable.

Error:

- Show business-level message, not raw Dio exception text.
- Include retry button.
- For 403 show permission state.
- For expected no-branch cases show branch selection guidance.

## Notifications

- Use `ScaffoldMessenger` or shared notification service.
- Success: concise result message.
- Error: backend message if available.
- Avoid raw stack traces and Dio boilerplate in UI.

## Responsive Behavior

- Mobile dashboards keep content in a single column and use bottom navigation.
- Tablet dashboards use collapsed sidebar and responsive grids.
- Desktop dashboards use expanded sidebar and multi-column cards/tables.
- Fixed-width action buttons in rows must be constrained. Never use infinite minimum width inside `Row`/unbounded parents.

## Animations

- Section changes: `AnimatedSwitcher` 200ms.
- Hover/selection transitions should be implicit where low cost.
- Do not add decorative animations that are absent from the Superadmin UI.
