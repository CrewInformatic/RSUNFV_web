// Importar Firebase (asegúrate de que firebase_config.js esté cargado primero)
import { db } from "./firebase_config.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =============================================
// CONFIGURACIÓN GLOBAL
// =============================================

const ADMIN_SECURITY_CONFIG = {
  CHECK_INTERVAL: 30000, // 30 segundos
  SESSION_CHECK_INTERVAL: 60000, // 1 minuto para verificar sesión única
  PAGES_TO_PROTECT: [
    "admin-dashboard.html",
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "donation-inventory.html",
    "configuracion.html",
    "reportes.html",
    "configuracion.html",
    "Donaciones.html",
  ],
  // Configuración de permisos por rol
  ROLE_PERMISSIONS: {
    // Páginas que requieren rol_004 específicamente
    ROLE_004_PAGES: [
      "Donaciones.html",
      "donation-inventory.html",
      "configuracion.html",
      "admin-dashboard.html",
    ],
    // Páginas que pueden acceder usuarios con rol_004 sin ser admin
    ROLE_004_ALLOWED: [
      "Donaciones.html",
      "donation-inventory.html",
      "configuracion.html",
      "admin-dashboard.html",
    ],
    // Páginas que solo pueden acceder admins
    ADMIN_ONLY_PAGES: [
      "eventos.html",
      "administradores.html",
      "usuarios.html",
      "reportes.html",
    ],
  },
  REDIRECT_URLS: {
    LOGIN: "index.html",
    USER_DASHBOARD: "descarga_app.html",
    ACCESS_DENIED: "descarga_app.html",
  },
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  GRACE_PERIOD: 300000, // 5 minutos
  SESSION_TIMEOUT: 3600000, // 1 hora
  DEVICE_FINGERPRINT_KEYS: [
    "userAgent",
    "language",
    "platform",
    "screenResolution",
    "timezone",
    "colorDepth",
  ],
};

// Variables globales
let permissionCheckInterval = null;
let sessionCheckInterval = null;
let isCheckingPermissions = false;
let currentUser = null;
let isSecurityActive = false;
let failedChecksCount = 0;
let lastSuccessfulCheck = null;
let deviceFingerprint = null;
let sessionId = null;

// =============================================
// GENERACIÓN DE HUELLA DIGITAL DEL DISPOSITIVO
// =============================================

function generateDeviceFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "14px Arial";
  ctx.fillText("Device fingerprint", 2, 2);

  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorDepth: screen.colorDepth,
    canvasFingerprint: canvas.toDataURL(),
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    timestamp: Date.now(),
  };

  const fingerprintString = JSON.stringify(fingerprint);
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return {
    hash: hash.toString(16),
    details: fingerprint,
  };
}

function generateSessionId() {
  return (
    "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  );
}

// =============================================
// GESTIÓN DE SESIÓN ÚNICA
// =============================================

async function createUserSession(userData) {
  try {
    if (!deviceFingerprint) {
      deviceFingerprint = generateDeviceFingerprint();
    }

    sessionId = generateSessionId();

    const sessionData = {
      ...userData,
      sessionId: sessionId,
      deviceFingerprint: deviceFingerprint.hash,
      deviceDetails: deviceFingerprint.details,
      loginTime: Date.now(),
      lastActivity: Date.now(),
      ipAddress: await getUserIP(),
      isActive: true,
    };

    await addDoc(collection(db, "user_sessions"), {
      userId: userData.correo,
      sessionId: sessionId,
      deviceFingerprint: deviceFingerprint.hash,
      deviceDetails: deviceFingerprint.details,
      loginTime: serverTimestamp(),
      lastActivity: serverTimestamp(),
      ipAddress: sessionData.ipAddress,
      isActive: true,
      userAgent: navigator.userAgent,
    });

    await updateUserActiveSession(userData.correo, sessionId);
    updateStoredSession(sessionData);
    return sessionData;
  } catch (error) {
    // Silencioso en producción
  }
}

async function updateUserActiveSession(userEmail, sessionId) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", userEmail));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "usuarios", docSnap.id), {
          activeSessionId: sessionId,
          lastLogin: serverTimestamp(),
        });
      });
    }
  } catch (error) {
    // Silencioso en producción
  }
}

async function checkUniqueSession() {
  try {
    const session = getStoredSession();
    if (!session) return false;

    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", session.correo));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      let isCurrentSessionValid = false;

      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        if (userData.activeSessionId === session.sessionId) {
          isCurrentSessionValid = true;
        }
      });

      if (!isCurrentSessionValid) {
        handleSessionConflict();
        return false;
      }
    }

    await updateSessionActivity(session.sessionId);
    return true;
  } catch (error) {
    return false;
  }
}

async function updateSessionActivity(sessionId) {
  try {
    if (!sessionId) {
      return;
    }

    const sessionsRef = collection(db, "user_sessions");
    const q = query(sessionsRef, where("sessionId", "==", sessionId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "user_sessions", docSnap.id), {
          lastActivity: serverTimestamp(),
        });
      });
    }
  } catch (error) {
    // Silencioso en producción
  }
}

async function getUserIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return "unknown";
  }
}

function handleSessionConflict() {
  clearPermissionCheck();
  clearSession();
  showSecurityAlert(
    "🚫 SESIÓN DUPLICADA DETECTADA",
    "Se ha detectado que tu cuenta está siendo usada en otro dispositivo.\nPor seguridad, esta sesión será terminada."
  );

  logSecurityEvent("SESSION_CONFLICT", {
    message: "Sesión duplicada detectada",
    timestamp: Date.now(),
  });

  setTimeout(() => {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
  }, 4000);
}

function getStoredSession() {
  try {
    if (currentUser) {
      return currentUser;
    }

    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession);

      if (
        parsedSession.loginTime &&
        Date.now() - parsedSession.loginTime >
          ADMIN_SECURITY_CONFIG.SESSION_TIMEOUT
      ) {
        clearSession();
        return null;
      }

      currentUser = parsedSession;
      return parsedSession;
    }

    return null;
  } catch (error) {
    sessionStorage.removeItem("userSession");
    return null;
  }
}

async function clearSession() {
  try {
    const session = getStoredSession();
    if (session && session.sessionId) {
      await deactivateSession(session.sessionId);
    }

    currentUser = null;
    sessionStorage.removeItem("userSession");
    clearPermissionCheck();
    clearSessionCheck();
  } catch (error) {
    // Silencioso en producción
  }
}

async function deactivateSession(sessionId) {
  try {
    const sessionsRef = collection(db, "user_sessions");
    const q = query(sessionsRef, where("sessionId", "==", sessionId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      querySnapshot.forEach(async (docSnap) => {
        await updateDoc(doc(db, "user_sessions", docSnap.id), {
          isActive: false,
          logoutTime: serverTimestamp(),
        });
      });
    }
  } catch (error) {
    // Silencioso en producción
  }
}

function updateStoredSession(sessionData) {
  try {
    currentUser = sessionData;
    sessionStorage.setItem("userSession", JSON.stringify(sessionData));
  } catch (error) {
    // Silencioso en producción
  }
}

// =============================================
// VERIFICACIÓN DE PERMISOS
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

    const isUniqueSession = await checkUniqueSession();
    if (!isUniqueSession) {
      return;
    }

    const currentPage = getCurrentPageName();
    const pagePermissions = checkPagePermissions(session, currentPage);

    if (!pagePermissions.hasAccess) {
      handleAccessDenied(pagePermissions.reason, pagePermissions.allowedPages);
      return;
    }

    const verificationResult = await verifyUserStatusWithRetries(session);

    if (verificationResult.success) {
      failedChecksCount = 0;
      lastSuccessfulCheck = Date.now();

      const updatedPagePermissions = checkPagePermissions(
        verificationResult.userData,
        currentPage
      );
      if (!updatedPagePermissions.hasAccess) {
        handleAccessDenied(
          updatedPagePermissions.reason,
          updatedPagePermissions.allowedPages
        );
        return;
      }

      await updateSessionWithLatestUserData(session);
      updateUserInterface(session);
    } else {
      handleVerificationError(verificationResult.error);
    }
  } catch (error) {
    handleVerificationError(error);
  } finally {
    isCheckingPermissions = false;
  }
}

async function verifyUserStatusWithRetries(session) {
  let retries = 0;
  let lastError = null;

  while (retries < ADMIN_SECURITY_CONFIG.MAX_RETRIES) {
    try {
      const userData = await verifyUserStatusInDatabase(session);
      return { success: true, userData };
    } catch (error) {
      lastError = error;
      retries++;

      if (retries < ADMIN_SECURITY_CONFIG.MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, ADMIN_SECURITY_CONFIG.RETRY_DELAY)
        );
      }
    }
  }

  return { success: false, error: lastError };
}

async function verifyUserStatusInDatabase(session) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", session.correo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("Usuario no encontrado");
    }

    let userData = null;
    querySnapshot.forEach((doc) => {
      userData = doc.data();
    });

    return userData;
  } catch (error) {
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
          idRol: userData.idRol || currentSession.idRol,
          nombreUsuario: userData.nombreUsuario || currentSession.nombreUsuario,
          celular: userData.celular || currentSession.celular,
          fotoPerfil: userData.fotoPerfil || currentSession.fotoPerfil,
          loginTime: currentSession.loginTime,
          lastPermissionCheck: Date.now(),
          lastActivity: Date.now(),
        };

        updateStoredSession(updatedSession);
      });
    }
  } catch (error) {
    // Silencioso en producción
  }
}

// =============================================
// SISTEMA DE LOGS DE SEGURIDAD
// =============================================

async function logSecurityEvent(eventType, details) {
  try {
    const session = getStoredSession();
    await addDoc(collection(db, "security_logs"), {
      eventType: eventType,
      userId: session ? session.correo : "unknown",
      sessionId: session ? session.sessionId : "unknown",
      timestamp: serverTimestamp(),
      details: details,
      userAgent: navigator.userAgent,
      ipAddress: await getUserIP(),
    });
  } catch (error) {
    // Silencioso en producción
  }
}

// =============================================
// MANEJO DE SITUACIONES DE SEGURIDAD
// =============================================

function handleNoSession() {
  clearPermissionCheck();
  clearSessionCheck();
  showSecurityAlert(
    "⚠️ SESIÓN EXPIRADA",
    "Tu sesión ha expirado. Serás redirigido al login."
  );

  logSecurityEvent("SESSION_EXPIRED", {
    message: "Sesión expirada o no válida",
    timestamp: Date.now(),
  });

  setTimeout(() => {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
  }, 2000);
}

function handlePermissionRevoked() {
  clearPermissionCheck();
  clearSessionCheck();
  clearSession();
  showSecurityAlert(
    "🚫 ACCESO DENEGADO",
    "Tus permisos de administrador han sido revocados.\nSerás redirigido automáticamente."
  );

  logSecurityEvent("PERMISSION_REVOKED", {
    message: "Permisos de administrador revocados",
    timestamp: Date.now(),
  });

  setTimeout(() => {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.USER_DASHBOARD;
  }, 3000);
}

function handleVerificationError(error) {
  failedChecksCount++;

  if (failedChecksCount >= ADMIN_SECURITY_CONFIG.MAX_RETRIES) {
    const timeSinceLastSuccess = lastSuccessfulCheck
      ? Date.now() - lastSuccessfulCheck
      : Infinity;

    if (timeSinceLastSuccess > ADMIN_SECURITY_CONFIG.GRACE_PERIOD) {
      handleNoSession();
      return;
    }
  }

  showToastNotification(
    `Error de conexión al verificar permisos (${failedChecksCount}/${ADMIN_SECURITY_CONFIG.MAX_RETRIES})`,
    "warning"
  );

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
  let securityModal = document.getElementById("securityModal");
  if (!securityModal) {
    securityModal = createSecurityModal();
    document.body.appendChild(securityModal);
  }

  document.getElementById("securityModalTitle").textContent = title;
  document.getElementById("securityModalMessage").textContent = message;

  if (window.bootstrap) {
    const modal = new bootstrap.Modal(securityModal, {
      backdrop: "static",
      keyboard: false,
    });
    modal.show();
  } else {
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

function createProfileModal() {
  const modalHTML = `
    <div class="modal fade" id="profileModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="fas fa-user-circle me-2"></i>
              Perfil de Usuario
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="text-center mb-4">
              <div class="profile-avatar-container position-relative d-inline-block">
                <img id="profileAvatar" src="" alt="Foto de perfil" 
                     class="rounded-circle border border-3 border-primary"
                     style="width: 80px; height: 80px; object-fit: cover;"
                     onerror="this.style.display='none'; document.getElementById('profileAvatarFallback').style.display='flex';">
                <div id="profileAvatarFallback" class="bg-primary rounded-circle d-none align-items-center justify-content-center position-absolute top-0 start-0" 
                     style="width: 80px; height: 80px;">
                  <i class="fas fa-user fa-2x text-white"></i>
                </div>
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label text-muted small">NOMBRE</label>
                  <div class="fw-bold" id="profileName">-</div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label text-muted small">CORREO</label>
                  <div class="fw-bold" id="profileEmail">-</div>
                </div>
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label text-muted small">ROL</label>
                  <div id="profileRole">
                    <span class="badge bg-success">
                      <i class="fas fa-shield-alt me-1"></i>
                      Administrador
                    </span>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label text-muted small">TELÉFONO</label>
                  <div class="fw-bold" id="profilePhone">-</div>
                </div>
              </div>
            </div>
            
            <hr class="my-4">
            
            <div class="row">
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label text-muted small">ÚLTIMO ACCESO</label>
                  <div class="fw-bold" id="profileLastLogin">-</div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="mb-3">
                  <label class="form-label text-muted small">ESTADO DE SESIÓN</label>
                  <div id="profileSessionStatus">
                    <span class="badge bg-success">
                      <i class="fas fa-circle me-1"></i>
                      Activa
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-1"></i>
              Cerrar
            </button>
            <button type="button" class="btn btn-danger" id="logoutFromProfileBtn">
              <i class="fas fa-sign-out-alt me-1"></i>
              Cerrar Sesión
            </button>
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
  const bgClass =
    type === "warning"
      ? "bg-warning"
      : type === "danger"
      ? "bg-danger"
      : "bg-info";
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
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombreUsuario || session.correo;
  }

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

  const currentPage = getCurrentPageName();
  const pagePermissions = checkPagePermissions(session, currentPage);

  if (!pagePermissions.hasAccess) {
    handleAccessDenied(pagePermissions.reason, pagePermissions.allowedPages);
    return;
  }

  if (!session.esAdmin && session.idRol !== "rol_004") {
    handlePermissionRevoked();
    return;
  }

  isSecurityActive = true;
  failedChecksCount = 0;
  lastSuccessfulCheck = Date.now();

  checkAdminPermissions();

  permissionCheckInterval = setInterval(
    checkAdminPermissions,
    ADMIN_SECURITY_CONFIG.CHECK_INTERVAL
  );

  sessionCheckInterval = setInterval(
    checkUniqueSession,
    ADMIN_SECURITY_CONFIG.SESSION_CHECK_INTERVAL
  );
}

function clearPermissionCheck() {
  if (permissionCheckInterval) {
    clearInterval(permissionCheckInterval);
    permissionCheckInterval = null;
  }
}

function clearSessionCheck() {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }
}

function stopAdminSecurity() {
  clearPermissionCheck();
  clearSessionCheck();
  isSecurityActive = false;
  failedChecksCount = 0;
}

function restartAdminSecurity() {
  stopAdminSecurity();
  setTimeout(startAdminSecurity, 1000);
}

// =============================================
// SISTEMA DE VALIDACIÓN DE PERMISOS POR ROLES
// =============================================

function checkPagePermissions(session, currentPage) {
  if (session.esAdmin) {
    return { hasAccess: true, reason: "Usuario administrador" };
  }

  if (!session.esAdmin && session.idRol === "rol_004") {
    if (
      ADMIN_SECURITY_CONFIG.ROLE_PERMISSIONS.ROLE_004_ALLOWED.includes(
        currentPage
      )
    ) {
      return { hasAccess: true, reason: "Usuario con acceso a inventario" };
    } else {
      return {
        hasAccess: false,
        reason:
          "Este rol solo tiene acceso a inventario, donaciones, dashboard y configuración",
        allowedPages: ADMIN_SECURITY_CONFIG.ROLE_PERMISSIONS.ROLE_004_ALLOWED,
      };
    }
  }

  return {
    hasAccess: false,
    reason: "Sin permisos de administrador",
  };
}

function shouldProtectCurrentPage() {
  const currentPage = window.location.pathname.split("/").pop();
  return ADMIN_SECURITY_CONFIG.PAGES_TO_PROTECT.includes(currentPage);
}

function getCurrentPageName() {
  return window.location.pathname.split("/").pop();
}

function handleAccessDenied(reason, allowedPages = null) {
  let message = reason;

  if (allowedPages && allowedPages.length > 0) {
    message += `\n\nPáginas disponibles: ${allowedPages.join(", ")}`;
  }

  clearPermissionCheck();
  clearSessionCheck();

  showSecurityAlert("⚠️ ACCESO RESTRINGIDO", message);

  logSecurityEvent("ACCESS_DENIED", {
    message: reason,
    page: getCurrentPageName(),
    timestamp: Date.now(),
  });

  setTimeout(() => {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.ACCESS_DENIED;
  }, 4000);
}

function initializeAdminSecurity() {
  if (!shouldProtectCurrentPage()) {
    return;
  }

  if (typeof db === "undefined") {
    return;
  }

  deviceFingerprint = generateDeviceFingerprint();
  startAdminSecurity();
}

// =============================================
// EVENTOS Y LISTENERS
// =============================================

document.addEventListener("visibilitychange", function () {
  if (!document.hidden && isSecurityActive) {
    if (!isCheckingPermissions) {
      setTimeout(checkAdminPermissions, 1000);
    }
  }
});

window.addEventListener("focus", function () {
  if (isSecurityActive && !isCheckingPermissions) {
    setTimeout(checkAdminPermissions, 1000);
  }
});

window.addEventListener("beforeunload", function () {
  stopAdminSecurity();
});

// =============================================
// FUNCIONES GLOBALES EXPORTADAS
// =============================================

window.startAdminSecurity = startAdminSecurity;
window.stopAdminSecurity = stopAdminSecurity;
window.restartAdminSecurity = restartAdminSecurity;
window.checkAdminPermissions = checkAdminPermissions;

// Funciones de sesión
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.updateStoredSession = updateStoredSession;
window.createUserSession = createUserSession;

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
    sessionId: currentUser ? currentUser.sessionId : null,
    deviceFingerprint: deviceFingerprint ? deviceFingerprint.hash : null,
    lastCheck: currentUser ? currentUser.lastPermissionCheck : null,
    failedChecks: failedChecksCount,
    lastSuccessfulCheck: lastSuccessfulCheck,
  };
};

// =============================================
// FUNCIONES DE PERFIL
// =============================================

window.showProfile = function () {
  const session = getStoredSession();
  if (!session) {
    showToastNotification("No hay sesión activa", "warning");
    return;
  }

  let profileModal = document.getElementById("profileModal");
  if (!profileModal) {
    profileModal = createProfileModal();
    document.body.appendChild(profileModal);

    const logoutBtn = document.getElementById("logoutFromProfileBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        const modalInstance = bootstrap.Modal.getInstance(profileModal);
        if (modalInstance) {
          modalInstance.hide();
        }

        setTimeout(() => {
          window.handleLogout();
        }, 300);
      });
    }
  }

  updateProfileModalData(session);

  if (window.bootstrap) {
    const modal = new bootstrap.Modal(profileModal);
    modal.show();
  } else {
    showProfileAlert(session);
  }
};

function updateProfileModalData(session) {
  const securityStatus = window.getSecurityStatus();

  document.getElementById("profileName").textContent =
    session.nombreUsuario || "No especificado";
  document.getElementById("profileEmail").textContent = session.correo;
  document.getElementById("profilePhone").textContent =
    session.celular || "No especificado";

  const profileAvatar = document.getElementById("profileAvatar");
  const profileAvatarFallback = document.getElementById(
    "profileAvatarFallback"
  );

  if (session.fotoPerfil && session.fotoPerfil.trim() !== "") {
    profileAvatar.src = session.fotoPerfil;
    profileAvatar.style.display = "block";
    profileAvatarFallback.style.display = "none";
  } else {
    profileAvatar.style.display = "none";
    profileAvatarFallback.style.display = "flex";
  }

  const roleElement = document.getElementById("profileRole");
  if (session.esAdmin) {
    roleElement.innerHTML = `
      <span class="badge bg-success">
        <i class="fas fa-shield-alt me-1"></i>
        Administrador
      </span>
    `;
  } else {
    roleElement.innerHTML = `
      <span class="badge bg-secondary">
        <i class="fas fa-user me-1"></i>
        Usuario
      </span>
    `;
  }

  if (session.loginTime) {
    const lastLogin = new Date(session.loginTime);
    const formattedDate = lastLogin.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const formattedTime = lastLogin.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    document.getElementById(
      "profileLastLogin"
    ).textContent = `${formattedDate}, ${formattedTime}`;
  }

  const sessionStatusElement = document.getElementById("profileSessionStatus");
  if (securityStatus.isActive) {
    sessionStatusElement.innerHTML = `
      <span class="badge bg-success">
        <i class="fas fa-circle me-1"></i>
        Activa
      </span>
    `;
  } else {
    sessionStatusElement.innerHTML = `
      <span class="badge bg-warning">
        <i class="fas fa-exclamation-circle me-1"></i>
        Inactiva
      </span>
    `;
  }
}

function showProfileAlert(session) {
  const securityStatus = window.getSecurityStatus();
  const lastLogin = session.loginTime
    ? new Date(session.loginTime).toLocaleString()
    : "No disponible";

  alert(
    `PERFIL DE USUARIO\n\n` +
      `👤 Usuario: ${session.nombreUsuario || "No especificado"}\n` +
      `📧 Correo: ${session.correo}\n` +
      `📱 Teléfono: ${session.celular || "No especificado"}\n` +
      `🛡️ Rol: ${session.esAdmin ? "Administrador" : "Usuario"}\n` +
      `🕒 Último acceso: ${lastLogin}\n\n` +
      `ESTADO DE SEGURIDAD:\n` +
      `🔒 Sistema activo: ${securityStatus.isActive ? "Sí" : "No"}\n` +
      `🆔 ID de sesión: ${session.sessionId || "No disponible"}\n` +
      `❌ Verificaciones fallidas: ${securityStatus.failedChecks}`
  );
}

// =============================================
// FUNCIONES DE NAVEGACIÓN SEGURA
// =============================================

window.navigateToPage = function (pageName) {
  const session = getStoredSession();
  if (!session) {
    showToastNotification(
      "Sesión expirada. Redirigiendo al login...",
      "warning"
    );
    setTimeout(() => {
      window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
    }, 1500);
    return;
  }

  const pagePermissions = checkPagePermissions(session, pageName);

  if (!pagePermissions.hasAccess) {
    let message = `No tienes permisos para acceder a esta página.\n${pagePermissions.reason}`;

    if (
      pagePermissions.allowedPages &&
      pagePermissions.allowedPages.length > 0
    ) {
    }

    showToastNotification("Acceso denegado", "danger");

    setTimeout(() => {
      alert(message);
    }, 100);

    return;
  }

  stopAdminSecurity();

  if (session.sessionId) {
    updateSessionActivity(session.sessionId);
  }

  window.location.href = pageName;
};

window.handleLogout = function () {
  const session = getStoredSession();
  if (!session) {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
    return;
  }

  if (window.bootstrap) {
    showLogoutConfirmationModal();
  } else {
    const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
    if (confirmed) {
      performLogout();
    }
  }
};

function showLogoutConfirmationModal() {
  let logoutModal = document.getElementById("logoutConfirmationModal");
  if (!logoutModal) {
    logoutModal = createLogoutConfirmationModal();
    document.body.appendChild(logoutModal);

    const confirmBtn = document.getElementById("confirmLogoutBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        performLogout();
      });
    }
  }

  const modal = new bootstrap.Modal(logoutModal);
  modal.show();
}

function createLogoutConfirmationModal() {
  const modalHTML = `
    <div class="modal fade" id="logoutConfirmationModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-0">
            <h5 class="modal-title">
              <i class="fas fa-sign-out-alt text-warning me-2"></i>
              Confirmar Cierre de Sesión
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <div class="mb-3">
              <i class="fas fa-question-circle fa-3x text-warning"></i>
            </div>
            <h6>¿Estás seguro de que deseas cerrar sesión?</h6>
            <p class="text-muted small">Se terminará tu sesión actual y serás redirigido al login.</p>
          </div>
          <div class="modal-footer border-0 justify-content-center">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-1"></i>
              Cancelar
            </button>
            <button type="button" class="btn btn-danger" id="confirmLogoutBtn">
              <i class="fas fa-sign-out-alt me-1"></i>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = modalHTML;
  return tempDiv.firstElementChild;
}

async function performLogout() {
  try {
    const session = getStoredSession();

    const logoutModal = document.getElementById("logoutConfirmationModal");
    if (logoutModal) {
      const modalInstance = bootstrap.Modal.getInstance(logoutModal);
      if (modalInstance) {
        modalInstance.hide();
      }
    }

    if (session) {
      await logSecurityEvent("USER_LOGOUT", {
        message: "Usuario cerró sesión manualmente",
        sessionId: session.sessionId || "unknown",
        timestamp: Date.now(),
      });
    }

    showToastNotification("Cerrando sesión...", "info");
    await clearSession();

    setTimeout(() => {
      window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
    }, 1500);
  } catch (error) {
    window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
  }
}

// =============================================
// FUNCIONES DE MONITOREO DE ACTIVIDAD
// =============================================

function setupActivityMonitoring() {
  const activityEvents = [
    "mousedown",
    "mousemove",
    "keypress",
    "scroll",
    "touchstart",
  ];
  let lastActivityUpdate = Date.now();

  function updateLastActivity() {
    const now = Date.now();
    if (now - lastActivityUpdate > 30000) {
      const session = getStoredSession();
      if (session && session.sessionId) {
        updateSessionActivity(session.sessionId);
        lastActivityUpdate = now;

        session.lastActivity = now;
        updateStoredSession(session);
      }
    }
  }

  activityEvents.forEach((event) => {
    document.addEventListener(event, updateLastActivity, { passive: true });
  });
}

// =============================================
// FUNCIONES DE VERIFICACIÓN DE INTEGRIDAD
// =============================================

async function verifySessionIntegrity() {
  try {
    const session = getStoredSession();
    if (!session) return false;

    const currentFingerprint = generateDeviceFingerprint();
    if (
      session.deviceFingerprint &&
      session.deviceFingerprint !== currentFingerprint.hash
    ) {
      await logSecurityEvent("DEVICE_FINGERPRINT_CHANGED", {
        message: "Cambio en huella digital del dispositivo",
        oldFingerprint: session.deviceFingerprint,
        newFingerprint: currentFingerprint.hash,
        timestamp: Date.now(),
      });
    }

    return true;
  } catch (error) {
    return false;
  }
}

// =============================================
// INICIALIZACIÓN AUTOMÁTICA
// =============================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    initializeAdminSecurity();
    setupActivityMonitoring();
  });
} else {
  initializeAdminSecurity();
  setupActivityMonitoring();
}

setInterval(verifySessionIntegrity, 300000);

// =============================================
// FUNCIONES DE EMERGENCIA
// =============================================

window.emergencyLogout = function () {
  stopAdminSecurity();
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = ADMIN_SECURITY_CONFIG.REDIRECT_URLS.LOGIN;
};

window.getDetailedSecurityReport = function () {
  const session = getStoredSession();
  const securityStatus = window.getSecurityStatus();

  return {
    timestamp: new Date().toISOString(),
    session: session,
    securityStatus: securityStatus,
    deviceFingerprint: deviceFingerprint,
    pageProtected: shouldProtectCurrentPage(),
    intervalIds: {
      permission: permissionCheckInterval,
      sessionCheck: sessionCheckInterval,
    },
  };
};

window.checkUserPagePermissions = function (pageName) {
  const session = getStoredSession();
  if (!session) return { hasAccess: false, reason: "No hay sesión activa" };

  return checkPagePermissions(session, pageName);
};

window.getUserAvailablePages = function () {
  const session = getStoredSession();
  if (!session) return [];

  const availablePages = [];

  ADMIN_SECURITY_CONFIG.PAGES_TO_PROTECT.forEach((page) => {
    const permissions = checkPagePermissions(session, page);
    if (permissions.hasAccess) {
      availablePages.push({
        page: page,
        reason: permissions.reason,
      });
    }
  });

  return availablePages;
};

window.loginWithSecurity = async function (userData) {
  try {
    const sessionData = await createUserSession(userData);
    return sessionData;
  } catch (error) {
    throw error;
  }
};
