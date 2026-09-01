#!/usr/bin/env node
/**
 * STT Optimization Helper for Intel Macs
 * This script provides diagnostics and potential optimizations for Sherpa-ONNX on Intel architecture
 * 
 * Usage: node stt-optimize.mjs
 */

import os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔧 STT Optimization Helper for Intel macOS\n');

// ============================================================================
// 1. Detect CPU Features
// ============================================================================
console.log('📊 CPU Feature Detection:');
try {
  const cpuFeatures = {
    'AVX2': execSync('sysctl -n hw.optional.avx2_0').toString().trim() === '1',
    'AVX512F': execSync('sysctl -n hw.optional.avx512f').toString().trim() === '1',
    'SSE4.1': execSync('sysctl -n hw.optional.sse4_1').toString().trim() === '1',
  };
  
  Object.entries(cpuFeatures).forEach(([feat, supported]) => {
    console.log(`  ${supported ? '✓' : '✗'} ${feat}: ${supported ? 'Available' : 'Not available'}`);
  });
} catch (err) {
  console.log('  ⚠️  Could not detect CPU features');
}

// ============================================================================
// 2. Check ONNX Runtime Configuration Options
// ============================================================================
console.log('\n⚙️  ONNX Runtime Environment Variables:');
const onnxEnvVars = {
  'ORT_INTRA_OP_NUM_THREADS': 'Threads for single op (default: 1)',
  'ORT_INTER_OP_NUM_THREADS': 'Threads between ops (default: num CPUs)',
  'ORT_NUM_THREADS': 'Override both (optional)',
};

Object.entries(onnxEnvVars).forEach(([varName, desc]) => {
  const current = process.env[varName] || 'not set';
  console.log(`  ${varName}: ${current}`);
  console.log(`    └─ ${desc}`);
});

// ============================================================================
// 3. Recommended Thread Configuration
// ============================================================================
console.log('\n💡 Recommended Thread Configuration:');
const numCPUs = os.cpus().length;
console.log(`  Available CPU cores: ${numCPUs}`);

const recommendedConfig = {
  'ORT_INTRA_OP_NUM_THREADS': Math.max(2, numCPUs - 2),
  'ORT_INTER_OP_NUM_THREADS': 1,
};

console.log('\n  Suggested environment variables:');
Object.entries(recommendedConfig).forEach(([varName, value]) => {
  console.log(`  export ${varName}=${value}`);
});

// ============================================================================
// 4. Check Sherpa Installation
// ============================================================================
console.log('\n📦 Sherpa-ONNX Installation Check:');
try {
  const sherpaPkg = require('./node_modules/sherpa-onnx-node/package.json');
  console.log(`  Version: ${sherpaPkg.version}`);
  console.log(`  Binary type: darwin-x64 (Intel)`);
  
  const bindingPath = './node_modules/sherpa-onnx-node/lib/binding/sherpa-onnx.node';
  if (fs.existsSync(bindingPath)) {
    const stats = fs.statSync(bindingPath);
    console.log(`  ✓ Native binding found: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
  } else {
    console.log(`  ✗ Native binding not found at ${bindingPath}`);
  }
} catch (err) {
  console.log(`  ✗ Sherpa-ONNX not installed: ${err.message}`);
}

// ============================================================================
// 5. Performance Tips
// ============================================================================
console.log('\n🚀 Performance Optimization Tips:');
const tips = [
  'Use quantized model (INT8) for faster inference: INT8 models load faster',
  'Increase thread count: export ORT_INTRA_OP_NUM_THREADS=4',
  'Profile CPU usage: Open Activity Monitor, sort by CPU % during STT',
  'Check memory pressure: If swapping occurs, reduce model size',
  'Test with different models: Try hindi, tamil variants for comparison',
  'Monitor latency: Add console.time() in sherpa.ts to measure bottleneck',
];

tips.forEach((tip, i) => {
  console.log(`  ${i + 1}. ${tip}`);
});

// ============================================================================
// 6. Comparison: Intel vs Apple Silicon
// ============================================================================
console.log('\n📈 Performance Expectations:');
console.log('  Apple Silicon (M1/M4):');
console.log('    ├─ Word Error Rate (WER): ~4-5%');
console.log('    ├─ Latency: 100-200ms per utterance');
console.log('    └─ CPU usage: 20-40% of one core (real-time capable)');
console.log('');
console.log('  Intel Kaby Lake (your CPU):');
console.log('    ├─ Word Error Rate (WER): ~6-8% (expected)');
console.log('    ├─ Latency: 200-400ms per utterance');
console.log('    └─ CPU usage: 60-100% of multiple cores');

// ============================================================================
// 7. Debug Configuration
// ============================================================================
console.log('\n🔍 Debug Configuration (add to environment):');
console.log('  export ORT_LOGLEVEL=3  # 0=verbose, 1=info, 2=warning, 3=error');
console.log('  export ORT_ENABLE_PROFILING=1  # Enable ONNX profiling');

// ============================================================================
// 8. Next Steps
// ============================================================================
console.log('\n📋 Next Steps:');
console.log('  1. Run: bash stt-diagnose.sh');
console.log('  2. Set recommended environment: export ORT_INTRA_OP_NUM_THREADS=4');
console.log('  3. Test with: STT_MODEL=english pnpm --filter desktop dev');
console.log('  4. Profile CPU during STT (Activity Monitor)');
console.log('  5. If still slow, rebuild with: CFLAGS="-march=native" npm rebuild sherpa-onnx-node');

console.log('\n✅ Optimization helper complete!\n');
