"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { setAccessToken, startTokenRefresh } from "@/src/lib/api";

const AuthContext = createContext();

function getStoredAuth() {
  if (typeof window === "undefined") {
    return { user: null, token: "", publicKey: null };
  }

  const savedUser = sessionStorage.getItem("commugate_user");
  const savedToken = sessionStorage.getItem("access_token");
  const savedPubKey = sessionStorage.getItem("commugate_pubkey");

  return {
    user: savedUser && savedToken ? JSON.parse(savedUser) : null,
    token: savedToken || "",
    publicKey: savedPubKey || null,
  };
}

export function AuthProvider({ children }) {
  const [storedAuth] = useState(getStoredAuth);
  const [user, setUser] = useState(storedAuth.user);
  const [myPrivateKey, setMyPrivateKey] = useState(null);
  const [myPublicKeyB64, setMyPublicKeyB64] = useState(storedAuth.publicKey);
  const [isInitializing] = useState(false);

  useEffect(() => {
    if (storedAuth.token) {
      setAccessToken(storedAuth.token);
      startTokenRefresh();
    }
  }, [storedAuth.token]);

  const setAuthDetails = async (apiResponse, privateKeyObj, publicKeyB64) => {
    const userObj = apiResponse.user;
    const token = apiResponse.access_token;
    const refreshToken = apiResponse.refresh_token;

    setUser(userObj);
    setMyPrivateKey(privateKeyObj);
    setMyPublicKeyB64(publicKeyB64);
    setAccessToken(token);

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
    window.location.href = "/auth";
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
