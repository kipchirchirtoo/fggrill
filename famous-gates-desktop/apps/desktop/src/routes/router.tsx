// Desktop route registry - FINAL VERSION
// This app is now a pure native wrapper for the production website.
// It opens immediately to the specified terminal route.

import { createHashRouter } from 'react-router-dom';
import { SiteView } from '../app/SiteView';

export const router = createHashRouter([
  { path: '/', element: <SiteView />, errorElement: <SiteView /> },
  { path: '*', element: <SiteView /> }
]);
