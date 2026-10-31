import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A2Z Rentals — Inventory & bookings",
  description: "Manage A2Z Rentals stock, reservations, invoices, and returns.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
