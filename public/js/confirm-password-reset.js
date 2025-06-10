// SOLUCIÓN ALTERNATIVA: Modificar el JavaScript para aceptar parámetros desde localStorage o sessionStorage
// También verificar si venimos del enlace directo

// Importar Firebase (ajusta la ruta según tu estructura)
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

// NUEVA FUNCIÓN: Verificar si venimos de un enlace de Firebase válido
function checkFirebaseReferrer() {
  const referrer = document.referrer;
  const currentDomain = window.location.hostname;

  // Verificar si venimos de Firebase o de nuestro propio dominio
  const validReferrers = [
    "firebase.google.com",
    "firebaseapp.com",
    currentDomain,
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
  ];

  console.log("Referrer:", referrer);

  if (referrer) {
    const referrerDomain = new URL(referrer).hostname;
    return validReferrers.some(
      (domain) =>
        referrerDomain.includes(domain) || domain.includes(referrerDomain)
    );
  }

  return false;
}

// NUEVA FUNCIÓN: Intentar obtener parámetros de diferentes fuentes
function getResetParameters() {
  // Método 1: Desde URL (preferido)
  const urlParams = new URLSearchParams(window.location.search);
  let mode = urlParams.get("mode");
  let actionCode = urlParams.get("oobCode");

  if (mode && actionCode) {
    console.log("Parámetros encontrados en URL");
    return { mode, actionCode, source: "url" };
  }

  // Método 2: Desde localStorage (si se guardaron previamente)
  try {
    const savedParams = localStorage.getItem("firebaseResetParams");
    if (savedParams) {
      const params = JSON.parse(savedParams);
      console.log("Parámetros encontrados en localStorage");
      return { ...params, source: "localStorage" };
    }
  } catch (e) {
    console.log("No se pudieron obtener parámetros de localStorage");
  }

  // Método 3: Desde sessionStorage
  try {
    const savedParams = sessionStorage.getItem("firebaseResetParams");
    if (savedParams) {
      const params = JSON.parse(savedParams);
      console.log("Parámetros encontrados en sessionStorage");
      return { ...params, source: "sessionStorage" };
    }
  } catch (e) {
    console.log("No se pudieron obtener parámetros de sessionStorage");
  }

  // Método 4: Verificar si hay un fragmento en la URL (algunos clientes de correo lo usan)
  const hash = window.location.hash.substring(1);
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    mode = hashParams.get("mode");
    actionCode = hashParams.get("oobCode");

    if (mode && actionCode) {
      console.log("Parámetros encontrados en fragment/hash");
      return { mode, actionCode, source: "hash" };
    }
  }

  return null;
}

// FUNCIÓN MODIFICADA: Verificar parámetros con más flexibilidad
async function checkUrlParams() {
  console.log("Verificando parámetros de restablecimiento...");

  const params = getResetParameters();
  const isValidReferrer = checkFirebaseReferrer();

  console.log("Parámetros obtenidos:", params);
  console.log("Referrer válido:", isValidReferrer);

  // Si no tenemos parámetros pero tenemos un referrer válido, mostrar ayuda
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
    // OPCIÓN FLEXIBLE: Permitir acceso directo pero con advertencia
    if (
      confirm(
        "Esta página debe ser accedida desde el enlace de recuperación de contraseña enviado a tu correo.\n\n¿Tienes el código de recuperación y quieres continuar manualmente?"
      )
    ) {
      showMessage(
        "Acceso directo detectado. Asegúrate de tener el código de recuperación válido.",
        false
      );
      return; // Permitir continuar
    } else {
      window.location.href = "request-password-reset.html";
      return;
    }
  }

  const { mode, actionCode, source } = params;

  // Verificar modo
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

  // Guardar código de acción
  currentActionCode = actionCode;

  // Guardar parámetros para uso futuro (por si se recarga la página)
  try {
    sessionStorage.setItem(
      "firebaseResetParams",
      JSON.stringify({ mode, actionCode })
    );
  } catch (e) {
    console.log("No se pudieron guardar parámetros en sessionStorage");
  }

  // Verificar el código de acción
  try {
    await verifyActionCodeAndGetEmail();
    showMessage(
      `Enlace verificado correctamente (fuente: ${source}). Puedes proceder a cambiar tu contraseña.`
    );
  } catch (error) {
    console.error("Error al verificar enlace:", error);
    handleVerificationError(error);
  }
}

// Función para manejar errores de verificación
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

// FUNCIÓN MODIFICADA: Verificar código con el parámetro almacenado
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
    console.log("Verificando código de acción...");
    const email = await verifyPasswordResetCode(auth, currentActionCode);
    console.log("Código verificado. Email asociado:", email);

    verifiedEmail = email;
    actionCodeVerified = true;

    // Pre-llenar el campo de email si está disponible
    if (confirmEmailInput && email) {
      confirmEmailInput.value = email;
      confirmEmailInput.readOnly = true;
    }

    return email;
  } catch (error) {
    console.error("Error al verificar código:", error);
    actionCodeVerified = false;
    throw error;
  }
}

// FUNCIÓN MODIFICADA: Reset password usando el código almacenado
async function resetPassword(event) {
  event.preventDefault();
  console.log("Iniciando proceso de restablecimiento seguro...");

  const email = confirmEmailInput.value.trim().toLowerCase();
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Todas las validaciones anteriores se mantienen igual...
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

  // Usar el código almacenado
  if (!currentActionCode || !actionCodeVerified) {
    showMessage(
      "Código de verificación no válido. Por favor, usa el enlace del correo electrónico.",
      true
    );
    return;
  }

  // Cambiar botón a estado de carga
  const originalText = resetBtn.textContent;
  resetBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2"></span>Cambiando contraseña...';
  resetBtn.disabled = true;

  try {
    console.log("Confirmando cambio de contraseña...");

    await confirmPasswordReset(auth, currentActionCode, newPassword);
    console.log("Contraseña cambiada exitosamente");

    // Limpiar datos almacenados
    try {
      sessionStorage.removeItem("firebaseResetParams");
      localStorage.removeItem("firebaseResetParams");
    } catch (e) {
      console.log("Error al limpiar storage");
    }

    newPasswordInput.value = "";
    confirmPasswordInput.value = "";

    resetFormSection.style.display = "none";
    successContainer.style.display = "block";

    setTimeout(() => {
      const loginUrl = "login.html";
      showMessage(`Redirigiendo al login en 3 segundos...`);
      setTimeout(() => {
        window.location.href = loginUrl;
      }, 3000);
    }, 2000);
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    handleResetError(error);
  } finally {
    resetBtn.textContent = originalText;
    resetBtn.disabled = false;
  }
}

// Función para manejar errores de reset
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

// Resto de funciones se mantienen igual...
function showMessage(message, isError = false) {
  console.log(`[${isError ? "ERROR" : "SUCCESS"}] ${message}`);

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

function validateEmail(email) {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Event listeners
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

// Inicializar cuando se carga la página
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Página de restablecimiento cargada");

  errorMessage.style.display = "none";
  successMessage.style.display = "none";
  successContainer.style.display = "none";

  await checkUrlParams();
});

// Event listeners para prevenir pérdida de datos
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
