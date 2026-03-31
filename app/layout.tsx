import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Gate24 Pro - Borne de Télépaiement',
  description: 'Système de gestion de télépaiement pour taxis automatique',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} overflow-hidden`}>{children}</body>
    </html>
  )
}
