#!/usr/bin/env node
/**
 * LangSmith Trace Debugger
 * Fetches and analyzes production traces to debug issues
 */

import { Client } from 'langsmith/client';
import { config as dotenvConfig } from 'dotenv';
import { Logger } from './services/logger.js';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenvConfig();

const logger = new Logger('TraceDebugger');

class TraceDebugger {
  constructor() {
    this.client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com"
    });
  }

  /**
   * Fetch a specific trace by ID
   */
  async fetchTrace(traceId) {
    try {
      logger.info('Fetching trace', { traceId });
      const run = await this.client.readRun(traceId);
      return run;
    } catch (error) {
      logger.error('Failed to fetch trace', { 
        traceId, 
        error: error.message,
        status: error.response?.status 
      });
      throw error;
    }
  }

  /**
   * Fetch all child runs for a trace
   */
  async fetchChildRuns(parentRunId) {
    try {
      const childRuns = [];
      for await (const run of this.client.listRuns({
        parentRunId,
        executionOrder: 1
      })) {
        childRuns.push(run);
      }
      return childRuns;
    } catch (error) {
      logger.error('Failed to fetch child runs', { parentRunId, error: error.message });
      return [];
    }
  }

  /**
   * Analyze trace for field extraction issues
   */
  async analyzeFieldExtraction(trace) {
    const analysis = {
      traceId: trace.id,
      traceName: trace.name,
      status: trace.status,
      startTime: trace.start_time,
      endTime: trace.end_time,
      duration: trace.end_time ? (new Date(trace.end_time) - new Date(trace.start_time)) / 1000 : null,
      error: trace.error,
      inputs: trace.inputs,
      outputs: trace.outputs,
      metadata: trace.extra?.metadata || {},
      toolCalls: [],
      extractedFields: {},
      messages: []
    };

    // Extract messages from inputs/outputs
    if (trace.inputs?.messages) {
      analysis.messages = trace.inputs.messages.map(msg => ({
        type: msg._type || msg.type,
        content: msg.content,
        role: msg.role || (msg._type?.includes('human') ? 'human' : 'ai')
      }));
    }

    // Get child runs (tool calls)
    const childRuns = await this.fetchChildRuns(trace.id);
    
    for (const child of childRuns) {
      if (child.run_type === 'tool') {
        const toolCall = {
          name: child.name,
          inputs: child.inputs,
          outputs: child.outputs,
          error: child.error,
          duration: child.end_time ? (new Date(child.end_time) - new Date(child.start_time)) / 1000 : null
        };
        
        analysis.toolCalls.push(toolCall);
        
        // Check for extractLeadInfo tool
        if (child.name === 'extractLeadInfo' && child.outputs) {
          analysis.extractedFields = {
            ...analysis.extractedFields,
            ...child.outputs
          };
        }
      }
    }

    return analysis;
  }

  /**
   * Generate detailed report
   */
  generateReport(analysis) {
    const report = [];
    
    report.push('='.repeat(80));
    report.push(`TRACE ANALYSIS REPORT`);
    report.push('='.repeat(80));
    report.push('');
    
    report.push(`Trace ID: ${analysis.traceId}`);
    report.push(`Trace Name: ${analysis.traceName}`);
    report.push(`Status: ${analysis.status}`);
    report.push(`Duration: ${analysis.duration ? analysis.duration.toFixed(2) + 's' : 'N/A'}`);
    
    if (analysis.error) {
      report.push(`\n❌ ERROR: ${analysis.error}`);
    }
    
    // Messages
    report.push('\n📨 CONVERSATION FLOW:');
    report.push('-'.repeat(40));
    analysis.messages.forEach((msg, idx) => {
      report.push(`\n[${idx + 1}] ${msg.role.toUpperCase()}:`);
      report.push(msg.content);
    });
    
    // Tool Calls
    report.push('\n\n🔧 TOOL CALLS:');
    report.push('-'.repeat(40));
    analysis.toolCalls.forEach((tool, idx) => {
      report.push(`\n[${idx + 1}] ${tool.name} (${tool.duration ? tool.duration.toFixed(3) + 's' : 'N/A'})`);
      report.push(`Inputs: ${JSON.stringify(tool.inputs, null, 2)}`);
      report.push(`Outputs: ${JSON.stringify(tool.outputs, null, 2)}`);
      if (tool.error) {
        report.push(`Error: ${tool.error}`);
      }
    });
    
    // Extracted Fields
    report.push('\n\n📋 EXTRACTED FIELDS:');
    report.push('-'.repeat(40));
    const fields = ['name', 'problem', 'goal', 'budget', 'email', 'phone'];
    fields.forEach(field => {
      const value = analysis.extractedFields[field];
      report.push(`${field}: ${value || '❌ NOT EXTRACTED'}`);
    });
    
    // Analysis Summary
    report.push('\n\n📊 ANALYSIS SUMMARY:');
    report.push('-'.repeat(40));
    
    const extractionCount = analysis.toolCalls.filter(t => t.name === 'extractLeadInfo').length;
    report.push(`- extractLeadInfo called ${extractionCount} times`);
    
    const missingFields = fields.filter(f => !analysis.extractedFields[f]);
    if (missingFields.length > 0) {
      report.push(`- Missing fields: ${missingFields.join(', ')}`);
    }
    
    const totalTokens = analysis.metadata?.['langsmith:token_usage']?.total_tokens;
    if (totalTokens) {
      report.push(`- Total tokens used: ${totalTokens}`);
    }
    
    return report.join('\n');
  }

  /**
   * Save analysis to file
   */
  async saveAnalysis(analysis, outputPath) {
    const report = this.generateReport(analysis);
    const jsonPath = outputPath.replace('.txt', '.json');
    
    // Save text report
    await fs.writeFile(outputPath, report, 'utf8');
    logger.info('Text report saved', { path: outputPath });
    
    // Save JSON analysis
    await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2), 'utf8');
    logger.info('JSON analysis saved', { path: jsonPath });
  }

  /**
   * Compare with local execution
   */
  async compareWithLocal(traceId, localTraceId) {
    const prodTrace = await this.fetchTrace(traceId);
    const localTrace = await this.fetchTrace(localTraceId);
    
    const prodAnalysis = await this.analyzeFieldExtraction(prodTrace);
    const localAnalysis = await this.analyzeFieldExtraction(localTrace);
    
    const comparison = {
      production: prodAnalysis,
      local: localAnalysis,
      differences: {
        toolCallCount: prodAnalysis.toolCalls.length - localAnalysis.toolCalls.length,
        extractedFieldsDiff: {},
        messageDiff: prodAnalysis.messages.length - localAnalysis.messages.length
      }
    };
    
    // Compare extracted fields
    const allFields = new Set([
      ...Object.keys(prodAnalysis.extractedFields),
      ...Object.keys(localAnalysis.extractedFields)
    ]);
    
    for (const field of allFields) {
      if (prodAnalysis.extractedFields[field] !== localAnalysis.extractedFields[field]) {
        comparison.differences.extractedFieldsDiff[field] = {
          production: prodAnalysis.extractedFields[field],
          local: localAnalysis.extractedFields[field]
        };
      }
    }
    
    return comparison;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const traceId = args[1];
  
  if (!command || !traceId) {
    console.log(`
Usage: node debug-trace-langsmith.js <command> <trace-id> [options]

Commands:
  fetch <trace-id>              Fetch and analyze a single trace
  compare <prod-id> <local-id>  Compare production and local traces
  
Options:
  --output <path>              Save analysis to file (default: ./trace-analysis-<id>.txt)
  
Examples:
  node debug-trace-langsmith.js fetch 1f06a7ac-ce88-6245-9ec9-821839cc6091
  node debug-trace-langsmith.js compare 1f06a7ac-ce88-6245-9ec9-821839cc6091 local-trace-id
    `);
    process.exit(1);
  }
  
  const traceDebugger = new TraceDebugger();
  
  try {
    if (command === 'fetch') {
      logger.info('Fetching and analyzing trace', { traceId });
      
      const trace = await traceDebugger.fetchTrace(traceId);
      const analysis = await traceDebugger.analyzeFieldExtraction(trace);
      
      // Print report
      console.log(traceDebugger.generateReport(analysis));
      
      // Save if output specified
      const outputIdx = args.indexOf('--output');
      const outputPath = outputIdx > -1 && args[outputIdx + 1] 
        ? args[outputIdx + 1] 
        : `./trace-analysis-${traceId.slice(0, 8)}.txt`;
      
      await traceDebugger.saveAnalysis(analysis, outputPath);
      
    } else if (command === 'compare') {
      const localTraceId = args[2];
      if (!localTraceId) {
        console.error('Local trace ID required for comparison');
        process.exit(1);
      }
      
      logger.info('Comparing traces', { prodId: traceId, localId: localTraceId });
      const comparison = await traceDebugger.compareWithLocal(traceId, localTraceId);
      
      console.log('\n📊 TRACE COMPARISON:');
      console.log('='.repeat(80));
      console.log(`Production trace: ${traceId}`);
      console.log(`Local trace: ${localTraceId}`);
      console.log('\nDifferences:');
      console.log(JSON.stringify(comparison.differences, null, 2));
    }
    
  } catch (error) {
    logger.error('Command failed', { error: error.message });
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TraceDebugger };