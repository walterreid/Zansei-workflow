// src/services/knowledge.service.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KnowledgeService {
  constructor() {
    this.cache = new Map();
    
    // Environment-based cache configuration
    // Dev mode: no cache (always fresh)
    // Prod mode: 1 hour cache
    const isDev = process.env.NODE_ENV === 'development';
    const customTTL = process.env.KNOWLEDGE_CACHE_TTL;
    
    if (customTTL) {
      this.cacheExpiry = parseInt(customTTL, 10);
    } else if (isDev) {
      this.cacheExpiry = 0; // No caching in dev
    } else {
      this.cacheExpiry = 60 * 60 * 1000; // 1 hour in prod
    }
    
    console.log(`[KnowledgeService] Cache expiry: ${this.cacheExpiry === 0 ? 'disabled (dev mode)' : `${this.cacheExpiry / 1000}s`}`);
  }
  
  async getKnowledge(funnelId, businessType) {
    const cacheKey = `${funnelId}_${businessType}`;
    
    // Check cache (skip if cacheExpiry is 0)
    if (this.cacheExpiry > 0 && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`[KnowledgeService] Using cached knowledge for ${cacheKey}`);
        return cached.data;
      }
    }
    
    console.log(`[KnowledgeService] Loading fresh knowledge for ${cacheKey}`);
    
    // Load files in order
    const knowledge = {
      persona: await this.loadFile('zan_ng_persona.md'),
      smb_insights: await this.loadFile('smb_insights.md'),
      funnel_tactics: await this.loadFile(`funnels/${funnelId}.md`),
      industry_specific: await this.loadFile(`industries/${businessType}.md`),
      benchmarks: await this.loadBenchmarks()
    };
    
    // Cache it (if caching is enabled)
    if (this.cacheExpiry > 0) {
      this.cache.set(cacheKey, {
        data: knowledge,
        timestamp: Date.now()
      });
    }
    
    return knowledge;
  }
  
  async loadFile(filename) {
    const filepath = path.join(__dirname, '../../knowledge', filename);
    
    try {
      if (!fs.existsSync(filepath)) {
        console.warn(`[KnowledgeService] File not found: ${filename}`);
        return null;
      }
      const content = await fs.promises.readFile(filepath, 'utf-8');
      return content;
    } catch (error) {
      console.warn(`[KnowledgeService] Error loading file ${filename}:`, error.message);
      return null;
    }
  }
  
  async loadBenchmarks() {
    try {
      const content = await this.loadFile('benchmarks.json');
      if (!content) {
        return null;
      }
      return JSON.parse(content);
    } catch (error) {
      console.warn(`[KnowledgeService] Error parsing benchmarks.json:`, error.message);
      return null;
    }
  }
  
  clearCache() {
    this.cache.clear();
    console.log('[KnowledgeService] Cache cleared');
  }
  
  getCacheStats() {
    return {
      size: this.cache.size,
      expiry: this.cacheExpiry,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();
export default knowledgeService;