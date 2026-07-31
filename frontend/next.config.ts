import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Cross-origin isolation unlocks SharedArrayBuffer, which the local TTS
        // engine (ONNX WASM) needs for multi-threaded inference. The backend
        // already sends Cross-Origin-Resource-Policy: cross-origin, so
        // cross-origin cover images keep loading under require-corp.
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default nextConfig;
