import './globals.css';

export const metadata = { title: 'AstroTalk', description: 'Realtime AI astrologer' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
