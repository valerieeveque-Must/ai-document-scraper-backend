import axios from 'axios';

// Configuration Axios pour téléchargement PDF
const createAxiosInstance = () => {
  return axios.create({
    timeout: 40000,
    maxRedirects: 5,
    maxContentLength: 50 * 1024 * 1024, // 50MB
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/pdf,*/*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    }
  });
};

function isPDFBuffer(buffer) {
  // Vérifier la signature PDF (%PDF-)
  const pdfSignature = Buffer.from('%PDF-');
  return buffer.length >= 5 && buffer.subarray(0, 5).equals(pdfSignature);
}

function extractFileName(url) {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.split('/').pop() || 'document.pdf';
    return decodeURIComponent(fileName);
  } catch (error) {
    return url.split('/').pop() || 'document.pdf';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// API Handler pour Vercel
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
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { pdfUrl, fileName, expectedSize } = req.body;
  
  if (!pdfUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'PDF URL is required' 
    });
  }

  console.log(`⬇️ TÉLÉCHARGEMENT PDF: ${pdfUrl}`);

  try {
    const axiosInstance = createAxiosInstance();
    
    // Vérifier la taille avec timeout réduit
    let contentLength = 0;
    try {
      const headResponse = await axiosInstance.head(pdfUrl, { timeout: 10000 });
      contentLength = parseInt(headResponse.headers['content-length'] || '0');
      console.log(`📏 Taille annoncée: ${formatFileSize(contentLength)}`);
      
      if (contentLength > 50 * 1024 * 1024) {
        throw new Error(`Fichier trop volumineux: ${formatFileSize(contentLength)}`);
      }
    } catch (headError) {
      console.log(`⚠️ HEAD request échouée, tentative de téléchargement direct`);
    }
    
    // Télécharger le PDF
    const response = await axiosInstance.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 35000, // Timeout pour Vercel
      headers: {
        'Accept': 'application/pdf,*/*',
        'Referer': new URL(pdfUrl).origin
      },
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percentCompleted % 25 === 0) {
            console.log(`📥 Téléchargement: ${percentCompleted}%`);
          }
        }
      }
    });
    
    const pdfBuffer = Buffer.from(response.data);
    
    // Valider que c'est bien un PDF
    if (!isPDFBuffer(pdfBuffer)) {
      throw new Error('Le fichier téléchargé n\'est pas un PDF valide');
    }
    
    // Vérifier la taille
    if (pdfBuffer.length > 50 * 1024 * 1024) {
      throw new Error(`Fichier trop volumineux: ${formatFileSize(pdfBuffer.length)}`);
    }
    
    // Générer les métadonnées
    const crypto = await import('crypto');
    const contentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const actualFileName = fileName || extractFileName(pdfUrl);
    
    console.log(`✅ PDF téléchargé avec succès:`);
    console.log(`   📄 Fichier: ${actualFileName}`);
    console.log(`   📏 Taille: ${formatFileSize(pdfBuffer.length)}`);
    console.log(`   🔐 Hash: ${contentHash.substring(0, 16)}...`);
    
    // Retourner les métadonnées et le contenu
    res.status(200).json({
      success: true,
      fileName: actualFileName,
      fileSize: pdfBuffer.length,
      contentHash: contentHash,
      downloadUrl: pdfUrl,
      contentType: response.headers['content-type'] || 'application/pdf',
      lastModified: response.headers['last-modified'] || new Date().toISOString(),
      serverDate: response.headers['date'],
      pdfData: pdfBuffer.toString('base64'),
      downloadedAt: new Date().toISOString(),
      backendVersion: '1.0.3'
    });
    
  } catch (error) {
    console.error(`❌ Erreur téléchargement PDF ${pdfUrl}:`, error.message);
    
    let errorType = 'DOWNLOAD_ERROR';
    if (error.code === 'ENOTFOUND') errorType = 'DNS_ERROR';
    else if (error.code === 'ECONNREFUSED') errorType = 'CONNECTION_REFUSED';
    else if (error.code === 'ETIMEDOUT') errorType = 'TIMEOUT_ERROR';
    else if (error.response?.status === 404) errorType = 'FILE_NOT_FOUND';
    else if (error.response?.status === 403) errorType = 'ACCESS_FORBIDDEN';
    
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: errorType,
      pdfUrl: pdfUrl,
      statusCode: error.response?.status
    });
  }
}
