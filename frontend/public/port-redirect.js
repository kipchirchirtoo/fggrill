// Check if we need to redirect to port 3000
(function() {
  // Only run on client
  if (typeof window !== 'undefined') {
    if (window.location.port === '3001') {
      // Redirect to port 3000
      const newUrl = window.location.protocol + '//' + 
                    window.location.hostname + ':3000' + 
                    window.location.pathname +
                    window.location.search +
                    window.location.hash;
      window.location.href = newUrl;
    }
  }
})();
