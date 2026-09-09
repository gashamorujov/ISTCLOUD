import "./globals.css";

export const metadata = {
  title: "Fayl Meneceri",
  description: "Fayl yükləmə və idarəetmə platforması",
};

export default function RootLayout({ children }) {
  return (
    <html lang="az">
      <body className="min-h-screen text-slate-800 antialiased">{children}</body>
    </html>
  );
}
