import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge sits on top of the room's bottom-left presence line.
  devIndicators: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
