"use client";
import { useState } from "react";
import { api } from "@/src/lib/api";
import { prepareRegistration, unwrapPrivateKey } from "@/src/lib/crypto";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    display_name: "",
  });

  // We only need setAuthDetails from context now
  const { setAuthDetails } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        // 1. Fetch user data and tokens from the backend
        const res = await api.login(formData.username, formData.password);

        // Handle FastAPI validation/auth errors
        if (res.error || res.detail) {
          const errorMsg =
            typeof res.detail === "string"
              ? res.detail
              : res.detail?.[0]?.msg || "Login failed";
          throw new Error(errorMsg);
        }

        // 2. Unwrap the Private Key using the user's password
        const key = await unwrapPrivateKey(
          formData.password,
          res.user.wrapped_private_key,
          res.user.pbkdf2_salt,
        );

        // 3. Update Global State & Persistence
        // This single call handles:
        // - Setting 'user' state
        // - Setting 'myPrivateKey' state
        // - Setting 'myPublicKeyB64' state
        // - Syncing to localStorage and sessionStorage
        await setAuthDetails(res, key, res.user.public_key);

        router.push("/chat");
      } else {
        // --- REGISTRATION FLOW ---
        // 1. Generate RSA keys and PBKDF2 salt locally
        const cryptoData = await prepareRegistration(formData.password);

        // 2. Construct the payload matching the backend expectations
        const registrationPayload = {
          username: formData.username.toLowerCase(),
          display_name: formData.display_name,
          password: formData.password,
          public_key: cryptoData.publicKey,
          wrapped_private_key: cryptoData.wrappedKey,
          pbkdf2_salt: cryptoData.salt,
        };

        const res = await api.register(registrationPayload);

        if (res.detail) {
          throw new Error(
            Array.isArray(res.detail) ? res.detail[0].msg : res.detail,
          );
        }

        // 3. Success: Switch to login mode
        alert("Account created! Please login.");
        setIsLogin(true);
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <h2 className="text-3xl font-bold text-white text-center mb-2">
          {isLogin ? "Welcome Back" : "Join WhisperBox"}
        </h2>
        <p className="text-zinc-500 text-center mb-8 text-sm">
          {isLogin
            ? "Enter your credentials to access your secure vault"
            : "Create a new end-to-end encrypted identity"}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">
              Username
            </label>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
              placeholder="e.g. satoshi_99"
              required
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">
                Display Name
              </label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                placeholder="What should others call you?"
                required
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">
              Master Password
            </label>
            <input
              type="password"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
              placeholder="••••••••"
              required
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-indigo-900/20 mt-4"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Decrypting Vault...</span>
              </div>
            ) : isLogin ? (
              "Unlock & Login"
            ) : (
              "Generate Keys & Join"
            )}
          </button>
        </form>

        <p className="text-zinc-500 text-center mt-8 text-sm">
          {isLogin ? "New here?" : "Already a member?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
          >
            {isLogin ? "Create an account" : "Sign in to vault"}
          </button>
        </p>
      </div>
    </div>
  );
}
