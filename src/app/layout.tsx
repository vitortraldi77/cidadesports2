import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import './globals.css'

// Fonte do design system do Cidade Sports. A display condensada original das
// peças de Instagram não foi fornecida (ver README do design system);
// Archivo é a aproximação mais próxima no Google Fonts — mesma família cobre
// texto corrido (peso normal) e títulos (peso 800, caixa alta).
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Reserva de Espaços | Cidade Sports',
  description:
    'Solicite a reserva das quadras, do campo e do Espaço Ignição do Cidade Sports — Igreja da Cidade.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e2181d',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  )
}
