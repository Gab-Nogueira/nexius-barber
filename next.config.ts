import type { NextConfig } from 'next';

// Vinext's multipart pre-dispatch uses the server-action cap even for Route
// Handlers. Keep room for form overhead; the upload API enforces 5 MiB per file.
const nextConfig: NextConfig = { experimental: { serverActions: { bodySizeLimit: '6mb' } } };

export default nextConfig;
