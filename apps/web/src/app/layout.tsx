import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: 'AI Beego - Nền tảng Marketing Automation',
  description: 'SaaS marketing automation dành cho spa, thẩm mỹ và doanh nghiệp dịch vụ',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'AI Beego',
    description: 'Nền tảng marketing automation',
    images: [{ url: '/brand/logo.png', width: 1024, height: 1024, alt: 'AI Beego' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
