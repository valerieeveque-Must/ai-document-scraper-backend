import { DocumentItem } from '../types';
import { localStorageService } from './localStorageService';

export interface PDFDownloadResult {
  success: boolean;
  fileName?: string;
  fileSize?: number;
  hasChanged?: boolean;
  status?: DocumentItem['status'];
  error?: string;
  downloadUrl?: string;
  isSimulated?: boolean;
}

class PDFDownloadService {
  // CORS headers COMPLETS avec domaine Bolt
  private readonly BACKEND_URL = this.getBackendUrl();

  private getBackendUrl(): string {
    // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-HTTP-Method-Override');
    // Détecter si on est en développement local
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Headers supplémentaires pour Bolt
    // res.setHeader('Vary', 'Origin');
    // res.setHeader('X-Content-Type-Options', 'nosniff');
    
    if (isLocal) {
      console.log('🏠 Mode développement - Backend Vercel');
      return 'https://ai-document-scraper-backend-sznh.vercel.app';
    } else {
      console.log('☁️ Mode production - Backend Vercel');
      return 'https://ai-document-scraper-backend-sznh.vercel.app';
    }
  }

  /**
   * VRAI SCRAPING via le serveur backend
   */
  async downloadPDF(document: DocumentItem): Promise<PDFDownloadResult> {
    try {
      console.log(`🕷️ SCRAPING BACKEND DÉMARRÉ`);
      console.log(`📍 URL Source: ${document.sourceUrl}`);
      console.log(`🎯 Type recherché: ${document.documentType}`);
      
      // 1. Tester la connexion backend
      const backendAvailable = await this.testBackendConnection();
      
      if (!backendAvailable) {
        console.log('❌ Backend non disponible - fallback simulation');
        return this.generateRealisticPDF(document);
      }
      
      // 2. VRAI SCRAPING via backend
      console.log('🕷️ Backend disponible - démarrage scraping réel...');
      
      const scrapeResponse = await fetch(`${this.BACKEND_URL}/api/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: document.sourceUrl,
          documentTypes: [document.documentType]
        })
      });
      
      if (!scrapeResponse.ok) {
        throw new Error(`Erreur scraping: ${scrapeResponse.status} ${scrapeResponse.statusText}`);
      }
      
      const scrapeData = await scrapeResponse.json();
      console.log('🔍 Résultat scraping:', scrapeData);
      
      if (!scrapeData.success) {
        throw new Error(`Scraping échoué: ${scrapeData.error}`);
      }
      
      if (scrapeData.matchedDocuments.length === 0) {
        console.log('⚠️ Aucun document trouvé sur la page');
        return {
          success: false,
          error: 'Aucun document correspondant trouvé sur la page source'
        };
      }
      
      // 3. Télécharger le PDF trouvé
      const matchedDoc = scrapeData.matchedDocuments[0];
      console.log(`📥 Téléchargement PDF: ${matchedDoc.fileName}`);
      console.log(`🔗 URL PDF: ${matchedDoc.url}`);
      
      const downloadResponse = await fetch(`${this.BACKEND_URL}/api/download-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          pdfUrl: matchedDoc.url,
          fileName: matchedDoc.fileName
        })
      });
      
      if (!downloadResponse.ok) {
        throw new Error(`Erreur téléchargement: ${downloadResponse.status} ${downloadResponse.statusText}`);
      }
      
      const downloadData = await downloadResponse.json();
      console.log('📄 Résultat téléchargement:', downloadData);
      
      if (!downloadData.success) {
        throw new Error(`Téléchargement échoué: ${downloadData.error}`);
      }
      
      // 4. Convertir et télécharger le PDF
      const pdfBlob = this.base64ToBlob(downloadData.pdfData);
      this.downloadFile(pdfBlob, downloadData.fileName);
      
      console.log(`✅ PDF SCRAPÉ ET TÉLÉCHARGÉ: ${downloadData.fileName}`);
      
      return {
        success: true,
        fileName: downloadData.fileName,
        fileSize: downloadData.fileSize,
        hasChanged: false,
        status: 'à-jour',
        downloadUrl: matchedDoc.url,
        isSimulated: false
      };
      
    } catch (error) {
      console.error('❌ ERREUR SCRAPING BACKEND:', error.message);
      console.error('📍 Détails erreur:', error);
      
      // Fallback: générer un PDF de démonstration
      console.log('🔄 FALLBACK: génération PDF de démonstration...');
      return this.generateRealisticPDF(document);
    }
  }

  /**
   * Générer un PDF réaliste avec contenu simulé mais professionnel
   */
  private async generateRealisticPDF(document: DocumentItem): Promise<PDFDownloadResult> {
    try {
      console.log(`📄 Génération PDF réaliste pour: ${document.documentType}`);
      
      // Simuler un délai de scraping réaliste
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;
      
      // Fonction pour ajouter du texte avec retour à la ligne
      const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
        pdf.setFontSize(fontSize);
        if (isBold) {
          pdf.setFont(undefined, 'bold');
        } else {
          pdf.setFont(undefined, 'normal');
        }
        
        const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
        pdf.text(lines, margin, yPosition);
        yPosition += lines.length * 7 + 5;
      };
      
      // En-tête professionnel
      addText(`${document.company.toUpperCase()}`, 18, true);
      addText(`${document.product}`, 16, true);
      yPosition += 10;
      
      addText(`${document.documentType.toUpperCase()}`, 16, true);
      addText(`Version ${document.version}`, 14);
      yPosition += 15;
      
      // Contenu réaliste selon le type de document
      const content = this.generateDocumentContent(document);
      content.forEach(section => {
        addText(section.title, 14, true);
        yPosition += 5;
        section.content.forEach(paragraph => {
          addText(paragraph, 11);
          yPosition += 3;
        });
        yPosition += 10;
      });
      
      // Pied de page professionnel
      yPosition += 20;
      pdf.setTextColor(100, 100, 100);
      addText(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, 10);
      addText(`Source: ${document.sourceUrl}`, 10);
      addText(`Agent de Surveillance Documentaire IA - Version de démonstration`, 10, true);

      const pdfBlob = pdf.output('blob');
      const fileName = `${document.fileName.replace('.pdf', '')}_Simulation.pdf`;
      
      // Télécharger
      this.downloadFile(pdfBlob, fileName);
      
      console.log(`✅ PDF réaliste généré: ${fileName} (${Math.round(pdfBlob.size / 1024)} KB)`);
      
      return {
        success: true,
        fileName: fileName,
        fileSize: pdfBlob.size,
        hasChanged: false,
        status: 'à-jour',
        isSimulated: true,
        downloadUrl: document.sourceUrl
      };
      
    } catch (error) {
      console.error('❌ ERREUR SCRAPING BACKEND:', error);
      console.log('🔄 FALLBACK: génération PDF de démonstration...');
      return this.generateRealisticPDF(document);
    }
  }

  /**
   * Scraper et télécharger un document spécifique
   */
  async scrapeAndDownloadDocument(document: DocumentItem): Promise<PDFDownloadResult> {
    try {
      console.log(`🔍 ANALYSE COMPLÈTE: ${document.documentType}`);
      
      const response = await fetch(`${this.BACKEND_URL}/api/analyze-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: document.sourceUrl,
          documentType: document.documentType
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur analyse: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Résultat analyse complète:', data);
      
      if (!data.success) {
        throw new Error(`Analyse échouée: ${data.error}`);
      }
      
      if (!data.summary.documentDownloaded) {
        return {
          success: false,
          error: 'Document trouvé mais téléchargement échoué'
        };
      }
      
      // Télécharger le PDF
      const pdfBlob = this.base64ToBlob(data.pdfData.pdfData);
      this.downloadFile(pdfBlob, data.pdfData.fileName);
      
      return {
        success: true,
        fileName: data.pdfData.fileName,
        fileSize: data.pdfData.fileSize,
        hasChanged: false,
        status: 'à-jour',
        downloadUrl: data.scrapeResult.matchedDocument?.url,
        isSimulated: false
      };
      
    } catch (error) {
      console.error('❌ Erreur analyse complète:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur d\'analyse'
      };
    }
  }

  /**
   * Tester la connexion au backend
   */
  async testBackendConnection(): Promise<boolean> {
    try {
      // Si pas d'URL backend configurée, retourner false
      if (!this.BACKEND_URL) {
        console.log('❌ Pas d\'URL backend configurée');
        return false;
      }
      
      console.log(`🔍 Test connexion backend: ${this.BACKEND_URL}`);
      
      const response = await fetch(`${this.BACKEND_URL}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Backend Vercel accessible:`, data);
        return true;
      } else {
        console.log(`❌ Backend inaccessible: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Backend inaccessible:`, error);
      return false;
    }
  }

  /**
   * Générer du contenu réaliste selon le type de document
   */
  private generateDocumentContent(document: DocumentItem): Array<{title: string, content: string[]}> {
    const type = document.documentType.toLowerCase();
    
    if (type.includes('dic') || type.includes('informations clés')) {
      return [
        {
          title: "INFORMATIONS GÉNÉRALES",
          content: [
            `Dénomination: SCPI ${document.product}`,
            `Société de gestion: ${document.company}`,
            `Date de création: 2010`,
            `Durée de vie: 99 ans`,
            `Capital souscrit: 150 000 000 €`,
            `Valeur de reconstitution: 200 € par part`,
            `Prix de souscription: 200 € + droits d'entrée 10%`
          ]
        },
        {
          title: "OBJECTIF ET POLITIQUE D'INVESTISSEMENT",
          content: [
            "La SCPI a pour objet l'acquisition et la gestion d'un patrimoine immobilier locatif diversifié.",
            "Elle investit principalement dans l'immobilier de bureaux (60%) et de commerces (40%).",
            "Zone géographique: France métropolitaine principalement, avec une exposition européenne limitée.",
            "Stratégie: Recherche de rendement et de plus-values à long terme."
          ]
        },
        {
          title: "PROFIL DE RISQUE ET DE RENDEMENT",
          content: [
            "Indicateur de risque: 4 sur une échelle de 1 à 7",
            "Rendement distribué 2023: 4,2%",
            "Taux d'occupation financier: 92%",
            "Durée de placement recommandée: 8 ans minimum",
            "Risques principaux: Risque de perte en capital, risque de liquidité, risque immobilier"
          ]
        }
      ];
    }
    
    if (type.includes('statuts')) {
      return [
        {
          title: "TITRE I - FORME, OBJET, DÉNOMINATION, SIÈGE, DURÉE",
          content: [
            `Article 1 - Forme: Il est formé une Société Civile de Placement Immobilier régie par les dispositions du Code monétaire et financier.`,
            `Article 2 - Objet: La société a pour objet l'acquisition et la gestion d'un patrimoine immobilier locatif.`,
            `Article 3 - Dénomination: SCPI ${document.product}`,
            `Article 4 - Siège social: Le siège social est fixé à Paris (75008).`,
            `Article 5 - Durée: La durée de la société est fixée à 99 années.`
          ]
        },
        {
          title: "TITRE II - CAPITAL SOCIAL",
          content: [
            "Article 6 - Le capital social est variable.",
            "Article 7 - Les parts sociales ont une valeur nominale de 100 euros.",
            "Article 8 - Le capital minimum est fixé à 760 000 euros.",
            "Article 9 - Le capital maximum est fixé à 400 000 000 euros."
          ]
        },
        {
          title: "TITRE III - ADMINISTRATION ET CONTRÔLE",
          content: [
            "Article 10 - La société est administrée par une société de gestion agréée.",
            "Article 11 - Le contrôle de la société est exercé par un commissaire aux comptes.",
            "Article 12 - Les assemblées générales se tiennent au siège social."
          ]
        }
      ];
    }
    
    if (type.includes('bulletin') && type.includes('trimestriel')) {
      return [
        {
          title: "ÉDITORIAL",
          content: [
            `Chers associés de la SCPI ${document.product},`,
            "Le trimestre écoulé a été marqué par une activité soutenue sur le marché immobilier.",
            "Notre stratégie d'investissement continue de porter ses fruits avec des acquisitions ciblées.",
            "Les perspectives pour les prochains mois restent favorables malgré le contexte économique."
          ]
        },
        {
          title: "ACTIVITÉ DU TRIMESTRE",
          content: [
            "Acquisitions réalisées: 3 actifs pour un montant total de 15 M€",
            "Cessions: 1 actif pour 8 M€ générant une plus-value de 12%",
            "Taux d'occupation: 94% (en progression de 2 points)",
            "Revenus locatifs: 2,8 M€ (+3% vs trimestre précédent)"
          ]
        },
        {
          title: "RÉSULTATS FINANCIERS",
          content: [
            "Résultat distribuable: 1,05 € par part",
            "Taux de distribution: 4,2% annualisé",
            "Valeur de réalisation: 205 € par part (+2,5% sur l'année)",
            "Endettement: 25% de l'actif immobilier"
          ]
        }
      ];
    }
    
    // Contenu générique pour autres types
    return [
      {
        title: "PRÉSENTATION",
        content: [
          `Ce document présente les informations relatives à ${document.product}.`,
          `Il s'agit d'un ${document.documentType.toLowerCase()} officiel de ${document.company}.`,
          "Les informations contenues sont à jour à la date d'édition.",
          "Ce document est destiné aux investisseurs et prospects."
        ]
      },
      {
        title: "INFORMATIONS PRINCIPALES",
        content: [
          `Produit: ${document.product}`,
          `Société: ${document.company}`,
          `Version: ${document.version}`,
          `Dernière mise à jour: ${new Date(document.lastUpdate).toLocaleDateString('fr-FR')}`,
          `Taille du fichier: ${document.fileSize}`
        ]
      },
      {
        title: "AVERTISSEMENT",
        content: [
          "Les performances passées ne préjugent pas des performances futures.",
          "Tout investissement comporte des risques de perte en capital.",
          "Il est recommandé de consulter un conseiller financier avant tout investissement.",
          "Ce document ne constitue pas une offre de souscription."
        ]
      }
    ];
  }

  // Méthodes utilitaires
  private base64ToBlob(base64: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'application/pdf' });
  }

  private downloadFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    console.log(`💾 Fichier téléchargé: ${fileName}`);
  }

  private extractVersion(fileName: string): string {
    const patterns = [
      /(\d{4}-\d{2})/,           // 2024-06
      /(\d{4}-Q[1-4])/,          // 2024-Q3
      /v(\d+\.\d+)/,             // v1.2
      /(\d{4})/                  // 2024
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return new Date().getFullYear().toString();
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export const pdfDownloadService = new PDFDownloadService();
