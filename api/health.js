// API Handler pour Vercel - Health Check
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('✅ Health check - Backend Vercel opérationnel');
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Document Scraping Backend - Vercel FIXED',
    version: '1.0.2',
    platform: 'Vercel Serverless',
    endpoints: {
      health: '/api/health',
      scrape: '/api/scrape',
      downloadPdf: '/api/download-pdf'
    },
    cors: 'enabled',
    ready: true
  });
}
