// Importar Firebase (ajusta la ruta según tu estructura)
import {
  auth,
  applyActionCode,
  sendEmailVerification,
  onAuthStateChanged,
  checkActionCode,
} from "./firebase_config.js";

// Variables globales
let currentUser = null;
let verificationProcessed = false;
let currentActionCode = null;
let currentMode = null;

// Elementos del DOM
const loadingSpinner = document.getElementById("loading-spinner");
const messageContainer = document.getElementById("message-container");
const instructionsSection = document.getElementById("instructions-section");
const successSection = document.getElementById("success-section");
const emailDisplay = document.getElementById("email-display");
const userEmailSpan = document.getElementById("user-email");
const verifiedEmailDiv = document.getElementById("verified-email");
const countdownTimer = document.getElementById("countdown-timer");
const actionButtons = document.getElementById("action-buttons");
const gotoLoginBtn = document.getElementById("goto-login-btn");

// NUEVA FUNCIONALIDAD 2: Detección en tiempo real del estado de verificación
function startRealtimeVerificationCheck() {
  // Verificar cada 3 segundos si el email ha sido verificado
  const verificationCheckInterval = setInterval(() => {
    if (currentUser && !verificationProcessed) {
      // Recargar el usuario para obtener el estado más actual
      currentUser
        .reload()
        .then(() => {
          if (currentUser.emailVerified && !verificationProcessed) {
            verificationProcessed = true;
            clearInterval(verificationCheckInterval);
            handleSuccessfulVerification(currentUser.email);
          }
        })
        .catch((error) => {
          console.log("Error al verificar estado:", error);
        });
    }
  }, 3000);

  // Limpiar el intervalo si se cierra la ventana
  window.addEventListener("beforeunload", () => {
    clearInterval(verificationCheckInterval);
  });
}

// NUEVA FUNCIONALIDAD 3: Medidas de seguridad (actualizada para permitir más navegadores)
function implementSecurityMeasures() {
  // Prevenir retroceder en el navegador
  history.pushState(null, null, location.href);
  window.addEventListener("popstate", function () {
    history.pushState(null, null, location.href);
  });

  // Función para detectar el navegador
  function getBrowserInfo() {
    const userAgent = navigator.userAgent.toLowerCase();
    const allowedBrowsers = [
      "chrome",
      "firefox",
      "safari",
      "edge",
      "edg",
      "brave",
      "opera",
      "opr",
    ];

    return allowedBrowsers.some((browser) => userAgent.includes(browser));
  }

  // Solo aplicar restricciones si es un navegador permitido
  if (getBrowserInfo()) {
    // Deshabilitar herramientas de desarrollador
    // Deshabilitar F12
    document.addEventListener("keydown", function (e) {
      // F12
      if (e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+I
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
        e.preventDefault();
        return false;
      }
      // Ctrl+Shift+J
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
        return false;
      }
      // Ctrl+U
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        return false;
      }
    });

    // Deshabilitar clic derecho
    document.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      return false;
    });

    // Detectar si las herramientas de desarrollador están abiertas
    let devtools = {
      open: false,
      orientation: null,
    };

    const threshold = 160;
    setInterval(() => {
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        if (!devtools.open) {
          devtools.open = true;
          // Redirigir o mostrar mensaje de advertencia
          showMessage(
            "Por seguridad, las herramientas de desarrollador no están permitidas.",
            "error"
          );
          setTimeout(() => {
            window.location.href = "index.html";
          }, 5000);
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }
}

// Función para mostrar mensajes
function showMessage(message, type = "info") {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = message;
  messageContainer.innerHTML = "";
  messageContainer.appendChild(messageDiv);
}

// Función para verificar si venimos de Firebase o dominio válido
function checkValidReferrer() {
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

// Función para obtener parámetros de la URL
function getUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const actionCode = urlParams.get("oobCode");

  return { mode, actionCode };
}

// Función para verificar el código de acción
async function verifyActionCode(actionCode) {
  try {
    const info = await checkActionCode(auth, actionCode);
    return info;
  } catch (error) {
    throw error;
  }
}

// Función para aplicar la verificación de email
async function applyEmailVerification(actionCode) {
  try {
    await applyActionCode(auth, actionCode);
    return true;
  } catch (error) {
    throw error;
  }
}

// Función para manejar la verificación exitosa
function handleSuccessfulVerification(email) {
  // Marcar como procesado
  verificationProcessed = true;

  // Ocultar elementos innecesarios
  if (loadingSpinner) loadingSpinner.style.display = "none";
  if (instructionsSection) instructionsSection.classList.add("hidden");
  if (actionButtons) actionButtons.classList.add("hidden");

  // Mostrar información de éxito
  if (verifiedEmailDiv)
    verifiedEmailDiv.textContent = `Tu email ${email} ha sido verificado correctamente.`;
  if (successSection) successSection.classList.remove("hidden");

  // Iniciar countdown
  startCountdown();
}

// Función para iniciar countdown
function startCountdown() {
  let seconds = 5;
  const countdownInterval = setInterval(() => {
    if (countdownTimer) countdownTimer.textContent = seconds;
    seconds--;

    if (seconds < 0) {
      clearInterval(countdownInterval);
      window.location.href = "login.html";
    }
  }, 1000);
}

// Función para manejar errores
function handleError(error, actionCode = null) {
  if (loadingSpinner) loadingSpinner.style.display = "none";

  let errorMessage = "Error al procesar la verificación. ";

  switch (error.code) {
    case "auth/expired-action-code":
      errorMessage +=
        "El enlace ha expirado. Solicita un nuevo email de verificación.";
      break;
    case "auth/invalid-action-code":
      errorMessage +=
        "El enlace no es válido. Solicita un nuevo email de verificación.";
      break;
    case "auth/user-disabled":
      errorMessage += "Esta cuenta ha sido deshabilitada.";
      break;
    case "auth/user-not-found":
      errorMessage += "No se encontró la cuenta asociada.";
      break;
    default:
      errorMessage += `${error.message} Código: ${error.code || "desconocido"}`;
  }

  showMessage(errorMessage, "error");
  if (instructionsSection) instructionsSection.classList.add("hidden");
}

// Función para mostrar botones de acción
function showActionButtons(showResend = false) {
  if (actionButtons) {
    actionButtons.classList.add("hidden");
  }
}

// Función principal para procesar la verificación
async function processEmailVerification() {
  const { mode, actionCode } = getUrlParameters();

  // Si no hay parámetros, mostrar instrucciones
  if (!mode && !actionCode) {
    if (loadingSpinner) loadingSpinner.style.display = "none";

    // Verificar si el usuario está logueado y necesita verificación
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        if (userEmailSpan) userEmailSpan.textContent = user.email;
        if (emailDisplay) emailDisplay.classList.remove("hidden");

        if (user.emailVerified) {
          handleSuccessfulVerification(user.email);
        } else {
          showMessage(
            "Sigue las instrucciones para verificar tu email.",
            "info"
          );
          // NUEVA: Iniciar verificación en tiempo real
          startRealtimeVerificationCheck();
        }
      } else {
        showMessage(
          "No hay usuario activo. Ve al registro para crear una cuenta.",
          "info"
        );
      }
    });
    return;
  }

  // Verificar que es una operación de verificación de email
  if (mode !== "verifyEmail") {
    showMessage("Esta página es solo para verificación de email.", "error");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 3000);
    return;
  }

  currentActionCode = actionCode;
  currentMode = mode;

  try {
    // Verificar el código primero
    const actionInfo = await verifyActionCode(actionCode);

    // Mostrar email que se está verificando
    if (actionInfo && actionInfo.data && actionInfo.data.email) {
      if (userEmailSpan) userEmailSpan.textContent = actionInfo.data.email;
      if (emailDisplay) emailDisplay.classList.remove("hidden");
    }

    // Aplicar la verificación
    await applyEmailVerification(actionCode);

    // Obtener email del código de acción para mostrar
    const email = actionInfo?.data?.email || "tu email";
    handleSuccessfulVerification(email);
  } catch (error) {
    handleError(error, actionCode);
  }
}

// Event Listeners con verificación de existencia
document.addEventListener("DOMContentLoaded", () => {
  console.log("Página de verificación de email cargada");

  // NUEVA: Implementar medidas de seguridad
  implementSecurityMeasures();

  // Agregar event listeners solo si los elementos existen
  if (gotoLoginBtn) {
    gotoLoginBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

  // Procesar verificación
  processEmailVerification();
});

// Prevenir pérdida de datos
window.addEventListener("beforeunload", (e) => {
  if (!verificationProcessed && currentActionCode) {
    e.preventDefault();
    e.returnValue =
      "¿Estás seguro de que quieres salir? El proceso de verificación no se ha completado.";
  }
});

// MODIFICADO: Monitorear cambios de autenticación con verificación en tiempo real
onAuthStateChanged(auth, (user) => {
  if (user && !currentUser) {
    currentUser = user;
    if (!userEmailSpan?.textContent) {
      if (userEmailSpan) userEmailSpan.textContent = user.email;
      if (emailDisplay) emailDisplay.classList.remove("hidden");
    }

    // Si no hay parámetros de URL, iniciar verificación en tiempo real
    const { mode, actionCode } = getUrlParameters();
    if (!mode && !actionCode && !user.emailVerified) {
      startRealtimeVerificationCheck();
    }
  }
});

// Manejar errores globales
window.addEventListener("error", (e) => {
  console.error("Error global:", e.error);
  showMessage("Ha ocurrido un error inesperado. Recarga la página.", "error");
});

// MODIFICADO: Función para limpiar datos sensibles al salir
window.addEventListener("unload", () => {
  currentActionCode = null;
  currentUser = null;
});
