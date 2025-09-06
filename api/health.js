// API Handler pour Vercel - Health Check CORS FIXÉ POUR BOLT
export default async function handler(req, res) {
  // CORS headers COMPLETS avec domaine Bolt
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-HTTP-Method-Override');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Headers supplémentaires pour Bolt
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('✅ Health check - Backend Vercel CORS FIXÉ POUR BOLT');
  console.log('🌐 Origin:', req.headers.origin);
  
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Document Scraping Backend - Vercel CORS FIXÉ POUR BOLT',
    version: '1.0.4',
    platform: 'Vercel Serverless',
    origin: req.headers.origin,
    endpoints: {
      health: '/api/health',
      scrape: '/api/scrape',
      downloadPdf: '/api/download-pdf'
    },
    cors: 'ENABLED_FIXED_FOR_BOLT',
    ready: true,
    test: 'BACKEND_ACCESSIBLE_FROM_BOLT'
  });
}
