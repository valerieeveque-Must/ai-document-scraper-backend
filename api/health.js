// API Handler pour Vercel - Health Check CORS FIXÉ
export default async function handler(req, res) {
  // CORS headers COMPLETS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('✅ Health check - Backend Vercel CORS FIXÉ');
  
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Document Scraping Backend - Vercel CORS FIXÉ',
    version: '1.0.3',
    platform: 'Vercel Serverless',
    endpoints: {
      health: '/api/health',
      scrape: '/api/scrape',
      downloadPdf: '/api/download-pdf'
    },
    cors: 'ENABLED_FIXED',
    ready: true,
    test: 'BACKEND_ACCESSIBLE'
  });
}
