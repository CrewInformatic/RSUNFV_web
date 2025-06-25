// confirm-password - Sistema de restablecimiento de contraseña
import {
  auth,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "./firebase_config.js";

// Elementos del DOM
const resetFormSection = document.getElementById("reset-form-section");
const successContainer = document.getElementById("success-container");
const errorMessage = document.getElementById("error-message");
const successMessage = document.getElementById("success-message");
const resetForm = document.getElementById("reset-password-form");
const confirmEmailInput = document.getElementById("confirm-email");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const resetBtn = document.getElementById("reset-btn");
const passwordStrength = document.getElementById("password-strength");
const strengthText = document.getElementById("strength-text");
const strengthFill = document.getElementById("strength-fill");

// Variables globales para verificación de seguridad
let verifiedEmail = null;
let actionCodeVerified = false;
let currentActionCode = null;

/**
 * Verificar si venimos de un enlace de Firebase válido
 * @returns {boolean} - True si el referrer es válido
 */
function checkFirebaseReferrer() {
  const referrer = document.referrer;
  const currentDomain = window.location.hostname;

  const validReferrers = [
    "firebase.google.com",
    "firebaseapp.com",
    currentDomain,
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
  ];

  if (referrer) {
    const referrerDomain = new URL(referrer).hostname;
    return validReferrers.some(
      (domain) =>
        referrerDomain.includes(domain) || domain.includes(referrerDomain)
    );
  }

  return false;
}

/**
 * Obtener parámetros de restablecimiento desde la URL
 * @returns {Object|null} - Parámetros de restablecimiento o null
 */
function getResetParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const actionCode = urlParams.get("oobCode");

  if (mode && actionCode) {
    return { mode, actionCode, source: "url" };
  }
  return null;
}

/**
 * Verificar parámetros de URL con validación de seguridad
 */
async function checkUrlParams() {
  const params = getResetParameters();
  const isValidReferrer = checkFirebaseReferrer();

  // Si no tenemos parámetros pero tenemos un referrer válido
  if (!params && isValidReferrer) {
    showMessage(
      "Parece que vienes de un enlace válido, pero faltan algunos parámetros. " +
        "Por favor, intenta hacer clic en el enlace del correo nuevamente.",
      true
    );

    setTimeout(() => {
      window.location.href = "request-password-reset.html";
    }, 5000);
    return;
  }

  // Si no tenemos parámetros y no es un referrer válido
  if (!params) {
    if (
      confirm(
        "Esta página debe ser accedida desde el enlace de recuperación de contraseña enviado a tu correo.\n\n¿Tienes el código de recuperación y quieres continuar manualmente?"
      )
    ) {
      showMessage(
        "Acceso directo detectado. Asegúrate de tener el código de recuperación válido.",
        false
      );
      return;
    } else {
      window.location.href = "request-password-reset.html";
      return;
    }
  }

  const { mode, actionCode, source } = params;

  // Verificar modo de operación
  if (mode !== "resetPassword") {
    showMessage(
      "Modo de operación inválido. Esta página debe ser accedida desde el enlace de recuperación.",
      true
    );
    setTimeout(() => {
      window.location.href = "request-password-reset.html";
    }, 3000);
    return;
  }

  currentActionCode = actionCode;

  // Guardar parámetros en sessionStorage para persistencia
  try {
    sessionStorage.setItem(
      "firebaseResetParams",
      JSON.stringify({ mode, actionCode })
    );
  } catch (error) {
    // Error silenciado - sessionStorage podría no estar disponible
  }

  // Verificar el código de acción
  try {
    await verifyActionCodeAndGetEmail();
    showMessage(
      `Enlace verificado correctamente (fuente: ${source}). Puedes proceder a cambiar tu contraseña.`
    );
  } catch (error) {
    handleVerificationError(error);
  }
}

/**
 * Manejar errores de verificación del código de acción
 * @param {Error} error - Error de verificación
 */
function handleVerificationError(error) {
  let errorMsg = "Error al verificar el enlace de recuperación. ";

  switch (error.code) {
    case "auth/expired-action-code":
      errorMsg += "El enlace ha expirado.";
      break;
    case "auth/invalid-action-code":
      errorMsg += "El enlace no es válido.";
      break;
    default:
      if (error.message === "NO_ACTION_CODE") {
        errorMsg += "Código de verificación no encontrado.";
      } else {
        errorMsg += "Enlace inválido.";
      }
  }

  errorMsg += " Solicita un nuevo enlace de recuperación.";
  showMessage(errorMsg, true);

  setTimeout(() => {
    window.location.href = "request-password-reset.html";
  }, 5000);
}

/**
 * Verificar código de acción y obtener email asociado
 * @returns {Promise<string>} - Email verificado
 */
async function verifyActionCodeAndGetEmail() {
  if (!currentActionCode) {
    const params = getResetParameters();
    if (params) {
      currentActionCode = params.actionCode;
    }
  }

  if (!currentActionCode) {
    throw new Error("NO_ACTION_CODE");
  }

  try {
    const email = await verifyPasswordResetCode(auth, currentActionCode);

    verifiedEmail = email;
    actionCodeVerified = true;

    // Pre-llenar y bloquear el campo de email
    if (confirmEmailInput && email) {
      confirmEmailInput.value = email;
      confirmEmailInput.readOnly = true;
    }

    return email;
  } catch (error) {
    actionCodeVerified = false;
    console.error("Error crítico al verificar código:", error.code); // Console log crítico
    throw error;
  }
}

/**
 * Resetear contraseña usando el código de verificación
 * @param {Event} event - Evento de submit del formulario
 */
async function resetPassword(event) {
  event.preventDefault();

  const email = confirmEmailInput.value.trim().toLowerCase();
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validaciones de campos
  if (!email || !newPassword || !confirmPassword) {
    showMessage("Por favor completa todos los campos", true);
    return;
  }

  if (!validateEmail(email)) {
    showMessage("Por favor ingresa un correo electrónico válido", true);
    return;
  }

  if (verifiedEmail && email !== verifiedEmail.toLowerCase()) {
    showMessage(
      "El correo electrónico no coincide con el código de verificación. Por seguridad, debes usar el mismo email.",
      true
    );
    confirmEmailInput.classList.add("error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("Las contraseñas no coinciden", true);
    confirmPasswordInput.classList.add("error");
    return;
  }

  if (newPassword.length < 6) {
    showMessage("La contraseña debe tener al menos 6 caracteres", true);
    return;
  }

  if (!checkPasswordStrength(newPassword)) {
    showMessage("Por favor elige una contraseña más segura", true);
    return;
  }

  if (/\s/.test(newPassword)) {
    showMessage("La contraseña no puede contener espacios", true);
    return;
  }

  // Verificar código de acción
  if (!currentActionCode || !actionCodeVerified) {
    showMessage(
      "Código de verificación no válido. Por favor, usa el enlace del correo electrónico.",
      true
    );
    return;
  }

  // UI Loading state
  const originalText = resetBtn.textContent;
  resetBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2"></span>Cambiando contraseña...';
  resetBtn.disabled = true;

  try {
    await confirmPasswordReset(auth, currentActionCode, newPassword);

    // Limpiar datos almacenados
    try {
      sessionStorage.removeItem("firebaseResetParams");
      localStorage.removeItem("firebaseResetParams");
    } catch (error) {
      // Error silenciado
    }

    // Limpiar campos sensibles
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";

    // Mostrar éxito y redirigir
    resetFormSection.style.display = "none";
    successContainer.style.display = "block";

    setTimeout(() => {
      const loginUrl = "login.html";
      showMessage("Redirigiendo al login en 3 segundos...");
      setTimeout(() => {
        window.location.href = loginUrl;
      }, 3000);
    }, 2000);
  } catch (error) {
    console.error("Error crítico al resetear contraseña:", error.code); // Console log crítico
    handleResetError(error);
  } finally {
    resetBtn.textContent = originalText;
    resetBtn.disabled = false;
  }
}

/**
 * Manejar errores específicos del reset de contraseña
 * @param {Error} error - Error de Firebase
 */
function handleResetError(error) {
  let errorMessageText = "Error al cambiar la contraseña. ";

  switch (error.code) {
    case "auth/expired-action-code":
      errorMessageText +=
        "El enlace ha expirado. Solicita un nuevo enlace de recuperación.";
      setTimeout(() => {
        window.location.href = "request-password-reset.html";
      }, 3000);
      break;
    case "auth/invalid-action-code":
      errorMessageText +=
        "El enlace no es válido. Solicita un nuevo enlace de recuperación.";
      setTimeout(() => {
        window.location.href = "request-password-reset.html";
      }, 3000);
      break;
    case "auth/weak-password":
      errorMessageText +=
        "La contraseña es muy débil. Debe tener al menos 6 caracteres y ser más segura.";
      break;
    case "auth/user-mismatch":
      errorMessageText +=
        "El correo electrónico no coincide con el código de verificación.";
      break;
    case "auth/user-not-found":
      errorMessageText += "No se encontró una cuenta asociada con este correo.";
      break;
    case "auth/too-many-requests":
      errorMessageText +=
        "Demasiados intentos. Espera unos minutos antes de intentar nuevamente.";
      break;
    default:
      errorMessageText += `Por favor, intenta nuevamente. (Código: ${
        error.code || "desconocido"
      })`;
  }

  showMessage(errorMessageText, true);
}

/**
 * Mostrar mensajes de éxito o error
 * @param {string} message - Mensaje a mostrar
 * @param {boolean} isError - Si es un mensaje de error
 */
function showMessage(message, isError = false) {
  if (isError) {
    errorMessage.querySelector("#error-text").textContent = message;
    errorMessage.style.display = "block";
    successMessage.style.display = "none";
  } else {
    successMessage.querySelector("#success-text").textContent = message;
    successMessage.style.display = "block";
    errorMessage.style.display = "none";
  }

  setTimeout(() => {
    errorMessage.style.display = "none";
    successMessage.style.display = "none";
  }, 10000);
}

/**
 * Verificar fortaleza de la contraseña
 * @param {string} password - Contraseña a verificar
 * @returns {boolean} - Si la contraseña es suficientemente fuerte
 */
function checkPasswordStrength(password) {
  let strength = 0;
  let text = "Muy débil";
  let color = "#dc3545";

  const criteria = {
    length: password.length >= 8,
    minLength: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    noSpaces: !/\s/.test(password),
  };

  if (criteria.minLength) strength += 1;
  if (criteria.length) strength += 1;
  if (criteria.uppercase) strength += 1;
  if (criteria.lowercase) strength += 1;
  if (criteria.numbers) strength += 1;
  if (criteria.special) strength += 1;
  if (criteria.noSpaces) strength += 0.5;

  passwordStrength.className = "password-strength";

  if (strength < 3) {
    passwordStrength.classList.add("strength-weak");
    text = "Débil";
    color = "#dc3545";
  } else if (strength < 5) {
    passwordStrength.classList.add("strength-medium");
    text = "Media";
    color = "#ffc107";
  } else {
    passwordStrength.classList.add("strength-strong");
    text = "Fuerte";
    color = "#198754";
  }

  strengthText.textContent = text;
  if (strengthFill) {
    strengthFill.style.width = `${(strength / 6) * 100}%`;
    strengthFill.style.backgroundColor = color;
  }

  passwordStrength.style.display = password.length > 0 ? "block" : "none";
  return strength >= 4;
}

/**
 * Validar que las contraseñas coincidan
 * @returns {boolean} - Si las contraseñas coinciden
 */
function validatePasswordMatch() {
  const password = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (confirmPassword.length > 0) {
    if (password !== confirmPassword) {
      confirmPasswordInput.classList.add("error");
      confirmPasswordInput.setCustomValidity("Las contraseñas no coinciden");
      return false;
    } else {
      confirmPasswordInput.classList.remove("error");
      confirmPasswordInput.setCustomValidity("");
      return true;
    }
  }
  confirmPasswordInput.setCustomValidity("");
  return true;
}

/**
 * Validar formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} - Si el email es válido
 */
function validateEmail(email) {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Event Listeners
newPasswordInput.addEventListener("input", (e) => {
  checkPasswordStrength(e.target.value);
});

confirmPasswordInput.addEventListener("input", validatePasswordMatch);
newPasswordInput.addEventListener("input", validatePasswordMatch);
resetForm.addEventListener("submit", resetPassword);

resetForm.addEventListener("submit", (e) => {
  if (!actionCodeVerified) {
    e.preventDefault();
    showMessage("Por favor espera a que se verifique el enlace", true);
  }
});

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", async function () {
  errorMessage.style.display = "none";
  successMessage.style.display = "none";
  successContainer.style.display = "none";

  await checkUrlParams();
});

// Prevenir pérdida de datos
window.addEventListener("beforeunload", (e) => {
  if (actionCodeVerified && successContainer.style.display === "none") {
    e.preventDefault();
    e.returnValue =
      "¿Estás seguro de que quieres salir? Perderás el progreso del restablecimiento de contraseña.";
  }
});

window.addEventListener("unload", () => {
  if (newPasswordInput) newPasswordInput.value = "";
  if (confirmPasswordInput) confirmPasswordInput.value = "";
});
