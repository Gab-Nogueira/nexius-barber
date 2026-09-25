import type { Metadata } from 'next';
import { Archivo, Archivo_Black } from 'next/font/google';
import './globals.css';
import './polish.css';

const archivo = Archivo({ variable: '--font-body', subsets: ['latin'] });
const archivoBlack = Archivo_Black({ variable: '--font-display', weight: '400', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nexius Barber | Não é só corte, é conexão',
  description: 'Demonstração do novo portal e agendamento da Nexius Barber, em São José dos Campos.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${archivo.variable} ${archivoBlack.variable}`}>{children}</body>
    </html>
  );
}
