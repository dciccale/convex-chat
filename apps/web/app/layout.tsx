import type { Metadata } from "next";
import { ConvexClientProvider } from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "convex-chat demo",
  description: "A realtime demo of the convex-chat component",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
