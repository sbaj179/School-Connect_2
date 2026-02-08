import "../styles/globals.css";

export const metadata = {
  title: "School Connect",
  description: "Multi-tenant school communication platform"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
