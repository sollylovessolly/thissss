import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Everything inside AuthProvider can now use useAuth() */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
