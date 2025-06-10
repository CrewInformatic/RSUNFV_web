// Esta página captura los parámetros de Firebase y redirige según el tipo de operación
function processFirebaseAction() {
  console.log("Procesando parámetros de Firebase...");

  // Obtener parámetros de la URL actual
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const oobCode = urlParams.get("oobCode");
  const continueUrl = urlParams.get("continueUrl");

  console.log("Parámetros detectados:", {
    mode,
    oobCode: oobCode ? "presente" : "ausente",
  });

  // Verificar que tenemos los parámetros necesarios
  if (!mode || !oobCode) {
    showError(
      "Parámetros no válidos. Por favor, usa el enlace del correo electrónico."
    );
    return;
  }

  // Procesar según el tipo de operación
  switch (mode) {
    case "resetPassword":
      handlePasswordReset(mode, oobCode);
      break;

    case "verifyEmail":
      handleEmailVerification(mode, oobCode);
      break;

    default:
      showError(`Tipo de operación no soportada: ${mode}`);
      break;
  }
}

function handlePasswordReset(mode, oobCode) {
  // Actualizar UI para restablecimiento de contraseña
  document.getElementById("title").innerHTML =
    "🔑 UNFV - Restablecimiento de Contraseña";
  document.getElementById("message").textContent =
    "Procesando tu solicitud de restablecimiento...";

  // Construir la URL de destino
  const targetUrl = `confirm-password-reset.html?mode=${mode}&oobCode=${oobCode}`;

  console.log("Redirigiendo a restablecimiento:", targetUrl);

  // Redirigir después de un breve delay
  setTimeout(() => {
    window.location.href = targetUrl;
  }, 1500);
}

function handleEmailVerification(mode, oobCode) {
  // Actualizar UI para verificación de email
  document.getElementById("title").innerHTML =
    "📧 UNFV - Verificación de Email";
  document.getElementById("message").textContent =
    "Procesando verificación de tu correo electrónico...";

  // Construir la URL de destino
  const targetUrl = `emailVerification.html?mode=${mode}&oobCode=${oobCode}`;

  console.log("Redirigiendo a verificación de email:", targetUrl);

  // Redirigir después de un breve delay
  setTimeout(() => {
    window.location.href = targetUrl;
  }, 1500);
}

function showError(message) {
  const errorDiv = document.getElementById("error-message");
  const errorText = document.getElementById("error-text");

  errorText.textContent = message;
  errorDiv.style.display = "block";

  // Ocultar spinner
  document.querySelector(".spinner").style.display = "none";

  // Redirigir a página principal después de 5 segundos
  setTimeout(() => {
    window.location.href = "index.html";
  }, 5000);
}

// Ejecutar cuando se carga la página
document.addEventListener("DOMContentLoaded", processFirebaseAction);
