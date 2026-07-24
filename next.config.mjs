/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // o motor lê os JSONs de /mock_erp e /mock_integracoes com fs — precisa rodar em Node,
  // não em Edge. Quando o job de sync existir, isso sai daqui e vira leitura de banco.
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
