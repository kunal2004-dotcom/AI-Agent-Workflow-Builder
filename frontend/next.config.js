/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_NHOST_SUBDOMAIN: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN,
    NEXT_PUBLIC_NHOST_REGION: process.env.NEXT_PUBLIC_NHOST_REGION,
  },
};

module.exports = nextConfig;
