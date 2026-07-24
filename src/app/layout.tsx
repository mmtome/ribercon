import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ribercon · Fila do dia',
  description: 'Playbook diário de ativação comercial — Grupo Ribercon',
  applicationName: 'Ribercon',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Ribercon' },
};

export const viewport: Viewport = {
  // acompanha o fundo do app: no Android a barra do sistema encosta na tela e uma
  // faixa de cor diferente ali denuncia na hora que é "um site", não um aplicativo
  themeColor: '#06101A',
  width: 'device-width',
  initialScale: 1,
  // sem maximumScale: travar zoom quebra acessibilidade para quem precisa ampliar
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased min-h-dvh">{children}</body>
    </html>
  );
}
