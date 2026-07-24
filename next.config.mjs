/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // o motor lê os JSONs de /mock_erp e /mock_integracoes com fs — precisa rodar em Node,
  // não em Edge. Quando o job de sync existir, isso sai daqui e vira leitura de banco.
  serverExternalPackages: ['@prisma/client'],

  // Sem isto o deploy serverless (Vercel) sobe, mas quebra ao abrir a fila: o Next só
  // empacota os arquivos que enxerga por import estático, e esses JSONs são lidos em
  // runtime via fs — invisíveis para o rastreador. Aqui dizemos "inclua-os no pacote
  // de cada rota que roda o motor". Sai junto com a leitura de arquivo quando o banco
  // entrar.
  outputFileTracingIncludes: {
    '/fila': ['./mock_erp/**', './mock_integracoes/**'],
    '/cliente/[id]': ['./mock_erp/**', './mock_integracoes/**'],
    '/painel': ['./mock_erp/**', './mock_integracoes/**'],
    '/painel/ritual': ['./mock_erp/**', './mock_integracoes/**'],
  },
};

export default nextConfig;
