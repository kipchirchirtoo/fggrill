export default function TestPage() {
  return (
    <div style={{ padding: '50px', fontFamily: 'Arial', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: '#333', fontSize: '32px', marginBottom: '20px' }}>✅ Next.js is Working!</h1>
      <p style={{ fontSize: '18px', marginBottom: '10px' }}>If you can see this page, Next.js is rendering correctly.</p>
      <p style={{ fontSize: '16px', color: '#666' }}>The issue with the main page might be:</p>
      <ul style={{ marginTop: '20px', fontSize: '16px', lineHeight: '1.8' }}>
        <li>CSS not loading properly</li>
        <li>JavaScript error in browser console</li>
        <li>Missing environment variables</li>
        <li>Browser cache issue</li>
      </ul>
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '2px solid #d4af37' }}>
        <h2 style={{ color: '#d4af37', marginBottom: '15px' }}>Next Steps:</h2>
        <ol style={{ lineHeight: '2' }}>
          <li>Open browser DevTools (F12)</li>
          <li>Check the Console tab for errors</li>
          <li>Check the Network tab for failed requests</li>
          <li>Try visiting <a href="/" style={{ color: '#d4af37' }}>the home page</a> again</li>
          <li>Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)</li>
        </ol>
      </div>
    </div>
  );
}
