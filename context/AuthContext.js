// src/context/AuthContext.js
"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { setAccessToken, startTokenRefresh } from "@/src/lib/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // full user object
  const [myPrivateKey, setMyPrivateKey] = useState(null); // CryptoKey — memory only
  const [myPublicKeyB64, setMyPublicKeyB64] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // On mount: check if user data exists in sessionStorage
    // Private key is NOT restored — user must re-login (correct security behavior)
    const savedUser = sessionStorage.getItem("commugate_user");
    const savedToken = sessionStorage.getItem("access_token");
    const savedPubKey = sessionStorage.getItem("commugate_pubkey");

    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setAccessToken(savedToken);
      if (savedPubKey) setMyPublicKeyB64(savedPubKey);
      // Private key is gone — redirect to login will happen via layout guard
    }

    setIsInitializing(false);
  }, []);

  const setAuthDetails = async (apiResponse, privateKeyObj, publicKeyB64) => {
    const userObj = apiResponse.user;
    const token = apiResponse.access_token;
    const refreshToken = apiResponse.refresh_token;

    // Set in-memory state
    setUser(userObj);
    setMyPrivateKey(privateKeyObj); // ✅ Only in memory — never written to storage
    setMyPublicKeyB64(publicKeyB64);
    setAccessToken(token);

    // Persist non-sensitive data to sessionStorage
    sessionStorage.setItem("commugate_user", JSON.stringify(userObj));
    sessionStorage.setItem("access_token", token);
    sessionStorage.setItem("refresh_token", refreshToken);
    sessionStorage.setItem("commugate_pubkey", publicKeyB64);

    startTokenRefresh();
  };

  const logout = () => {
    setUser(null);
    setMyPrivateKey(null);
    setMyPublicKeyB64(null);
    setAccessToken("");
    sessionStorage.clear();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        myPrivateKey,
        myPublicKeyB64,
        setAuthDetails,
        isInitializing,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
