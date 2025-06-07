// Importar desde tu archivo de configuración
import {
  auth,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "./firebase_config.js";

// Variables globales
let currentStep = 1;

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

  // Ocultar mensaje después de 5 segundos
  setTimeout(() => {
    errorDiv.style.display = "none";
    successDiv.style.display = "none";
  }, 5000);
}

// Función para cambiar entre pasos
function goToStep(step) {
  console.log(`Cambiando al paso: ${step}`);

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

  if (step <= 3) {
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
      targetStep.classList.add("active");
    }
  }

  // Ocultar mensajes al cambiar de paso
  document.getElementById("error-message").style.display = "none";
  document.getElementById("success-message").style.display = "none";

  currentStep = step;
}

// Función para enviar email de recuperación
async function sendRecoveryEmail(event) {
  event.preventDefault();
  console.log("Iniciando proceso de recuperación...");

  const emailInput = document.getElementById("recovery-email");
  const sendBtn = document.getElementById("send-btn");
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

  // Cambiar botón a estado de carga
  const originalText = sendBtn.textContent;
  sendBtn.innerHTML = '<span class="loading"></span> Enviando...';
  sendBtn.disabled = true;

  try {
    // Configuración para el email de recuperación
    const actionCodeSettings = {
      url:
        window.location.origin +
        window.location.pathname +
        "?mode=resetPassword",
      handleCodeInApp: false,
    };

    await sendPasswordResetEmail(auth, email, actionCodeSettings);
    console.log("Email de recuperación enviado exitosamente");

    // Mostrar email en el paso 2
    document.getElementById("sent-email").textContent = email;

    // Ir al paso 2
    goToStep(2);
    showMessage("Email de recuperación enviado correctamente");
  } catch (error) {
    console.error("Error al enviar email:", error);

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
      default:
        errorMessage += "Por favor, intenta nuevamente.";
    }

    showMessage(errorMessage, true);
  } finally {
    // Restaurar botón
    sendBtn.textContent = originalText;
    sendBtn.disabled = false;
  }
}

// Función para cambiar contraseña
async function changePassword(event) {
  event.preventDefault();
  console.log("Iniciando cambio de contraseña...");

  const email = document.getElementById("confirm-email").value.trim();
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const changeBtn = document.getElementById("change-btn");

  if (!email || !newPassword || !confirmPassword) {
    showMessage("Por favor completa todos los campos", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("Las contraseñas no coinciden", true);
    return;
  }

  if (newPassword.length < 6) {
    showMessage("La contraseña debe tener al menos 6 caracteres", true);
    return;
  }

  // Obtener código de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const actionCode = urlParams.get("oobCode");

  if (!actionCode) {
    showMessage(
      "Código de verificación no válido. Por favor, usa el enlace del correo electrónico.",
      true
    );
    return;
  }

  // Cambiar botón a estado de carga
  const originalText = changeBtn.textContent;
  changeBtn.innerHTML = '<span class="loading"></span> Cambiando...';
  changeBtn.disabled = true;

  try {
    // Verificar el código primero
    await verifyPasswordResetCode(auth, actionCode);
    console.log("Código verificado correctamente");

    // Confirmar el cambio de contraseña
    await confirmPasswordReset(auth, actionCode, newPassword);
    console.log("Contraseña cambiada exitosamente");

    // Ir al paso 4 (éxito)
    goToStep(4);
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);

    let errorMessage = "Error al cambiar la contraseña. ";
    switch (error.code) {
      case "auth/expired-action-code":
        errorMessage +=
          "El enlace ha expirado. Solicita un nuevo enlace de recuperación.";
        break;
      case "auth/invalid-action-code":
        errorMessage +=
          "El enlace no es válido. Solicita un nuevo enlace de recuperación.";
        break;
      case "auth/weak-password":
        errorMessage +=
          "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
        break;
      default:
        errorMessage += "Por favor, intenta nuevamente.";
    }

    showMessage(errorMessage, true);
  } finally {
    // Restaurar botón
    changeBtn.textContent = originalText;
    changeBtn.disabled = false;
  }
}

// Función para manejar la URL
function handleUrlAction() {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const actionCode = urlParams.get("oobCode");

  console.log("Parámetros URL:", {
    mode,
    actionCode: actionCode ? "Presente" : "Ausente",
  });

  if (mode === "resetPassword" && actionCode) {
    console.log("Enlace de recuperación detectado, yendo al paso 3");
    goToStep(3);
  }
}

// Event listeners
document
  .getElementById("recovery-form")
  .addEventListener("submit", sendRecoveryEmail);
document
  .getElementById("password-form")
  .addEventListener("submit", changePassword);

// Exponer funciones globalmente
window.goToStep = goToStep;

// Inicializar cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  console.log("Página de recuperación cargada");
  handleUrlAction();
});
