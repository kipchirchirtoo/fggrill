// Desktop route registry - FINAL VERSION
// This app is now a pure native wrapper for the production website.
// It opens immediately to the specified terminal route.

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { SiteView } from '../app/SiteView';

export const router = createBrowserRouter([
  // ALL paths lead to the production website SiteView
  { 
    path: '/', 
    element: <SiteView />,
    errorElement: <SiteView /> // Fallback for any routing errors
  },
  {
    path: '*',
    element: <SiteView />
  }
]);
