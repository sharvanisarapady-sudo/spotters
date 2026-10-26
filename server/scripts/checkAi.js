/**
 * Local smoke test for the configured AI provider. Makes ONE real request using server/.env.
 * Uses an obviously artificial placeholder record (no medical content) and never prints the key.
 * Usage: cd server && node scripts/checkAi.js
 */
require('dotenv').config();
const { analyzeAnswer, describeConfig } = require('../services/aiService');

(async () => {
  console.log(`Config: ${describeConfig()}`);
  const caseData = {
    correct_answer: 'PLACEHOLDER-DIAGNOSIS-ALPHA',
    clinical_info: 'Synthetic smoke-test record, not a real case.',
    explanation: 'Synthetic explanation text for connectivity testing only.',
    key_findings: 'Synthetic finding one; synthetic finding two.',
    learning_points: null,
    differential_diagnosis: null,
  };
  const started = Date.now();
  const r = await analyzeAnswer({ caseData, studentAnswer: 'PLACEHOLDER-DIAGNOSIS-BETA' });
  console.log(`\nResult after ${Date.now() - started} ms`);
  console.log(`  mode:     ${r.mode}`);
  console.log(`  fallback: ${r.fallback}`);
  console.log(`  verdict:  ${r.verdict}`);
  console.log(`  reasoning: ${r.reasoning}`);
  console.log(`  notice:   ${r.notice}`);
  if (r.mode !== 'demo' && !r.fallback) {
  console.log(`\nOK: the ${r.mode} AI provider answered successfully.`);
} else {
  console.log('\nAI provider unavailable; demo feedback was used.');
}

process.exit(0);
})();
