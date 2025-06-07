// verify-email.js - Sistema de verificación de email con Firebase - Tiempos Optimizados
import {
  auth,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
} from "./firebase_config.js";

// =============================================
// VARIABLES GLOBALES
// =============================================
let currentUser = null;
let verificationCheckInterval = null;
let countdownInterval = null;
let resendCountdown = 120; // 2 minutos = 120 segundos
let isVerified = false;

// =============================================
// FUNCIONES DE INTERFAZ
// =============================================

// Función para mostrar mensaje de estado
function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  statusElement.textContent = message;
  statusElement.className = `status-message status-${type}`;
  statusElement.style.display = "block";

  // Ocultar después de 5 segundos para mensajes no críticos
  if (type !== "error") {
    setTimeout(() => {
      statusElement.style.display = "none";
    }, 5000);
  }
}

// Función para mostrar overlay de carga
function showLoadingOverlay(show = true) {
  const overlay = document.getElementById("verificationOverlay");
  overlay.className = show
    ? "verification-overlay show"
    : "verification-overlay";
}

// Función para actualizar la interfaz con datos del usuario
function updateUserInterface(user) {
  if (user) {
    document.getElementById("userEmail").textContent = user.email;

    // Obtener nombre desde localStorage o URL params
    const urlParams = new URLSearchParams(window.location.search);
    const userName =
      urlParams.get("name") ||
      localStorage.getItem("verificationUserName") ||
      "Usuario";
    document.title = `Verificar Email - ${userName}`;

    console.log("🔧 Interfaz actualizada para:", user.email);
  }
}

// =============================================
// FUNCIONES DE VERIFICACIÓN
// =============================================

// Función principal para verificar el estado del email
async function checkEmailVerification(silent = false) {
  if (!currentUser) {
    console.error("❌ No hay usuario autenticado");
    return false;
  }

  if (!silent) {
    showLoadingOverlay(true);
    document.getElementById("loadingSpinner").style.display = "block";
  }

  try {
    console.log("🔍 Verificando estado del email...");

    // Recargar datos del usuario desde Firebase
    await currentUser.reload();

    // Verificar si el email está verificado
    const emailVerified = currentUser.emailVerified;

    console.log("📧 Estado de verificación:", emailVerified);

    if (emailVerified && !isVerified) {
      await handleVerificationSuccess();
      return true;
    } else if (!silent && !emailVerified) {
      showStatus(
        "Email aún no verificado. Revisa tu bandeja de entrada y spam.",
        "info"
      );
    }

    return emailVerified;
  } catch (error) {
    console.error("❌ Error al verificar email:", error);
    if (!silent) {
      showStatus("Error al verificar el email. Intenta nuevamente.", "error");
    }
    return false;
  } finally {
    if (!silent) {
      showLoadingOverlay(false);
      document.getElementById("loadingSpinner").style.display = "none";
    }
  }
}

// Función cuando la verificación es exitosa
async function handleVerificationSuccess() {
  if (isVerified) return; // Evitar múltiples ejecuciones

  isVerified = true;
  console.log("✅ Email verificado exitosamente!");

  // Detener verificaciones automáticas
  if (verificationCheckInterval) {
    clearInterval(verificationCheckInterval);
    verificationCheckInterval = null;
  }

  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Mostrar mensaje de éxito
  document.getElementById("verificationCheck").classList.add("show");
  showStatus("¡Email verificado exitosamente!", "success");

  // Ocultar botones de verificación
  document.getElementById("checkVerificationBtn").style.display = "none";
  document.getElementById("resendEmailBtn").style.display = "none";
  document.querySelector(".resend-info").style.display = "none";

  // Limpiar localStorage
  localStorage.removeItem("verificationEmail");
  localStorage.removeItem("verificationUserName");
  localStorage.removeItem("verificationUID");
  localStorage.removeItem("registrationCompleted");

  // Permitir navegación hacia atrás
  window.onpopstate = null;

  // Redireccionar después de 3 segundos
  let redirectCountdown = 3;
  const redirectTimer = setInterval(() => {
    showStatus(
      `Redirigiendo al login en ${redirectCountdown} segundos...`,
      "success"
    );
    redirectCountdown--;

    if (redirectCountdown < 0) {
      clearInterval(redirectTimer);
      window.location.href = "/public/login.html";
    }
  }, 1000);
}

// Función para reenviar email de verificación
async function resendVerificationEmail() {
  if (!currentUser) {
    showStatus("Error: No hay usuario autenticado", "error");
    return;
  }

  const resendBtn = document.getElementById("resendEmailBtn");
  resendBtn.disabled = true;

  showLoadingOverlay(true);

  try {
    console.log("📧 Reenviando email de verificación...");

    await sendEmailVerification(currentUser, {
      url: window.location.origin + "/public/login.html",
      handleCodeInApp: false,
    });

    showStatus("Email de verificación reenviado exitosamente", "success");

    // Reiniciar countdown a 2 minutos
    resendCountdown = 120;
    document.querySelector(".resend-info").style.display = "block";
    startResendCountdown();
  } catch (error) {
    console.error("❌ Error al reenviar email:", error);

    let errorMessage = "Error al reenviar el email. Intenta nuevamente.";

    switch (error.code) {
      case "auth/too-many-requests":
        errorMessage =
          "Demasiados intentos. Espera 2 minutos antes de intentar nuevamente.";
        break;
      case "auth/network-request-failed":
        errorMessage = "Error de conexión. Verifica tu conexión a internet.";
        break;
    }

    showStatus(errorMessage, "error");
    resendBtn.disabled = false;
  } finally {
    showLoadingOverlay(false);
  }
}

// =============================================
// FUNCIONES DE COUNTDOWN Y TIMERS
// =============================================

// Función para iniciar countdown de reenvío (2 minutos)
function startResendCountdown() {
  const countdownElement = document.getElementById("countdown");
  const resendBtn = document.getElementById("resendEmailBtn");

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    resendCountdown--;

    // Mostrar tiempo en formato MM:SS
    const minutes = Math.floor(resendCountdown / 60);
    const seconds = resendCountdown % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    countdownElement.textContent = formattedTime;

    if (resendCountdown <= 0) {
      clearInterval(countdownInterval);
      resendBtn.disabled = false;
      document.querySelector(".resend-info").style.display = "none";
    }
  }, 1000);
}

// Función para verificación automática cada 8 minutos
function startAutoVerificationCheck() {
  if (verificationCheckInterval) {
    clearInterval(verificationCheckInterval);
  }

  // Verificación inicial inmediata
  setTimeout(() => {
    if (!isVerified) {
      checkEmailVerification(true);
    }
  }, 3000); // Verificar después de 3 segundos

  // Luego verificar cada 8 minutos (480000 ms)
  verificationCheckInterval = setInterval(async () => {
    if (!isVerified) {
      console.log("🔄 Verificación automática (cada 8 minutos)");
      await checkEmailVerification(true);
    }
  }, 480000); // 8 minutos = 480000 milisegundos
}

// =============================================
// FUNCIONES DE NAVEGACIÓN Y SEGURIDAD
// =============================================

// Función para prevenir navegación hacia atrás
function preventBackNavigation() {
  history.pushState(null, null, location.href);
  window.onpopstate = function () {
    if (!isVerified) {
      history.go(1);
      showStatus("Debes verificar tu email antes de continuar", "info");
    }
  };
}

// Función para cerrar sesión (en caso de emergencia)
async function emergencySignOut() {
  try {
    await signOut(auth);
    console.log("🚪 Sesión cerrada por emergencia");
    window.location.href = "/public/login.html";
  } catch (error) {
    console.error("❌ Error al cerrar sesión:", error);
  }
}

// =============================================
// FUNCIONES DE INICIALIZACIÓN
// =============================================

// Función para inicializar la página
function initializeVerificationPage() {
  console.log("🔧 Inicializando página de verificación...");

  // Verificar autenticación del usuario
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("👤 Usuario autenticado:", user.email);
      currentUser = user;

      // Actualizar interfaz
      updateUserInterface(user);

      // Verificar inmediatamente si ya está verificado
      const alreadyVerified = await checkEmailVerification(true);

      if (alreadyVerified) {
        await handleVerificationSuccess();
        return;
      }

      // Iniciar procesos automáticos
      startResendCountdown();
      startAutoVerificationCheck();

      // Mostrar mensaje informativo sobre los tiempos
      showStatus(
        "Verificación automática cada 8 minutos. Puedes verificar manualmente cuando quieras.",
        "info"
      );
    } else {
      console.log("❌ No hay usuario autenticado, redirigiendo...");
      // Si no hay usuario autenticado, redireccionar al registro
      window.location.href = "/public/register.html";
    }
  });

  // Bloquear navegación hacia atrás
  preventBackNavigation();

  console.log("✅ Página de verificación inicializada");
}

// =============================================
// EVENT LISTENERS Y FUNCIONES GLOBALES
// =============================================

// Hacer funciones disponibles globalmente
window.checkEmailVerification = () => checkEmailVerification(false);
window.resendVerificationEmail = resendVerificationEmail;
window.emergencySignOut = emergencySignOut;

// Función para manejar visibilidad de la página
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && currentUser && !isVerified) {
    // Cuando el usuario regresa a la página, verificar después de 2 segundos
    setTimeout(() => {
      checkEmailVerification(true);
    }, 2000);
  }
});

// Prevenir clic derecho y atajos de teclado (opcional, para mayor seguridad)
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

document.addEventListener("keydown", function (e) {
  // Bloquear F12, Ctrl+Shift+I, Ctrl+U, etc.
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && e.key === "I") ||
    (e.ctrlKey && e.key === "u")
  ) {
    e.preventDefault();
  }
});

// Inicializar cuando la página carga
document.addEventListener("DOMContentLoaded", initializeVerificationPage);

// Cleanup cuando la página se descarga
window.addEventListener("beforeunload", function () {
  if (verificationCheckInterval) {
    clearInterval(verificationCheckInterval);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

console.log(
  "📧 Sistema de verificación de email con Firebase cargado - Tiempos optimizados"
);
