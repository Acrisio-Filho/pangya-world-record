const passwordMessage = "Para proteger sua conta, crie uma senha com pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo.";

export function isStrongPassword(password) {
  const value = String(password || "");
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /[A-Za-z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9\s]/.test(value);
}

export { passwordMessage };
