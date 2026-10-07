import './globals.css';

export const metadata = {
  title: 'ApparelFlow ERP - Gatekeeper',
  description: 'Production Batch Verification & Sewing Queue Gate'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
