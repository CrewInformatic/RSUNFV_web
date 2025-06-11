// emailVerification.js - Sistema de verificación de email con Firebase - MEJORADO
import {
  auth,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  applyActionCode,
} from "./firebase_config.js";

// =============================================
// VARIABLES GLOBALES
// =============================================
let currentUser = null;
let verificationCheckInterval = null;
let countdownInterval = null;
let redirectCountdownInterval = null;
let resendCountdown = 120; // 2 minutos = 120 segundos
let isVerified = false;
let urlParams = null;

// =============================================
// FUNCIONES DE INTERFAZ
// =============================================

// Función para mostrar mensaje de estado
function showStatus(message, type) {
  const statusElement = document.getElementById("statusMessage");
  if (statusElement) {
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
}

// Función para mostrar overlay de carga
function showLoadingOverlay(show = true) {
  const overlay = document.getElementById("verificationOverlay");
  if (overlay) {
    overlay.className = show
      ? "verification-overlay show"
      : "verification-overlay";
  }
}

// NUEVA FUNCIÓN: Mostrar modal de cuenta ya verificada
function showAccountVerifiedModal() {
  // Crear el modal si no existe
  let modal = document.getElementById("accountVerifiedModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "accountVerifiedModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="verification-icon">✅</div>
          <h2>¡Cuenta Verificada!</h2>
        </div>
        <div class="modal-body">
          <p>Tu cuenta ya está verificada y lista para usar.</p>
          <p>Puedes cerrar este mensaje y continuar.</p>
        </div>
        <div class="modal-footer">
          <button id="closeVerifiedModal" class="btn-primary">Entendido</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.head.appendChild(style);

    // Event listener para cerrar el modal
    document
      .getElementById("closeVerifiedModal")
      .addEventListener("click", () => {
        closeAccountVerifiedModal();
      });

    // Cerrar modal al hacer clic fuera de él
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeAccountVerifiedModal();
      }
    });
  }

  // Mostrar el modal
  modal.classList.add("show");
}

// Función para cerrar el modal de cuenta verificada y iniciar redirección
function closeAccountVerifiedModal() {
  const modal = document.getElementById("accountVerifiedModal");
  if (modal) {
    modal.classList.remove("show");
    // Asegurar que se oculta completamente después de la transición
    setTimeout(() => {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  // Iniciar redirección después de cerrar el modal
  startRedirectCountdown();
}

// NUEVA FUNCIÓN: Mostrar mensaje de redirección en la pantalla principal
function startRedirectCountdown() {
  let redirectTime = 8;

  // Crear o actualizar elemento de redirección
  let redirectElement = document.getElementById("redirectMessage");
  if (!redirectElement) {
    redirectElement = document.createElement("div");
    redirectElement.id = "redirectMessage";
    redirectElement.className = "redirect-message";

    // Insertar después del elemento de estado o al final del contenedor principal
    const statusElement = document.getElementById("statusMessage");
    const container = statusElement ? statusElement.parentNode : document.body;

    if (statusElement && statusElement.nextSibling) {
      container.insertBefore(redirectElement, statusElement.nextSibling);
    } else {
      container.appendChild(redirectElement);
    }
  }

  // Función para actualizar el mensaje
  function updateRedirectMessage() {
    redirectElement.innerHTML = `
      ✅ Verificación completada exitosamente<br>
      Serás redirigido al login en <span class="redirect-countdown">${redirectTime}</span> segundos
    `;
  }

  // Mostrar mensaje inicial
  updateRedirectMessage();
  redirectElement.style.display = "block";

  // Iniciar countdown
  redirectCountdownInterval = setInterval(() => {
    redirectTime--;
    updateRedirectMessage();

    if (redirectTime <= 0) {
      clearInterval(redirectCountdownInterval);
      redirectElement.innerHTML = "🔄 Redirigiendo...";

      // Redireccionar después de un breve delay
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    }
  }, 1000);
}

// Función para actualizar la interfaz con datos del usuario
function updateUserInterface(user) {
  if (user) {
    const emailElement = document.getElementById("userEmail");
    if (emailElement) {
      emailElement.textContent = user.email;
    }

    // Obtener nombre desde localStorage o URL params
    const userName =
      urlParams?.get("name") ||
      localStorage.getItem("verificationUserName") ||
      "Usuario";
    document.title = `Verificar Email - ${userName}`;

    console.log("🔧 Interfaz actualizada para:", user.email);
  }
}

// NUEVA FUNCIÓN: Mostrar estado verificado en la interfaz
function showVerifiedState() {
  // Mostrar elemento de verificación exitosa
  const verificationCheck = document.getElementById("verificationCheck");
  if (verificationCheck) {
    verificationCheck.classList.add("show");
  }

  // Ocultar botones de verificación
  const checkBtn = document.getElementById("checkVerificationBtn");
  const resendBtn = document.getElementById("resendEmailBtn");
  const resendInfo = document.querySelector(".resend-info");

  if (checkBtn) checkBtn.style.display = "none";
  if (resendBtn) resendBtn.style.display = "none";
  if (resendInfo) resendInfo.style.display = "none";

  // Mostrar mensaje de estado verificado
  showStatus("¡Tu cuenta está verificada y lista para usar!", "success");

  // Actualizar cualquier texto en la página
  const statusTexts = document.querySelectorAll(".verification-status-text");
  statusTexts.forEach((element) => {
    element.textContent = "✅ Cuenta verificada exitosamente";
  });
}

// =============================================
// FUNCIONES DE VERIFICACIÓN CON CÓDIGO
// =============================================

// NUEVA FUNCIÓN: Procesar código de verificación desde URL
async function processVerificationFromURL() {
  const mode = urlParams?.get("mode");
  const oobCode = urlParams?.get("oobCode");

  console.log("🔍 Verificando parámetros URL:", {
    mode,
    oobCode: oobCode ? "presente" : "ausente",
  });

  if (mode === "verifyEmail" && oobCode) {
    console.log("📧 Procesando código de verificación desde URL...");
    showStatus("Procesando verificación de email...", "info");
    showLoadingOverlay(true);

    try {
      // Aplicar el código de verificación directamente
      await applyActionCode(auth, oobCode);
      console.log("✅ Código de verificación aplicado exitosamente");

      // Recargar el usuario para obtener el estado actualizado
      if (currentUser) {
        await currentUser.reload();

        if (currentUser.emailVerified) {
          // IMPORTANTE: Ocultar overlay de carga ANTES de manejar el éxito
          showLoadingOverlay(false);
          await handleVerificationSuccess();
          return true;
        }
      }

      showStatus("Verificación procesada. Verificando estado...", "success");
      showLoadingOverlay(false);
      return true;
    } catch (error) {
      console.error("❌ Error al aplicar código de verificación:", error);

      let errorMessage = "Error al procesar la verificación.";
      switch (error.code) {
        case "auth/invalid-action-code":
          errorMessage =
            "El enlace de verificación ha expirado o ya fue usado.";
          break;
        case "auth/expired-action-code":
          errorMessage =
            "El enlace de verificación ha expirado. Solicita uno nuevo.";
          break;
        case "auth/user-disabled":
          errorMessage = "Esta cuenta ha sido deshabilitada.";
          break;
        case "auth/user-not-found":
          errorMessage = "Usuario no encontrado. Verifica tu cuenta.";
          break;
      }

      showStatus(errorMessage, "error");
      showLoadingOverlay(false);
      return false;
    }
  }

  return false;
}

// Función principal para verificar el estado del email
async function checkEmailVerification(silent = false) {
  if (!currentUser) {
    console.error("❌ No hay usuario autenticado");
    return false;
  }

  if (!silent) {
    showLoadingOverlay(true);
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) spinner.style.display = "block";
  }

  try {
    console.log("🔍 Verificando estado del email...");

    // Recargar datos del usuario desde Firebase
    await currentUser.reload();

    // Verificar si el email está verificado
    const emailVerified = currentUser.emailVerified;

    console.log("📧 Estado de verificación:", emailVerified);

    if (emailVerified && !isVerified) {
      // IMPORTANTE: Ocultar overlay ANTES de manejar el éxito
      if (!silent) {
        showLoadingOverlay(false);
        const spinner = document.getElementById("loadingSpinner");
        if (spinner) spinner.style.display = "none";
      }
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
      const spinner = document.getElementById("loadingSpinner");
      if (spinner) spinner.style.display = "none";
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

  // Asegurar que el overlay de carga esté oculto
  showLoadingOverlay(false);

  // Mostrar estado verificado en la interfaz
  showVerifiedState();

  // Iniciar redirección automática después de 2 segundos
  setTimeout(() => {
    startRedirectCountdown();
  }, 2000);

  // Limpiar localStorage
  localStorage.removeItem("verificationEmail");
  localStorage.removeItem("verificationUserName");
  localStorage.removeItem("verificationUID");
  localStorage.removeItem("registrationCompleted");

  // Permitir navegación hacia atrás
  window.onpopstate = null;

  // Limpiar parámetros de la URL para evitar re-procesamiento
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

// NUEVA FUNCIÓN: Manejar cuando la cuenta ya está verificada desde el inicio
function handleAlreadyVerified() {
  console.log("✅ Cuenta ya estaba verificada");

  isVerified = true;

  // Asegurar que el overlay de carga esté oculto
  showLoadingOverlay(false);

  // Mostrar modal informativo
  setTimeout(() => {
    showAccountVerifiedModal();
  }, 500);

  // Mostrar estado verificado en la interfaz
  showVerifiedState();

  // Limpiar localStorage
  localStorage.removeItem("verificationEmail");
  localStorage.removeItem("verificationUserName");
  localStorage.removeItem("verificationUID");
  localStorage.removeItem("registrationCompleted");

  // Permitir navegación hacia atrás
  window.onpopstate = null;
}

// Función para reenviar email de verificación
async function resendVerificationEmail() {
  if (!currentUser) {
    showStatus("Error: No hay usuario autenticado", "error");
    return;
  }

  const resendBtn = document.getElementById("resendEmailBtn");
  if (resendBtn) resendBtn.disabled = true;

  showLoadingOverlay(true);

  try {
    console.log("📧 Reenviando email de verificación...");

    await sendEmailVerification(currentUser, {
      url: window.location.origin + "/firebase-redirect.html",
      handleCodeInApp: false,
    });

    showStatus("Email de verificación reenviado exitosamente", "success");

    // Reiniciar countdown a 2 minutos
    resendCountdown = 120;
    const resendInfo = document.querySelector(".resend-info");
    if (resendInfo) resendInfo.style.display = "block";
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
    if (resendBtn) resendBtn.disabled = false;
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

    if (countdownElement) {
      countdownElement.textContent = formattedTime;
    }

    if (resendCountdown <= 0) {
      clearInterval(countdownInterval);
      if (resendBtn) resendBtn.disabled = false;
      const resendInfo = document.querySelector(".resend-info");
      if (resendInfo) resendInfo.style.display = "none";
    }
  }, 1000);
}

// Función para verificación automática cada 8 minutos
function startAutoVerificationCheck() {
  if (verificationCheckInterval) {
    clearInterval(verificationCheckInterval);
  }

  // Verificación inicial después de 3 segundos (solo si no hay código en URL)
  if (!urlParams?.get("oobCode")) {
    setTimeout(() => {
      if (!isVerified) {
        checkEmailVerification(true);
      }
    }, 3000);
  }

  // Luego verificar cada 8 minutos
  verificationCheckInterval = setInterval(async () => {
    if (!isVerified) {
      console.log("🔄 Verificación automática (cada 8 minutos)");
      await checkEmailVerification(true);
    }
  }, 480000); // 8 minutos
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
    window.location.href = "login.html";
  } catch (error) {
    console.error("❌ Error al cerrar sesión:", error);
  }
}

// =============================================
// FUNCIONES DE INICIALIZACIÓN
// =============================================

// FUNCIÓN PRINCIPAL DE INICIALIZACIÓN - MEJORADA
async function initializeVerificationPage() {
  console.log("🔧 Inicializando página de verificación...");

  // Capturar parámetros de URL al inicio
  urlParams = new URLSearchParams(window.location.search);
  console.log("🔍 Parámetros URL detectados:", Array.from(urlParams.entries()));

  // Verificar autenticación del usuario
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("👤 Usuario autenticado:", user.email);
      currentUser = user;

      // Actualizar interfaz
      updateUserInterface(user);

      // PRIMERO: Procesar código de verificación si existe en URL
      const processedFromURL = await processVerificationFromURL();

      if (!processedFromURL) {
        // Si no había código en URL, verificar estado actual
        const alreadyVerified = await checkEmailVerification(true);

        if (alreadyVerified) {
          // NUEVA LÓGICA: Si ya está verificado, mostrar modal y estado
          handleAlreadyVerified();
          return;
        }

        // Iniciar procesos automáticos solo si no está verificado
        startResendCountdown();
        startAutoVerificationCheck();

        showStatus(
          "Verificación automática cada 8 minutos. Puedes verificar manualmente cuando quieras.",
          "info"
        );
      }
    } else {
      console.log("❌ No hay usuario autenticado, redirigiendo...");
      window.location.href = "register.html";
    }
  });

  // Bloquear navegación hacia atrás solo si no está verificado
  if (!isVerified) {
    preventBackNavigation();
  }

  console.log("✅ Página de verificación inicializada");
}

// =============================================
// EVENT LISTENERS Y FUNCIONES GLOBALES
// =============================================

// Hacer funciones disponibles globalmente
window.checkEmailVerification = () => checkEmailVerification(false);
window.resendVerificationEmail = resendVerificationEmail;
window.emergencySignOut = emergencySignOut;
window.closeAccountVerifiedModal = closeAccountVerifiedModal;

// Función para manejar visibilidad de la página
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && currentUser && !isVerified) {
    // Cuando el usuario regresa a la página, verificar después de 2 segundos
    setTimeout(() => {
      checkEmailVerification(true);
    }, 2000);
  }
});

// Prevenir clic derecho y atajos de teclado (opcional)
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

document.addEventListener("keydown", function (e) {
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
  if (redirectCountdownInterval) {
    clearInterval(redirectCountdownInterval);
  }
});

console.log("📧 Sistema de verificación de email");
