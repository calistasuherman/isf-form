import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Importer Security Filing Form (10+2)",
  description: "ISF 10+2 Filing Form for U.S. Customs & Border Protection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: "'Times New Roman', Times, serif" }}>{children}</body>
    </html>
  );
}
