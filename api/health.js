// API Handler pour Vercel - Health Check
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('✅ Health check - Backend Vercel opérationnel');
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Document Scraping Backend - Vercel',
    version: '1.0.0',
    platform: 'Vercel Serverless',
    endpoints: {
      health: '/api/health',
      scrape: '/api/scrape',
      downloadPdf: '/api/download-pdf'
    }
  });
}
