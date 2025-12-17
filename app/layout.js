import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Fondeka Admin',
  description: 'Admin dashboard for the Fondeka fintech platform.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
