/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin's auth verification path pulls in jwks-rsa -> jose@6,
  // which ships ESM-only. Webpack's bundling of a require() against that
  // ESM build fails at runtime on Vercel with ERR_REQUIRE_ESM (does not
  // reproduce locally under `next dev`, only in the bundled serverless
  // output). Marking these external makes Next load them via Node's own
  // module resolution instead of inlining them into the webpack bundle,
  // which resolves the ESM/CJS interop correctly.
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin", "jwks-rsa", "jose"],
  },
};

export default nextConfig;
