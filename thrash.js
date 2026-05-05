const handleRegister = async () => {
  // A. Do the crypto work locally
  const cryptoData = await preparingRegistration(password);

  // B. Send the whole payload to the backend
  const result = await api.register({
    username,
    display_name,
    password,
    ...cryptoData, //spread publicKey, wrappedKey, and salt
  });

  if (result.access_token) {
    //save tokens and move to chat
  }
};

const handleLogin = async () => {
  const result = await api.login(username, password);

  if (result.access_token) {
    // These specific field names come from your documentation screenshots
    const privateKey = await unwrapPrivateKey(
      password,
      result.user.wrapped_private_key, // The locked key from the server
      result.user.pbkdf2_salt, // The salt needed to unlock it
    );

    // Store the unlocked Private Key in a state or a global context
    // and store the access_token for API calls
    console.log("Success! Private key is now live in memory.");
  }
};
