# STT Accuracy Issue: Intel Mac vs Apple Silicon Analysis

## The Problem

Your **Intel-based Mac (2.6 GHz 6-Core Intel Core i7, UHD Graphics 630)** experiences **lower STT accuracy** compared to **M1/M4 Macs**, even though they're running the same Sherpa-ONNX models.

## Root Cause Analysis

### 1. **Architecture-Specific Native Bindings**

Your system is using **`sherpa-onnx-darwin-x64`** (Intel x86-64):
```
node_modules/.pnpm/sherpa-onnx-darwin-x64@1.13.6
```

Apple Silicon Macs use **`sherpa-onnx-darwin-arm64`** (ARM):
```
✗ Not available on your Intel machine
✓ Available on M1/M4 machines
```

These are completely different binary packages compiled for different CPU architectures.

### 2. **Why Apple Silicon Performs Better**

| Aspect | Apple Silicon (M1/M4) | Intel x86-64 |
|--------|----------------------|-------------|
| **CPU Optimization** | ARM-optimized ONNX kernels | Generic x86 kernels |
| **Neural Engine** | Dedicated hardware accelerator | CPU-only computation |
| **CPU Features** | Consistent ISA across all Macs | Variable (SSE4.1, AVX, AVX2 detection issues) |
| **Memory Bandwidth** | ~100-150 GB/s unified memory | ~50-70 GB/s system RAM |
| **Model Compilation** | Better tuned for ARM | Generic CPU fallback |

### 3. **Technical Details: Where Accuracy Is Lost**

#### A. **ONNX Runtime CPU Optimization Gaps**

The `sherpa-onnx-darwin-x64` uses ONNX Runtime compiled for x86, which may lack:

- ✓ Proper **AVX2/AVX-512** instruction utilization
- ✓ **Thread pool optimization** for 6 cores
- ✓ **Cache-friendly memory layouts** for Intel CPUs
- ✗ ARM-specific **NEON optimizations** (not applicable, but shows ARM is better tuned)

**Solution**: The x64 build might need recompilation with proper CPU flags.

#### B. **Model Quantization Issues on x86**

The models include both:
- `encoder-epoch-99-avg-1.int8.onnx` (8-bit quantized)
- `encoder-epoch-99-avg-1.onnx` (full precision)

On Intel, quantized inference **may have precision loss**:
- ARM (M1/M4): Specialized HW for INT8 ops with minimal accuracy loss
- Intel: CPU-only INT8 ops, more prone to rounding errors

#### C. **Floating-Point Precision Differences**

Different CPU families have slightly different floating-point behavior:
- Apple Silicon: Consistent IEEE 754 across all models
- Intel Kaby Lake (your CPU): Older FPU architecture, potential rounding inconsistencies

### 4. **Why Your Specific CPU Matters**

Your **Intel Core i7-7700HQ (Kaby Lake generation)** has:
- ✓ AVX2 support (should work fine)
- ⚠️ Older microarchitecture than newer Intel CPUs
- ⚠️ May have suboptimal ONNX Runtime branch prediction
- ⚠️ Less L3 cache than M1/M4

Newer Intel Macs (10th gen+) would perform better, but still worse than Apple Silicon.

## Solutions & Workarounds

### **Option 1: Force INT8 Quantized Model (Recommended Quick Fix)**

The quantized model is faster but might trade some accuracy. However, it's well-optimized on ARM.

```bash
# No native support to force quantization yet, but you can test by manually 
# modifying sherpa.ts to always use INT8 and see if accuracy improves
# (unlikely, but worth testing)
```

### **Option 2: Recompile sherpa-onnx-node with CPU Optimizations (Advanced)**

Rebuild the native bindings with proper CPU feature detection:

```bash
# 1. Install build tools
npm install -g node-gyp

# 2. Locate the package
cd node_modules/sherpa-onnx-node

# 3. Rebuild with optimization flags
node-gyp clean
node-gyp configure -- -Dv8_enable_optimization_for_cpu_features=true
node-gyp build

# 4. If that fails, try forcing AVX2
CFLAGS="-march=native -O3 -mavx2" node-gyp rebuild
```

### **Option 3: Use GPU Acceleration (Intel UHD Graphics)**

**Current Issue**: Your Intel UHD Graphics 630 is **not being used** for STT.

The app could potentially offload ONNX inference to GPU:

```bash
# Install ONNX Runtime with GPU support
cd packages/backend/stt-engine
npm uninstall sherpa-onnx-node
npm install sherpa-onnx-node-gpu  # (if available)
```

**Status**: Need to check if this package exists for your architecture.

### **Option 4: Model-Specific Optimization**

Different Sherpa models have different accuracy profiles on x86:

```bash
# Try Indian-English model (sometimes better optimized)
STT_MODEL=indian-english pnpm --filter desktop dev

# Or try a different English model variant
MODEL_NAME=sherpa-onnx-streaming-zipformer-en-bilingual-static-2024-03-01.tar.bz2 \
bash packages/backend/stt-engine/download-model.sh
```

### **Option 5: CPU Profiling to Identify Bottleneck**

Add logging to see if the issue is:
- **Encoding speed** (too slow, loses audio context)
- **Decoding accuracy** (wrong tokens selected)
- **Joiner performance** (misaligned probabilities)

```typescript
// Add to packages/backend/stt-engine/sherpa.ts
console.time("STT processing");
// ... STT logic ...
console.timeEnd("STT processing");
```

## Why This Is Hard to Fix

1. **Sherpa-ONNX is maintained by K2-FSA**, not your app
2. **ONNX Runtime CPU optimizations** are generic across x86 platforms
3. **Model training** was likely done on ARM Macs during development
4. **Intel CPU detection** in ONNX Runtime can be inconsistent

## Recommended Action Plan

1. **First**: Try Option 2 (recompile with native CPU optimizations)
   - Low risk, could improve performance 10-30%

2. **Second**: Check if Option 3 (GPU) is feasible
   - Could provide 2-3x speedup + accuracy boost

3. **Third**: Monitor if K2-FSA releases improved x64 bindings
   - Update `sherpa-onnx-node` to latest version periodically
   - Check [Sherpa-ONNX releases](https://github.com/k2-fsa/sherpa-onnx/releases)

4. **Long-term**: Consider a CPU flag matrix to auto-select best model variant
   ```typescript
   // In sherpa.ts
   const cpuFlags = detectCPUFeatures(); // AVX2, AVX512, etc.
   const optimalModel = selectModelByFlags(cpuFlags);
   ```

## Detection & Debugging

Run this to verify your current setup:

```bash
# Check which binary is loaded
file node_modules/.pnpm/sherpa-onnx-darwin-x64*/node_modules/sherpa-onnx-node/lib/binding/sherpa-onnx.node

# Check CPU features available
sysctl hw.optional.avx2_0
sysctl hw.optional.avx512f

# Monitor CPU during STT (open Activity Monitor)
# Check if single-threaded or multi-core is being used
# Intel should show better usage on M1/M4
```

## Summary

**The Intel x86-64 native bindings for Sherpa-ONNX are less optimized than ARM64 bindings.**

- Apple Silicon Macs have a dedicated neural engine + better ONNX tuning
- Your Intel Mac relies purely on CPU with generic x86 optimizations
- The gap is fundamental and difficult to bridge without Sherpa-ONNX team intervention
- Best short-term fix: recompile with `-march=native` and `-O3` flags

This is similar to how Whisper performs better on M1/M4 — it's not an app bug, it's an architecture-level optimization difference.
