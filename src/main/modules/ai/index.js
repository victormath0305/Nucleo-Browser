/**
 * Núcleo Browser - Integrated AI Subsystem
 * Prepared for future milestone: On-device & Cloud LLM assistant, page summarization, smart navigation
 * @module modules/ai
 */

class AIManager {
  constructor(browserEngine) {
    this.engine = browserEngine;
    this.modelProvider = null;
  }

  async initialize() {
    // Future: Initialize local ONNX / WebGPU / API model connector
  }

  async summarizePage(pageContent) {
    throw new Error('AI integration scheduled for future milestone');
  }

  async queryAssistant(prompt) {
    throw new Error('AI integration scheduled for future milestone');
  }
}

module.exports = AIManager;
