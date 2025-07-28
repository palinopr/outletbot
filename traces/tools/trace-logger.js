/**
 * Trace Logger
 * Automatically logs trace IDs for debugging
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRACE_LOG_FILE = path.join(__dirname, 'trace-log.json');

export class TraceLogger {
  static async log(traceId, metadata = {}) {
    try {
      // Read existing log
      let log = [];
      try {
        const data = await fs.readFile(TRACE_LOG_FILE, 'utf8');
        log = JSON.parse(data);
      } catch (e) {
        // File doesn't exist yet
      }
      
      // Add new entry
      log.push({
        traceId,
        timestamp: new Date().toISOString(),
        ...metadata
      });
      
      // Keep only last 100 traces
      if (log.length > 100) {
        log = log.slice(-100);
      }
      
      // Write back
      await fs.writeFile(TRACE_LOG_FILE, JSON.stringify(log, null, 2));
      
    } catch (error) {
      console.error('Failed to log trace:', error);
    }
  }
  
  static async getTraces(filter = {}) {
    try {
      const data = await fs.readFile(TRACE_LOG_FILE, 'utf8');
      const log = JSON.parse(data);
      
      // Apply filters
      let filtered = log;
      if (filter.status) {
        filtered = filtered.filter(t => t.status === filter.status);
      }
      if (filter.error) {
        filtered = filtered.filter(t => t.error);
      }
      if (filter.since) {
        const since = new Date(filter.since);
        filtered = filtered.filter(t => new Date(t.timestamp) > since);
      }
      
      return filtered;
    } catch (error) {
      return [];
    }
  }
}