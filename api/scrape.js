import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration Axios avec headers réalistes
const createAxiosInstance = () => {
  return axios.create({
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    }
  });
};

// Patterns de reconnaissance des documents
const documentPatterns = {
  'Document d\'Informations Clés (DIC)': {
    keywords: ['DIC', 'Document d\'Informations Clés', 'informations clés', 'key information', 'document-dinformations-cles'],
    filePatterns: [
      /DIC[-_][A-Z]{2}[-_]\d{6}[-_][A-Z]{2}[-_]\d+[-_]\d+\.pdf/i,
      /DIC.*\.pdf/i,
      /.*DIC.*\.pdf/i,
      /informations[-_]cles.*\.pdf/i,
      /document[-_]informations[-_]cles.*\.pdf/i
    ],
    linkTextPatterns: ['document d\'informations clés', 'informations clés', 'dic', 'key information document'],
    priority: 10,
    scoreBonus: 25
  },
  'Statuts': {
    keywords: ['statuts', 'statut', 'bylaws', 'articles', 'articles of association'],
    filePatterns: [
      /statuts?[-_].*\.pdf/i,
      /.*statuts?.*\.pdf/i,
      /bylaws.*\.pdf/i,
      /articles[-_]association.*\.pdf/i
    ],
    linkTextPatterns: ['statuts', 'statut', 'articles of association', 'bylaws'],
    priority: 9,
    scoreBonus: 20
  },
  'Note d\'information': {
    keywords: ['note', 'information', 'note d\'information', 'note information', 'information note'],
    filePatterns: [
      /note[-_].*information.*\.pdf/i,
      /note[-_].*\.pdf/i,
      /.*note.*information.*\.pdf/i,
      /information[-_]note.*\.pdf/i
    ],
    linkTextPatterns: ['note d\'information', 'note information', 'information note', 'note'],
    priority: 8,
    scoreBonus: 18
  },
  'Bulletin Trimestriel': {
    keywords: ['bulletin', 'trimestriel', 'quarterly', 'q1', 'q2', 'q3', 'q4', 'trimestre'],
    filePatterns: [
      /bulletin[-_].*trimestriel.*\.pdf/i,
      /bulletin[-_].*q[1-4].*\.pdf/i,
      /.*bulletin.*\d{4}[-_]q[1-4].*\.pdf/i,
      /quarterly[-_].*\.pdf/i,
      /.*trimestre.*\.pdf/i
    ],
    linkTextPatterns: ['bulletin trimestriel', 'bulletin du trimestre', 'quarterly bulletin', 'rapport trimestriel'],
    priority: 7,
    scoreBonus: 22
  },
  'Bulletin Semestriel': {
    keywords: ['bulletin', 'semestriel', 'semestre', 'half-yearly', 'semi-annual'],
    filePatterns: [
      /bulletin[-_].*semestriel.*\.pdf/i,
      /bulletin[-_].*semestre.*\.pdf/i,
      /.*bulletin.*\d{4}[-_]s[1-2].*\.pdf/i,
      /semi[-_]annual.*\.pdf/i
    ],
    linkTextPatterns: ['bulletin semestriel', 'bulletin du semestre', 'semi-annual bulletin', 'rapport semestriel'],
    priority: 6,
    scoreBonus: 22
  },
  'Rapport Annuel': {
    keywords: ['rapport', 'annuel', 'annual', 'yearly', 'report'],
    filePatterns: [
      /rapport[-_].*annuel.*\.pdf/i,
      /rapport[-_].*\d{4}.*\.pdf/i,
      /annual[-_]report.*\.pdf/i,
      /.*rapport.*annual.*\.pdf/i
    ],
    linkTextPatterns: ['rapport annuel', 'annual report', 'rapport de gestion', 'yearly report'],
    priority: 5,
    scoreBonus: 20
  },
  'Prospectus': {
    keywords: ['prospectus', 'offering', 'memorandum'],
    filePatterns: [
      /prospectus.*\.pdf/i,
      /.*prospectus.*\.pdf/i,
      /offering[-_]memorandum.*\.pdf/i
    ],
    linkTextPatterns: ['prospectus', 'offering memorandum', 'investment memorandum'],
    priority: 4,
    scoreBonus: 25
  },
  'Brochure Commerciale': {
    keywords: ['brochure', 'commercial', 'marketing', 'presentation', 'plaquette'],
    filePatterns: [
      /brochure.*\.pdf/i,
      /.*brochure.*\.pdf/i,
      /plaquette.*\.pdf/i,
      /presentation.*\.pdf/i,
      /marketing.*\.pdf/i
    ],
    linkTextPatterns: ['brochure commerciale', 'brochure', 'plaquette commerciale', 'présentation commerciale', 'marketing brochure'],
    priority: 3,
    scoreBonus: 15
  },
  'Fiche Produit': {
    keywords: ['fiche', 'produit', 'product', 'sheet', 'factsheet'],
    filePatterns: [
      /fiche[-_].*produit.*\.pdf/i,
      /fiche[-_].*\.pdf/i,
      /product[-_]sheet.*\.pdf/i,
      /factsheet.*\.pdf/i,
      /.*fiche.*\.pdf/i
    ],
    linkTextPatterns: ['fiche produit', 'fiche technique', 'product sheet', 'factsheet', 'fiche'],
    priority: 2,
    scoreBonus: 18
  }
};

// Fonctions utilitaires
function resolveUrl(href, baseUrl) {
  if (href.startsWith('http')) {
    return href;
  }
  try {
    return new URL(href, baseUrl).toString();
  } catch (error) {
    console.warn(`⚠️ URL invalide: ${href} (base: ${baseUrl})`);
    return href;
  }
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

function findBestMatch(pdfLinks, documentType) {
  const pattern = documentPatterns[documentType];
  if (!pattern) {
    console.warn(`⚠️ Pattern non trouvé pour: ${documentType}`);
    return null;
  }
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const link of pdfLinks) {
    let score = 0;
    const searchText = `${link.fileName} ${link.text} ${link.title} ${link.context}`.toLowerCase();
    
    // 1. Vérifier les patterns de fichier (score le plus élevé)
    for (const filePattern of pattern.filePatterns) {
      if (filePattern.test(link.fileName)) {
        score += pattern.scoreBonus + 10;
        break;
      }
    }
    
    // 2. Vérifier les mots-clés
    for (const keyword of pattern.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 8;
      }
    }
    
    // 3. Vérifier les patterns de texte de lien
    for (const textPattern of pattern.linkTextPatterns) {
      if (searchText.includes(textPattern.toLowerCase())) {
        score += 12;
      }
    }
    
    // 4. Bonus pour correspondance exacte du nom de fichier
    if (link.fileName.toLowerCase().includes(documentType.toLowerCase().split(' ')[0])) {
      score += 15;
    }
    
    // 5. Bonus de priorité
    score += pattern.priority;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ...link, score };
    }
  }
  
  return bestMatch;
}

function getConfidenceLevel(score) {
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// API Handler pour Vercel
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { url, documentTypes = [] } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL parameter is required' 
    });
  }

  console.log(`🕷️ SCRAPING DÉMARRÉ: ${url}`);
  console.log(`🎯 Types recherchés: ${documentTypes.join(', ')}`);

  try {
    const axiosInstance = createAxiosInstance();
    
    // Récupérer la page HTML avec retry logic
    let response;
    let retries = 3;
    
    while (retries > 0) {
      try {
        response = await axiosInstance.get(url);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`⚠️ Retry ${3 - retries}/3 pour ${url}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const html = response.data;
    console.log(`✅ HTML récupéré: ${html.length} caractères`);
    
    // Parser le HTML avec Cheerio
    const $ = cheerio.load(html);
    
    // Extraire tous les liens PDF avec métadonnées
    const pdfLinks = [];
    
    $('a[href]').each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      const title = $(element).attr('title') || '';
      const parentText = $(element).parent().text().trim();
      
      if (href && (href.toLowerCase().includes('.pdf') || text.toLowerCase().includes('pdf'))) {
        const fullUrl = resolveUrl(href, url);
        const fileName = extractFileName(fullUrl);
        
        pdfLinks.push({
          url: fullUrl,
          text: text,
          title: title,
          parentText: parentText,
          fileName: fileName,
          href: href,
          context: `${text} ${title} ${parentText}`.toLowerCase()
        });
      }
    });
    
    console.log(`🔍 ${pdfLinks.length} liens PDF trouvés`);
    
    // Matcher les documents selon les types demandés
    const matchedDocuments = [];
    
    for (const docType of documentTypes) {
      const bestMatch = findBestMatch(pdfLinks, docType);
      if (bestMatch) {
        matchedDocuments.push({
          documentType: docType,
          ...bestMatch,
          matchScore: bestMatch.score,
          confidence: getConfidenceLevel(bestMatch.score)
        });
        console.log(`✅ Match trouvé pour ${docType}: ${bestMatch.fileName} (score: ${bestMatch.score})`);
      } else {
        console.log(`❌ Aucun match pour ${docType}`);
      }
    }
    
    // Trier par score de confiance
    matchedDocuments.sort((a, b) => b.matchScore - a.matchScore);
    
    res.json({
      success: true,
      url: url,
      totalPdfLinks: pdfLinks.length,
      matchedDocuments: matchedDocuments,
      scrapedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Erreur scraping ${url}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      url: url,
      errorType: error.code || 'UNKNOWN_ERROR'
    });
  }
}
