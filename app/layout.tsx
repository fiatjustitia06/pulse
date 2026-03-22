import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Pulse — Sydney Business Location Intelligence',
  description: 'AI-powered location insights for Sydney businesses. Find the perfect spot and understand your market.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body style={{ fontFamily: 'var(--font-body)' }}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#E2EFDE',
              color: '#131515',
              border: '1.5px solid #0A8754',
              borderRadius: '10px',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#0A8754', secondary: '#E2EFDE' },
            },
            error: {
              iconTheme: { primary: '#B07156', secondary: '#E2EFDE' },
            },
          }}
        />
      </body>
    </html>
  )
}
