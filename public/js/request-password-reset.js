// Importar desde tu archivo de configuración
import { auth, sendPasswordResetEmail } from "./firebase_config.js";

// Variables globales
let currentStep = 1;
let lastEmailSent = null;
let resendTimer = null;
let resendCountdown = 120; // 2 minutos en segundos
let emailSentTime = null;

// Función para mostrar mensajes
function showMessage(message, isError = false) {
  const errorDiv = document.getElementById("error-message");
  const successDiv = document.getElementById("success-message");

  if (isError) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    successDiv.style.display = "none";
  } else {
    successDiv.textContent = message;
    successDiv.style.display = "block";
    errorDiv.style.display = "none";
  }

  // Ocultar mensaje después de 8 segundos
  setTimeout(() => {
    errorDiv.style.display = "none";
    successDiv.style.display = "none";
  }, 8000);
}

// Función para formatear tiempo
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Función para iniciar countdown de reenvío
function startResendCountdown() {
  const resendBtn = document.getElementById("resend-btn");
  const resendText = document.getElementById("resend-text");

  resendCountdown = 120; // Resetear a 2 minutos
  resendBtn.disabled = true;
  resendBtn.classList.add("disabled");

  resendTimer = setInterval(() => {
    resendCountdown--;
    resendText.textContent = `Podrás reenviar el correo en ${formatTime(
      resendCountdown
    )}`;

    if (resendCountdown <= 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
      resendBtn.classList.remove("disabled");
      resendText.textContent = "¿No recibiste el correo?";
    }
  }, 1000);
}

// Función para cambiar entre pasos
function goToStep(step) {
  // Solo permitir pasos 1 y 2
  if (step > 2) {
    return;
  }

  // Ocultar contenido actual
  document.querySelectorAll(".step-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.querySelectorAll(".step").forEach((stepEl) => {
    stepEl.classList.remove("active");
  });

  // Mostrar nuevo contenido
  const targetContent = document.getElementById(`content-step${step}`);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  const targetStep = document.getElementById(`step${step}`);
  if (targetStep) {
    targetStep.classList.add("active");
  }

  // Ocultar mensajes al cambiar de paso
  document.getElementById("error-message").style.display = "none";
  document.getElementById("success-message").style.display = "none";

  currentStep = step;

  // Si volvemos al paso 1, limpiar el timer
  if (step === 1 && resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
}

// Función para validar si se puede reenviar
function canResendEmail() {
  if (!emailSentTime) return true;

  const currentTime = new Date().getTime();
  const timeDifference = currentTime - emailSentTime;
  const twoMinutesInMs = 2 * 60 * 1000; // 2 minutos en milisegundos

  return timeDifference >= twoMinutesInMs;
}

// Función para enviar email de recuperación
async function sendRecoveryEmail(event, isResend = false) {
  event.preventDefault();

  const emailInput = document.getElementById("recovery-email");
  const sendBtn = document.getElementById("send-btn");
  const resendBtn = document.getElementById("resend-btn");
  const email = emailInput.value.trim();

  if (!email) {
    showMessage("Por favor ingresa un correo electrónico", true);
    return;
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showMessage("Por favor ingresa un correo electrónico válido", true);
    return;
  }

  // Validar límite de reenvío si es un reenvío
  if (isResend && !canResendEmail()) {
    showMessage("Debes esperar 2 minutos antes de reenviar el correo", true);
    return;
  }

  // Evitar spam - máximo 3 emails por hora al mismo correo
  const emailAttempts = JSON.parse(
    localStorage.getItem("emailAttempts") || "{}"
  );
  const currentTime = new Date().getTime();
  const oneHourInMs = 60 * 60 * 1000;

  if (emailAttempts[email]) {
    const attempts = emailAttempts[email].filter(
      (time) => currentTime - time < oneHourInMs
    );
    if (attempts.length >= 3) {
      showMessage(
        "Has alcanzado el límite de 3 intentos por hora para este correo",
        true
      );
      return;
    }
  }

  // Cambiar botón a estado de carga
  const currentBtn = isResend ? resendBtn : sendBtn;
  const originalText = currentBtn.textContent;
  currentBtn.innerHTML = '<span class="loading"></span> Enviando...';
  currentBtn.disabled = true;

  try {
    // Configuración para el email de recuperación
    const actionCodeSettings = {
      url: window.location.origin + "/login.html", // Redirige al login después del reset
      handleCodeInApp: false,
    };

    await sendPasswordResetEmail(auth, email, actionCodeSettings);

    // Registrar intento exitoso
    if (!emailAttempts[email]) {
      emailAttempts[email] = [];
    }
    emailAttempts[email].push(currentTime);
    localStorage.setItem("emailAttempts", JSON.stringify(emailAttempts));

    // Actualizar variables de control
    lastEmailSent = email;
    emailSentTime = currentTime;

    // Mostrar email en el paso 2
    document.getElementById("sent-email").textContent = email;

    // Ir al paso 2 solo si no es reenvío
    if (!isResend) {
      goToStep(2);
    }

    // Iniciar countdown de reenvío
    startResendCountdown();

    showMessage(
      isResend
        ? "Email reenviado correctamente"
        : "Email de recuperación enviado correctamente"
    );
  } catch (error) {
    let errorMessage = "Error al enviar el email. ";
    switch (error.code) {
      case "auth/user-not-found":
        errorMessage +=
          "No se encontró una cuenta con este correo electrónico.";
        break;
      case "auth/invalid-email":
        errorMessage += "El correo electrónico no es válido.";
        break;
      case "auth/too-many-requests":
        errorMessage += "Demasiados intentos. Intenta más tarde.";
        break;
      case "auth/network-request-failed":
        errorMessage += "Error de conexión. Verifica tu conexión a internet.";
        break;
      default:
        errorMessage += "Por favor, intenta nuevamente.";
    }

    showMessage(errorMessage, true);
  } finally {
    // Restaurar botón
    currentBtn.textContent = originalText;
    currentBtn.disabled = false;
  }
}

// Función para reenviar email
async function resendEmail(event) {
  await sendRecoveryEmail(event, true);
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  // Agregar event listeners
  const recoveryForm = document.getElementById("recovery-form");
  if (recoveryForm) {
    recoveryForm.addEventListener("submit", sendRecoveryEmail);
  }

  // Event listener para el botón de reenvío (se agregará cuando se cree el HTML)
  const resendBtn = document.getElementById("resend-btn");
  if (resendBtn) {
    resendBtn.addEventListener("click", resendEmail);
  }

  // Limpiar intentos antiguos al cargar la página
  const emailAttempts = JSON.parse(
    localStorage.getItem("emailAttempts") || "{}"
  );
  const currentTime = new Date().getTime();
  const oneHourInMs = 60 * 60 * 1000;

  Object.keys(emailAttempts).forEach((email) => {
    emailAttempts[email] = emailAttempts[email].filter(
      (time) => currentTime - time < oneHourInMs
    );
    if (emailAttempts[email].length === 0) {
      delete emailAttempts[email];
    }
  });

  localStorage.setItem("emailAttempts", JSON.stringify(emailAttempts));
});

// Exponer funciones globalmente
window.goToStep = goToStep;
window.sendRecoveryEmail = sendRecoveryEmail;
window.resendEmail = resendEmail;

// Limpiar timer cuando se cierre la página
window.addEventListener("beforeunload", () => {
  if (resendTimer) {
    clearInterval(resendTimer);
  }
});
