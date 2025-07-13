// =============================================
// SCRIPT UNIVERSAL DE SEGURIDAD PARA ADMIN
// Archivo: admin-security.js
// =============================================

// Importar Firebase (asegúrate de que firebase_config.js esté cargado primero)
import { db } from "./firebase_config.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// CONFIGURACIÓN GLOBAL
// =============================================

const ADMIN_SECURITY_CONFIG = {
  CHECK_INTERVAL: 30000, // 30 segundos
  PAGES_TO_PROTECT: [
    "admin-dashboard.html",
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "donation-inventory.html",
    "configuracion.html",
    "reportes.html",
    "Donaciones.html",
  ],
  REDIRECT_URLS: {
    LOGIN: "index.html",
    USER_DASHBOARD: "descarga_app.html",
  },
  MAX_RETRIES: 3, // Máximo de reintentos para verificación
  RETRY_DELAY: 2000, // Delay entre reintentos
  GRACE_PERIOD: 300000, // 5 minutos de gracia para problemas de conectividad
};

// Variables globales
let permissionCheckInterval = null;
let isCheckingPermissions = false;
let currentUser = null;
let isSecurityActive = false;
let failedChecksCount = 0;
let lastSuccessfulCheck = null;

// =============================================
// GESTIÓN DE SESIÓN MEJORADA
// =============================================

function getStoredSession() {
  try {
    if (currentUser) {
      return currentUser;
    }

    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession);
      currentUser = parsedSession;
      return parsedSession;
    }

    return null;
  } catch (error) {
    console.error("Error al obtener sesión:", error);
    sessionStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    currentUser = null;
    sessionStorage.removeItem("userSession");
    clearPermissionCheck();
  } catch (error) {
    console.error("Error al limpiar sesión:", error);
  }
}

function updateStoredSession(sessionData) {
  try {
    currentUser = sessionData;
    sessionStorage.setItem("userSession", JSON.stringify(sessionData));
  } catch (error) {
    console.error("Error al actualizar sesión:", error);
  }
}

// =============================================
// VERIFICACIÓN DE PERMISOS MEJORADA
// =============================================

async function checkAdminPermissions() {
  if (isCheckingPermissions) {
    return;
  }

  isCheckingPermissions = true;

  try {
    const session = getStoredSession();

    if (!session) {
      handleNoSession();
      return;
    }

    // Verificar si es admin desde la sesión primero
    if (!session.esAdmin) {
      handlePermissionRevoked();
      return;
    }

    // Verificar permisos en la base de datos con reintentos
    const verificationResult = await verifyAdminStatusWithRetries(session);

    if (verificationResult.success) {
      // Verificación exitosa
      failedChecksCount = 0;
      lastSuccessfulCheck = Date.now();

      if (verificationResult.isAdmin) {
        // Actualizar sesión con datos más recientes
        await updateSessionWithLatestUserData(session);
        // Actualizar UI si es necesario
        updateUserInterface(session);
      } else {
        // Realmente no es admin
        handlePermissionRevoked();
        return;
      }
    } else {
      // Error en la verificación
      handleVerificationError(verificationResult.error);
    }
  } catch (error) {
    console.error("Error general al verificar permisos:", error);
    handleVerificationError(error);
  } finally {
    isCheckingPermissions = false;
  }
}

async function verifyAdminStatusWithRetries(session) {
  let retries = 0;
  let lastError = null;

  while (retries < ADMIN_SECURITY_CONFIG.MAX_RETRIES) {
    try {
      const isAdmin = await verifyAdminStatusInDatabase(session);
      return { success: true, isAdmin };
    } catch (error) {
      lastError = error;
      retries++;

      if (retries < ADMIN_SECURITY_CONFIG.MAX_RETRIES) {
        console.warn(
          `Intento ${retries} fallido, reintentando en ${ADMIN_SECURITY_CONFIG.RETRY_DELAY}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, ADMIN_SECURITY_CONFIG.RETRY_DELAY)
        );
      }
    }
  }

  return { success: false, error: lastError };
}

async function verifyAdminStatusInDatabase(session) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", session.correo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn("Usuario no encontrado en la base de datos");
      return false;
    }

    let isStillAdmin = false;
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      // Verificar explícitamente que esAdmin sea true
      if (userData.esAdmin === true) {
        isStillAdmin = true;
      }
    });

    return isStillAdmin;
  } catch (error) {
    console.error("Error al verificar estado de admin:", error);
    throw error;
  }
}

async function updateSessionWithLatestUserData(currentSession) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", currentSession.correo));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        const userData = doc.data();

        const updatedSession = {
          ...currentSession,
          esAdmin: userData.esAdmin,
          nombreUsuario: userData.nombreUsuario || currentSession.nombreUsuario,
          loginTime: currentSession.loginTime,
          lastPermissionCheck: Date.now(),
        };

        updateStoredSession(updatedSession);
      });
    }
  } catch (error) {
    console.error("Error al actualizar datos de sesión:", error);
    // No es crítico, continuar sin actualizar
  }
}

// =============================================
// MANEJO DE SITUACIONES DE SEGURIDAD MEJORADO
// =============================================

function handleNoSession() {
  clearPermissionCheck();
  showSecurityAlert(
    "⚠️ SESIÓN EXPIRADA",
    "Tu sesión ha expirado. Serás redirigido al login."
  );
  setTimeout(() => {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
  }, 2000);
}

function handlePermissionRevoked() {
  clearPermissionCheck();
  clearSession();
  showSecurityAlert(
    "🚫 ACCESO DENEGADO",
    "Tus permisos de administrador han sido revocados.\nSerás redirigido automáticamente."
  );
  setTimeout(() => {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.USER_DASHBOARD;
  }, 3000);
}

function handleVerificationError(error) {
  failedChecksCount++;

  // Si hemos fallado muchas veces seguidas, verificar período de gracia
  if (failedChecksCount >= ADMIN_SECURITY_CONFIG.MAX_RETRIES) {
    const timeSinceLastSuccess = lastSuccessfulCheck
      ? Date.now() - lastSuccessfulCheck
      : Infinity;

    if (timeSinceLastSuccess > ADMIN_SECURITY_CONFIG.GRACE_PERIOD) {
      console.error(
        "Se ha excedido el período de gracia para errores de conexión"
      );
      handleNoSession();
      return;
    }
  }

  console.warn(
    `Error en verificación (${failedChecksCount}/${ADMIN_SECURITY_CONFIG.MAX_RETRIES}):`,
    error
  );

  showToastNotification(
    `Error de conexión al verificar permisos (${failedChecksCount}/${ADMIN_SECURITY_CONFIG.MAX_RETRIES})`,
    "warning"
  );

  // Reintentar después de un tiempo más largo
  setTimeout(() => {
    if (isSecurityActive) {
      checkAdminPermissions();
    }
  }, ADMIN_SECURITY_CONFIG.RETRY_DELAY * 2);
}

// =============================================
// INTERFAZ DE USUARIO Y NOTIFICACIONES
// =============================================

function showSecurityAlert(title, message) {
  // Crear modal de seguridad si no existe
  let securityModal = document.getElementById("securityModal");
  if (!securityModal) {
    securityModal = createSecurityModal();
    document.body.appendChild(securityModal);
  }

  // Actualizar contenido
  document.getElementById("securityModalTitle").textContent = title;
  document.getElementById("securityModalMessage").textContent = message;

  // Mostrar modal
  if (window.bootstrap) {
    const modal = new bootstrap.Modal(securityModal, {
      backdrop: "static",
      keyboard: false,
    });
    modal.show();
  } else {
    // Fallback sin Bootstrap
    alert(title + "\n\n" + message);
  }
}

function createSecurityModal() {
  const modalHTML = `
    <div class="modal fade" id="securityModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-danger">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title" id="securityModalTitle">Alerta de Seguridad</h5>
          </div>
          <div class="modal-body text-center">
            <div class="mb-3">
              <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
            </div>
            <p id="securityModalMessage" class="fs-5"></p>
            <div class="spinner-border text-danger mt-3" role="status">
              <span class="visually-hidden">Redirigiendo...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = modalHTML;
  return tempDiv.firstElementChild;
}

function showToastNotification(message, type = "info") {
  let toastContainer = document.getElementById("adminSecurityToastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "adminSecurityToastContainer";
    toastContainer.className = "toast-container position-fixed top-0 end-0 p-3";
    toastContainer.style.zIndex = "9999";
    document.body.appendChild(toastContainer);
  }

  const toastId = "security-toast-" + Date.now();
  const bgClass = type === "warning" ? "bg-warning" : "bg-info";
  const textClass = type === "warning" ? "text-dark" : "text-white";

  const toastHTML = `
    <div id="${toastId}" class="toast ${bgClass} ${textClass}" role="alert">
      <div class="toast-header ${bgClass} ${textClass} border-0">
        <i class="fas fa-shield-alt me-2"></i>
        <strong class="me-auto">Seguridad</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML("beforeend", toastHTML);

  const toastElement = document.getElementById(toastId);
  if (toastElement && window.bootstrap) {
    const toast = new bootstrap.Toast(toastElement, {
      autohide: true,
      delay: 4000,
    });
    toast.show();

    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement.remove();
    });
  }
}

function updateUserInterface(session) {
  // Actualizar nombre de usuario en la interfaz
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombreUsuario || session.correo;
  }

  // Actualizar mensajes de bienvenida
  const welcomeElements = document.querySelectorAll(
    ".welcome-section h2, .welcome-message"
  );
  welcomeElements.forEach((element) => {
    if (element.textContent.includes("¡Bienvenido")) {
      element.textContent = `¡Bienvenido${
        session.nombreUsuario ? ", " + session.nombreUsuario : ""
      }!`;
    }
  });
}

// =============================================
// CONTROL DEL SISTEMA DE SEGURIDAD
// =============================================

function startAdminSecurity() {
  if (isSecurityActive) {
    return;
  }

  const session = getStoredSession();
  if (!session) {
    handleNoSession();
    return;
  }

  if (!session.esAdmin) {
    handlePermissionRevoked();
    return;
  }

  isSecurityActive = true;
  failedChecksCount = 0;
  lastSuccessfulCheck = Date.now();

  // Verificar inmediatamente
  checkAdminPermissions();

  // Configurar verificación periódica
  permissionCheckInterval = setInterval(
    checkAdminPermissions,
    ADMIN_SECURITY_CONFIG.CHECK_INTERVAL
  );

  console.log("🔐 Sistema de seguridad de administrador iniciado");
  showToastNotification("Sistema de seguridad activado", "info");
}

function clearPermissionCheck() {
  if (permissionCheckInterval) {
    clearInterval(permissionCheckInterval);
    permissionCheckInterval = null;
  }
  isSecurityActive = false;
  failedChecksCount = 0;
}

function restartAdminSecurity() {
  clearPermissionCheck();
  setTimeout(startAdminSecurity, 1000);
}

// =============================================
// DETECCIÓN AUTOMÁTICA DE PÁGINAS
// =============================================

function shouldProtectCurrentPage() {
  const currentPage = window.location.pathname.split("/").pop();
  return ADMIN_SECURITY_CONFIG.PAGES_TO_PROTECT.includes(currentPage);
}

function initializeAdminSecurity() {
  // Solo activar en páginas de administración
  if (!shouldProtectCurrentPage()) {
    console.log("📄 Página no requiere protección de admin");
    return;
  }

  // Verificar que Firebase esté disponible
  if (typeof db === "undefined") {
    console.error(
      "❌ Firebase no está disponible. Asegúrate de cargar firebase_config.js primero"
    );
    return;
  }

  // Iniciar sistema de seguridad
  startAdminSecurity();
}

// =============================================
// EVENTOS Y LISTENERS
// =============================================

// Verificar cuando la página vuelve a estar visible
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && isSecurityActive) {
    // Evitar verificación inmediata si ya estamos verificando
    if (!isCheckingPermissions) {
      setTimeout(checkAdminPermissions, 1000);
    }
  }
});

// Verificar cuando la ventana vuelve a tener foco
window.addEventListener("focus", function () {
  if (isSecurityActive && !isCheckingPermissions) {
    setTimeout(checkAdminPermissions, 1000);
  }
});

// Limpiar al salir
window.addEventListener("beforeunload", function () {
  clearPermissionCheck();
});

// =============================================
// FUNCIONES GLOBALES EXPORTADAS
// =============================================

// Funciones principales
window.startAdminSecurity = startAdminSecurity;
window.clearPermissionCheck = clearPermissionCheck;
window.restartAdminSecurity = restartAdminSecurity;
window.checkAdminPermissions = checkAdminPermissions;

// Funciones de sesión mejoradas
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.updateStoredSession = updateStoredSession;

// Funciones de utilidad
window.forceSecurityCheck = function () {
  if (isSecurityActive) {
    checkAdminPermissions();
  } else {
    startAdminSecurity();
  }
};

window.getSecurityStatus = function () {
  return {
    isActive: isSecurityActive,
    isChecking: isCheckingPermissions,
    currentUser: currentUser ? currentUser.correo : null,
    lastCheck: currentUser ? currentUser.lastPermissionCheck : null,
    failedChecks: failedChecksCount,
    lastSuccessfulCheck: lastSuccessfulCheck,
  };
};

// =============================================
// INICIALIZACIÓN AUTOMÁTICA
// =============================================

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAdminSecurity);
} else {
  initializeAdminSecurity();
}

// Mensaje de carga
console.log("🛡️ Script universal de seguridad para administradores cargado");

// =============================================
// FUNCIONES DE NAVEGACIÓN SEGURA MEJORADAS
// =============================================

window.navigateToPage = function (pageName) {
  const session = getStoredSession();
  if (!session) {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
    return;
  }

  if (
    ADMIN_SECURITY_CONFIG.PAGES_TO_PROTECT.includes(pageName) &&
    !session.esAdmin
  ) {
    alert("No tienes permisos para acceder a esta página");
    return;
  }

  // Limpiar el sistema de seguridad antes de navegar
  clearPermissionCheck();
  window.location.href = pageName;
};

window.showProfile = function () {
  const session = getStoredSession();
  if (session) {
    const securityStatus = window.getSecurityStatus();
    alert(
      `Perfil de Usuario:\n\nUsuario: ${session.nombreUsuario}\nCorreo: ${
        session.correo
      }\nRol: ${
        session.esAdmin ? "Administrador" : "Usuario"
      }\nÚltimo acceso: ${new Date(
        session.loginTime
      ).toLocaleString()}\n\nEstado de Seguridad:\nActivo: ${
        securityStatus.isActive ? "Sí" : "No"
      }\nVerificaciones fallidas: ${securityStatus.failedChecks}`
    );
  }
};

window.handleLogout = function () {
  const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (confirmed) {
    clearSession();
    alert("Sesión cerrada exitosamente");
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
  }
};
