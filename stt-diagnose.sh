#!/bin/bash
# STT Accuracy Diagnostic & Optimization Script for Intel Macs
# Usage: bash stt-diagnose.sh

set -e

echo "=================================================="
echo "🔍 STT Engine Diagnostic Report (Intel Mac)"
echo "=================================================="

# 1. CPU Information
echo -e "\n📊 CPU Information:"
sysctl -a | grep -E "hw.cpufrequency|hw.ncpu|brand_string" | head -5

# 2. CPU Feature Flags
echo -e "\n⚙️  CPU Features Available:"
echo "  AVX2 Support: $(sysctl -n hw.optional.avx2_0 2>/dev/null || echo 'Unknown')"
echo "  AVX512F Support: $(sysctl -n hw.optional.avx512f 2>/dev/null || echo 'Not supported')"
echo "  SSE4.1 Support: $(sysctl -n hw.optional.sse4_1 2>/dev/null || echo 'Unknown')"

# 3. Sherpa-ONNX Binary Info
echo -e "\n📦 Sherpa-ONNX Binary Information:"
SHERPA_LIB=$(find node_modules -name "sherpa-onnx.node" 2>/dev/null | head -1)
if [ -n "$SHERPA_LIB" ]; then
    echo "  Binary: $SHERPA_LIB"
    file "$SHERPA_LIB"
    echo "  Size: $(du -h "$SHERPA_LIB" | cut -f1)"
else
    echo "  ❌ sherpa-onnx.node not found - run 'pnpm install' first"
fi

# 4. Check STT Models
echo -e "\n🎤 STT Models Available:"
STT_DIR="packages/backend/stt-engine"
if [ -d "$STT_DIR" ]; then
    for model in $(ls -d "$STT_DIR"/sherpa-onnx-* 2>/dev/null | xargs -n1 basename); do
        echo "  ✓ $model"
        encoder=$(ls "$STT_DIR/$model"/encoder*.onnx 2>/dev/null | wc -l)
        echo "    - Encoders: $encoder files"
    done
else
    echo "  ❌ STT engine not found"
fi

# 5. Node.js and Native Module Info
echo -e "\n🔧 Runtime Information:"
echo "  Node.js: $(node --version)"
echo "  Node Arch: $(node -e "console.log(process.arch)")"
echo "  Node Platform: $(node -e "console.log(process.platform)")"
echo "  Electron: $(grep -o '"electron":.*' package.json | cut -d'"' -f4 || echo 'Unknown')"

# 6. Memory Available
echo -e "\n💾 System Memory:"
vm_stat | head -3
total_memory=$(sysctl -n hw.memsize | awk '{print int($1 / (1024^3))}')
echo "  Total RAM: ${total_memory}GB"

# 7. GPU Info
echo -e "\n🎮 GPU Information:"
system_profiler SPDisplaysDataType 2>/dev/null | grep -A 2 "^  " | head -10 || echo "  Could not detect GPU"

# 8. Sherpa Package Version
echo -e "\n📌 Sherpa-ONNX Version:"
SHERPA_PKG="node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-node/package.json"
if [ -f "$(ls $SHERPA_PKG 2>/dev/null | head -1)" ]; then
    grep '"version"' $(ls $SHERPA_PKG 2>/dev/null | head -1) | cut -d'"' -f4
fi

echo -e "\n=================================================="
echo "✅ Diagnostic complete!"
echo "=================================================="

echo -e "\n📝 Interpretation Guide:"
echo "  ✓ AVX2 supported: ONNX should use vector instructions"
echo "  ✓ 6+ CPU cores: Multi-threaded inference possible"
echo "  ✓ 8GB+ RAM: STT should not hit memory limits"
echo ""
echo "⚠️  If accuracy is still low, try:"
echo "    1. Recompile with: CFLAGS='-march=native -O3' node-gyp rebuild"
echo "    2. Check Activity Monitor during STT (all cores used?)"
echo "    3. Try alternative model: STT_MODEL=indian-english pnpm dev"
echo "    4. Enable debug logging in packages/backend/stt-engine/sherpa.ts"
