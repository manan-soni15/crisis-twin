import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/newsreader/opsz.css";
import "./globals.css";

export const metadata = {
  title: { default: "Crisis Twin", template: "%s | Crisis Twin" },
  description:
    "Crisis Twin is a flight simulator for your money. Describe a shock, watch it travel through your holdings, and hear three AI advisors argue over what to do.",
};

export const viewport = { themeColor: "#1a2fd4" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
