# Bugfix Requirements Document

## Introduction

The landing-page Next.js app (Pages Router) produces repeated "Hydration failed because the initial UI does not match what was rendered on the server" errors in the browser console. Three root causes have been identified across two files: the `Header` component applies a scroll-driven CSS class that differs between server and client on mid-scroll page refreshes; the `Home` page applies a `heroLoaded` class in a `useEffect` that causes the hero content element's class to differ between SSR and the first client render; and two date `<input>` elements compute `new Date()` at render time, meaning the server and client can produce different `min` attribute values when the render timestamps differ.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the page is server-rendered, the `<header>` element always receives the class `lp-nav` (without `lp-nav--scrolled`), but WHEN the browser hydrates after a mid-scroll page refresh the client immediately computes `window.scrollY > 60` as `true` and renders `lp-nav lp-nav--scrolled`, THEN the system produces a host component mismatch hydration error on the `<header>` element.

1.2 WHEN the page is server-rendered, the hero content `<div>` receives the class `lp-hero__content` (without `loaded`), but WHEN the client hydrates it runs `useEffect` which sets `heroLoaded = true` before React has finished reconciling, THEN the system produces a host component mismatch hydration error on the hero content element.

1.3 WHEN the page is server-rendered, the Check-In date input's `min` attribute is computed as `new Date().toISOString().split('T')[0]` at SSR time, but WHEN the client hydrates it recomputes `new Date()` at a different millisecond (or across a midnight boundary), THEN the system produces a host component mismatch hydration error on the Check-In `<input>` element.

1.4 WHEN the page is server-rendered, the Check-Out date input's `min` attribute falls back to `new Date().toISOString().split('T')[0]` (when `checkIn` is empty), but WHEN the client hydrates it recomputes `new Date()` at a different timestamp, THEN the system produces a host component mismatch hydration error on the Check-Out `<input>` element.

### Expected Behavior (Correct)

2.1 WHEN the page hydrates after a mid-scroll page refresh, the system SHALL suppress the hydration warning on the `<header>` element (via `suppressHydrationWarning`) so that the scroll-driven class difference does not cause a hydration error, and the scroll listener SHALL update the class correctly after mount.

2.2 WHEN the page hydrates, the system SHALL suppress the hydration warning on the hero content `<div>` (via `suppressHydrationWarning`) so that the `loaded` class difference between SSR and the initial client render does not cause a hydration error, and the `useEffect` SHALL apply the `loaded` class correctly after mount.

2.3 WHEN the page hydrates, the Check-In date input's `min` attribute SHALL be computed client-side only (after mount), so that the server and client render the same initial value (empty string or omitted), eliminating the hydration mismatch.

2.4 WHEN the page hydrates, the Check-Out date input's `min` attribute SHALL be computed client-side only (after mount), so that the server and client render the same initial value (empty string or omitted), eliminating the hydration mismatch.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user scrolls the page past 60 px, the system SHALL CONTINUE TO apply the `lp-nav--scrolled` class to the `<header>` element after hydration is complete.

3.2 WHEN the page finishes mounting, the system SHALL CONTINUE TO apply the `loaded` class to the hero content `<div>`, triggering the CSS entrance animation.

3.3 WHEN the page has mounted and the user has not yet selected a check-in date, the Check-In date input SHALL CONTINUE TO enforce today's date as the minimum selectable date.

3.4 WHEN the page has mounted and the user has not yet selected a check-in date, the Check-Out date input SHALL CONTINUE TO enforce today's date as the minimum selectable date.

3.5 WHEN the user selects a check-in date, the Check-Out date input SHALL CONTINUE TO enforce that selected check-in date as its minimum selectable date.

3.6 WHEN the mobile menu is closed (default state), the system SHALL CONTINUE TO not render the `lp-mobile-menu` element, and WHEN the hamburger button is clicked the system SHALL CONTINUE TO toggle the mobile menu open and closed correctly.
