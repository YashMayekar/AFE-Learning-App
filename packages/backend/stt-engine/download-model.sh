#!/usr/bin/env bash
# Download ggml-small-q5_1.bin from Hugging Face into this directory.
# Use this if you get "invalid model data (bad magic)" (corrupt or wrong model).

set -e
STT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL="ggml-base-q5_1.bin"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL}"

echo "Downloading ${MODEL} (~54 MiB) into ${STT_DIR}..."
if command -v wget &>/dev/null; then
  wget -O "${STT_DIR}/${MODEL}" "${URL}"
elif command -v curl &>/dev/null; then
  curl -L -o "${STT_DIR}/${MODEL}" "${URL}"
else
  echo "Need wget or curl to download."
  exit 1
fi
echo "Done. Model saved to ${STT_DIR}/${MODEL}"
