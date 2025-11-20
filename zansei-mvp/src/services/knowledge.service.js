// src/services/knowledge.service.js

class KnowledgeService {
    constructor() {
      this.cache = new Map();
      this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }
    
    async getKnowledge(funnelId, businessType) {
      const cacheKey = `${funnelId}_${businessType}`;
      
      // Check cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.data;
        }
      }
      
      // Load fresh
      const knowledge = {
        smb_insights: await this.loadFile('smb_insights.md'),
        funnel_tactics: await this.loadFile(`${funnelId}_tactics.md`),
        industry_specific: await this.loadFile(`industries/${businessType}.md`),
        benchmarks: await this.loadBenchmarks() // Could fetch from API
      };
      
      // Cache it
      this.cache.set(cacheKey, {
        data: knowledge,
        timestamp: Date.now()
      });
      
      return knowledge;
    }
    
    async loadFile(filename) {
      const filepath = path.join(__dirname, '../../knowledge', filename);
      
      try {
        return await fs.readFile(filepath, 'utf-8');
      } catch (error) {
        console.warn(`Knowledge file not found: ${filename}`);
        return null;
      }
    }
    
    async loadBenchmarks() {
      // Option 1: Load from file
      const benchmarks = await this.loadFile('benchmarks.json');
      
      // Option 2: Fetch from API (more dynamic)
      // const response = await fetch('https://your-api.com/benchmarks');
      // return await response.json();
      
      return benchmarks;
    }
    
    // Update knowledge programmatically
    async updateFile(filename, content) {
      const filepath = path.join(__dirname, '../../knowledge', filename);
      await fs.writeFile(filepath, content, 'utf-8');
      
      // Clear cache so next request gets fresh data
      this.cache.clear();
    }
  }