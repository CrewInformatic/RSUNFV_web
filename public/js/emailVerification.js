// emailVerification.js - Verificación de email con Firebase
import {
  auth,
  applyActionCode,
  checkActionCode,
  sendEmailVerification,
  onAuthStateChanged,
} from "./firebase_config.js";

// Elementos del DOM
const userEmailDiv = document.getElementById("userEmail");
const statusMessage = document.getElementById("statusMessage");
const loadingSpinner = document.getElementById("loadingSpinner");
const verificationCheck = document.getElementById("verificationCheck");
const checkVerificationBtn = document.getElementById("checkVerificationBtn");
const resendEmailBtn = document.getElementById("resendEmailBtn");
const countdownTimer = document.getElementById("countdownTimer");
const verificationOverlay = document.getElementById("verificationOverlay");
const verificationSteps = document.querySelector(".verification-steps");
const actionButtons = document.querySelector(".action-buttons");

// Variables globales
let currentActionCode = null;
let verifiedEmail = null;
let countdownInterval = null;
let resendCooldown = 60;

// Verificar si venimos de un enlace de Firebase válido
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

// Obtener parámetros de la URL (Método 1 - Recomendado)
function getVerificationParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  let mode = urlParams.get("mode");
  let actionCode = urlParams.get("oobCode");

  if (mode && actionCode) {
    return { mode, actionCode, source: "url" };
  }
  return null;
}

// Verificar parámetros de URL
async function checkUrlParams() {
  const params = getVerificationParameters();
  const isValidReferrer = checkFirebaseReferrer();

  // Si no tenemos parámetros pero tenemos un referrer válido
  if (!params && isValidReferrer) {
    showMessage(
      "Parece que vienes de un enlace válido, pero faltan algunos parámetros. " +
        "Por favor, intenta hacer clic en el enlace del correo nuevamente.",
      "error"
    );

    setTimeout(() => {
      window.location.href = "register.html";
    }, 5000);
    return;
  }

  // Si no tenemos parámetros - mostrar instrucciones normales
  if (!params) {
    await showInstructions();
    return;
  }

  const { mode, actionCode, source } = params;

  // Verificar modo
  if (mode !== "verifyEmail") {
    showMessage(
      "Modo de operación inválido. Esta página debe ser accedida desde el enlace de verificación de email.",
      "error"
    );
    setTimeout(() => {
      window.location.href = "register.html";
    }, 3000);
    return;
  }

  // Guardar código de acción
  currentActionCode = actionCode;

  // Procesar verificación automáticamente
  await processEmailVerification();
}

// Mostrar instrucciones cuando no hay parámetros
async function showInstructions() {
  // Obtener usuario actual si está autenticado
  if (auth.currentUser) {
    const email = auth.currentUser.email;
    displayUserEmail(email);

    // Verificar si ya está verificado
    if (auth.currentUser.emailVerified) {
      showAlreadyVerified(email);
      return;
    }
  }

  // Mostrar instrucciones normales
  showMessage(
    "Revisa tu correo electrónico y haz clic en el enlace de verificación.",
    "info"
  );
  startResendCooldown();
}

// Procesar verificación de email con el código de la URL
async function processEmailVerification() {
  if (!currentActionCode) {
    showMessage("Código de verificación no encontrado.", "error");
    return;
  }

  showLoadingOverlay(true);
  hideInstructions();

  try {
    // Verificar el código antes de aplicarlo
    const info = await checkActionCode(auth, currentActionCode);
    verifiedEmail = info.data.email;

    // Mostrar email del usuario
    displayUserEmail(verifiedEmail);

    // Aplicar el código de verificación
    await applyActionCode(auth, currentActionCode);

    // Mostrar éxito
    showVerificationSuccess(verifiedEmail);
  } catch (error) {
    handleVerificationError(error);
  } finally {
    showLoadingOverlay(false);
  }
}

// Mostrar email verificado exitosamente
function showVerificationSuccess(email) {
  hideInstructions();
  hideActionButtons();

  verificationCheck.style.display = "block";

  showMessage(
    `¡Email verificado correctamente! Tu cuenta ha sido activada exitosamente.`,
    "success"
  );

  // Mostrar countdown para redirección
  let countdown = 8;
  const countdownElement = document.createElement("div");
  countdownElement.className = "redirect-countdown";
  countdownElement.innerHTML = `<p>Se te redireccionará al login en <strong><span id="redirectCountdown">${countdown}</span></strong> segundos</p>`;

  verificationCheck.appendChild(countdownElement);

  const countdownSpan = document.getElementById("redirectCountdown");

  const redirectInterval = setInterval(() => {
    countdown--;
    countdownSpan.textContent = countdown;

    if (countdown <= 0) {
      clearInterval(redirectInterval);
      window.location.href = "login.html";
    }
  }, 1000);
}

// Mostrar que ya está verificado
function showAlreadyVerified(email) {
  hideInstructions();
  hideActionButtons();

  verificationCheck.style.display = "block";

  showMessage(
    `Tu email ya está verificado. Puedes iniciar sesión normalmente.`,
    "success"
  );

  setTimeout(() => {
    window.location.href = "login.html";
  }, 3000);
}

// Manejar errores de verificación
function handleVerificationError(error) {
  let errorMsg = "Error al verificar el email. ";

  switch (error.code) {
    case "auth/expired-action-code":
      errorMsg += "El enlace ha expirado.";
      break;
    case "auth/invalid-action-code":
      errorMsg += "El enlace no es válido.";
      break;
    case "auth/user-disabled":
      errorMsg += "Esta cuenta ha sido deshabilitada.";
      break;
    case "auth/user-not-found":
      errorMsg += "No se encontró una cuenta asociada con este enlace.";
      break;
    default:
      errorMsg += "Enlace inválido o expirado.";
  }

  errorMsg += " Por favor, solicita un nuevo enlace de verificación.";
  showMessage(errorMsg, "error");

  // Mostrar botón para reenviar
  showInstructions();
}

// Verificar estado del email manualmente
async function checkEmailVerification() {
  if (!auth.currentUser) {
    showMessage(
      "No hay usuario autenticado. Por favor, inicia sesión.",
      "error"
    );
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return;
  }

  checkVerificationBtn.innerHTML =
    '<div class="loading-spinner" style="display: inline-block; width: 16px; height: 16px; margin-right: 8px;"></div>Verificando...';
  checkVerificationBtn.disabled = true;

  try {
    // Recargar usuario para obtener estado actualizado
    await auth.currentUser.reload();

    if (auth.currentUser.emailVerified) {
      showVerificationSuccess(auth.currentUser.email);
    } else {
      showMessage(
        "El email aún no ha sido verificado. Revisa tu correo.",
        "warning"
      );
    }
  } catch (error) {
    showMessage("Error al verificar el estado del email.", "error");
  } finally {
    checkVerificationBtn.innerHTML = "Verificar Estado del Email";
    checkVerificationBtn.disabled = false;
  }
}

// Reenviar email de verificación
async function resendVerificationEmail() {
  if (!auth.currentUser) {
    showMessage("No hay usuario autenticado.", "error");
    return;
  }

  resendEmailBtn.innerHTML =
    '<div class="loading-spinner" style="display: inline-block; width: 16px; height: 16px; margin-right: 8px;"></div>Enviando...';
  resendEmailBtn.disabled = true;

  try {
    await sendEmailVerification(auth.currentUser);
    showMessage(
      "Email de verificación reenviado. Revisa tu correo.",
      "success"
    );
    startResendCooldown();
  } catch (error) {
    let errorMsg = "Error al reenviar el email. ";

    switch (error.code) {
      case "auth/too-many-requests":
        errorMsg += "Demasiados intentos. Espera unos minutos.";
        break;
      default:
        errorMsg += "Inténtalo más tarde.";
    }

    showMessage(errorMsg, "error");
  } finally {
    resendEmailBtn.innerHTML = "Reenviar Email de Verificación";
  }
}

// Iniciar countdown para reenvío
function startResendCooldown() {
  resendCooldown = 60;
  resendEmailBtn.disabled = true;

  const countdownSpan = document.getElementById("countdown");

  countdownInterval = setInterval(() => {
    resendCooldown--;
    countdownSpan.textContent = resendCooldown;

    if (resendCooldown <= 0) {
      clearInterval(countdownInterval);
      resendEmailBtn.disabled = false;
      document.querySelector(".resend-info").style.display = "none";
    }
  }, 1000);
}

// Mostrar email del usuario
function displayUserEmail(email) {
  if (userEmailDiv && email) {
    userEmailDiv.innerHTML = `<strong>${email}</strong>`;
    userEmailDiv.style.display = "block";
  }
}

// Mostrar/ocultar overlay de carga
function showLoadingOverlay(show) {
  if (verificationOverlay) {
    verificationOverlay.style.display = show ? "flex" : "none";
  }
}

// Ocultar instrucciones
function hideInstructions() {
  if (verificationSteps) {
    verificationSteps.style.display = "none";
  }
}

// Ocultar botones de acción
function hideActionButtons() {
  if (actionButtons) {
    actionButtons.style.display = "none";
  }
}

// Mostrar mensajes
function showMessage(message, type = "info") {
  if (!statusMessage) return;

  statusMessage.className = `status-message ${type}`;
  statusMessage.textContent = message;
  statusMessage.style.display = "block";

  // Auto-ocultar mensajes de info después de 10 segundos
  if (type === "info" || type === "warning") {
    setTimeout(() => {
      statusMessage.style.display = "none";
    }, 10000);
  }
}

// Funciones globales para los botones
window.checkEmailVerification = checkEmailVerification;
window.resendVerificationEmail = resendVerificationEmail;

// Monitorear estado de autenticación
onAuthStateChanged(auth, (user) => {
  if (user && !currentActionCode) {
    displayUserEmail(user.email);

    if (user.emailVerified) {
      showAlreadyVerified(user.email);
    }
  }
});

// Inicializar cuando se carga la página
document.addEventListener("DOMContentLoaded", async function () {
  // Ocultar elementos inicialmente
  statusMessage.style.display = "none";
  verificationCheck.style.display = "none";
  loadingSpinner.style.display = "none";
  verificationOverlay.style.display = "none";

  // Verificar parámetros de URL
  await checkUrlParams();
});

// Limpiar intervalos al salir
window.addEventListener("beforeunload", () => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
