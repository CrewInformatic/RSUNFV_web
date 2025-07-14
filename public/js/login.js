// login.js
import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
} from "./firebase_config.js";

// Variables globales
let currentUser = null;

// Referencias a elementos del DOM
const modal = document.getElementById("messageModal");
const modalIcon = document.getElementById("modalIcon");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalBtn = document.getElementById("modalBtn");

// =============================================
// FUNCIONES DE GESTIÓN DE SESIÓN
// =============================================

function saveSession(userSession) {
  try {
    currentUser = userSession;
    sessionStorage.setItem("userSession", JSON.stringify(userSession));
  } catch (error) {}
}

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
    sessionStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    currentUser = null;
    sessionStorage.removeItem("userSession");
  } catch (error) {
    console.error("Error al limpiar sesión:", error);
  }
}

// =============================================
// FUNCIONES DE AUTO-LIMPIADO
// =============================================

function cleanFormInputs() {
  const emailInput = document.getElementById("email_login");
  const passwordInput = document.getElementById("password_login");

  if (emailInput) {
    emailInput.value = "";
  }
  if (passwordInput) {
    passwordInput.value = "";
  }
}

function resetFormStyles() {
  document.querySelectorAll(".form-input").forEach((input) => {
    if (input.parentNode) {
      input.parentNode.style.transform = "scale(1)";
      input.parentNode.style.transition = "";
    }
  });
}

function autoCleanOnLogin() {
  cleanFormInputs();
  resetFormStyles();
  closeModal();
}

// =============================================
// FUNCIONES DE VERIFICACIÓN DE PERMISOS
// =============================================

function hasAdminAccess(session) {
  return session.esAdmin === true || session.idRol === "rol_004";
}

// =============================================
// FUNCIÓN DE VERIFICACIÓN DE AUTENTICACIÓN
// =============================================

function checkAuthentication() {
  const session = getStoredSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  return session;
}

function checkAdminAuthentication() {
  const session = getStoredSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  if (!hasAdminAccess(session)) {
    alert("No tienes permisos para acceder a esta página");
    window.location.href = "descarga_app.html";
    return null;
  }

  return session;
}

// =============================================
// FUNCIONES UTILITARIAS
// =============================================

window.getCurrentSession = function () {
  return getStoredSession();
};

window.getCurrentUser = function () {
  return auth?.currentUser || null;
};

window.requireAuth = async function () {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
};

window.requireAdmin = async function () {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  if (!hasAdminAccess(session)) {
    alert("No tienes permisos de administrador");
    window.location.href = "descarga_app.html";
    return null;
  }

  return session;
};

// =============================================
// FUNCIONES DE NAVEGACIÓN
// =============================================

window.navigateToPage = function (pageName) {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  const adminPages = [
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "configuracion.html",
    "reportes.html",
  ];

  if (adminPages.includes(pageName) && !hasAdminAccess(session)) {
    alert("No tienes permisos para acceder a esta página");
    return;
  }

  window.location.href = pageName;
};

window.showProfile = function () {
  const session = getStoredSession();
  if (session) {
    const userRole = hasAdminAccess(session) ? "Administrador" : "Usuario";
    alert(
      `Perfil de Usuario:\n\nnombreUsuario: ${session.nombreUsuario}\nCorreo: ${
        session.correo
      }\nRol: ${userRole}\nÚltimo acceso: ${new Date(
        session.loginTime
      ).toLocaleString()}`
    );
  }
};

window.showSettings = function () {
  alert("Página de configuración en desarrollo");
};

window.handleLogout = function () {
  const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (confirmed) {
    clearSession();
    alert("Sesión cerrada exitosamente");
    window.location.href = "index.html";
  }
};

// =============================================
// INICIALIZACIÓN PARA PÁGINAS DE ADMIN
// =============================================

function initializeAdminPage() {
  const session = checkAdminAuthentication();
  if (!session) {
    return;
  }

  updateUserInfo(session);
  return session;
}

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombreUsuario || session.correo;
  }

  const userEmail = document.getElementById("userEmail");
  if (userEmail) {
    userEmail.textContent = session.correo;
  }

  const userRole = document.getElementById("userRole");
  if (userRole) {
    userRole.textContent = hasAdminAccess(session)
      ? "Administrador"
      : "Usuario";
  }
}

// =============================================
// EXPORTAR FUNCIONES PARA USO GLOBAL
// =============================================

window.saveSession = saveSession;
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.checkAuthentication = checkAuthentication;
window.checkAdminAuthentication = checkAdminAuthentication;
window.initializeAdminPage = initializeAdminPage;
window.updateUserInfo = updateUserInfo;
window.hasAdminAccess = hasAdminAccess;

// =============================================
// FUNCIONES DE INTERFAZ DE USUARIO
// =============================================

function showModal(title, message, icon, type = "error") {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalIcon.textContent = icon;

  modalBtn.className = `modal-btn ${type}`;
  modal.classList.add("show");
}

window.closeModal = function () {
  modal.classList.remove("show");
};

function setLoginLoading(isLoading) {
  const loginBtn = document.getElementById("submit_login");
  if (loginBtn) {
    if (isLoading) {
      loginBtn.innerHTML = '<span class="loading"></span>Verificando...';
      loginBtn.disabled = true;
    } else {
      loginBtn.innerHTML = "Iniciar Sesión";
      loginBtn.disabled = false;
    }
  }
}

window.switchTab = function (tabName) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".form-container")
    .forEach((form) => form.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(tabName + "-form").classList.add("active");

  closeModal();
};

// =============================================
// FUNCIONES DE FIRESTORE DATABASE
// =============================================

async function getUserData(uid) {
  try {
    const userDocRef = doc(db, "usuarios", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = { id: uid, ...userDoc.data() };
      return userData;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function updateLastAccess(uid) {
  try {
    const userDocRef = doc(db, "usuarios", uid);
    await updateDoc(userDocRef, {
      ultimoAcceso: new Date().toISOString(),
    });
  } catch (error) {}
}

// =============================================
// FUNCIONES DE REDIRECCIÓN
// =============================================

function redirectUserByRole(userData) {
  if (userData.esAdmin === true || userData.idRol === "rol_004") {
    window.location.href = "admin-dashboard.html";
  } else {
    window.location.href = "descarga_app.html";
  }
}

// =============================================
// FUNCIÓN PRINCIPAL DE LOGIN
// =============================================

window.handleLogin = async function (event) {
  event.preventDefault();

  // Obtener valores del formulario
  const emailInput = document.getElementById("email_login");
  const passwordInput = document.getElementById("password_login");

  const email = emailInput?.value?.trim()?.toLowerCase() || "";
  const password = passwordInput?.value?.trim() || "";

  // Validaciones básicas
  if (!email || !password) {
    showModal(
      "Campos incompletos",
      "Por favor, completa todos los campos.",
      "📝",
      "error"
    );
    return;
  }

  // Validación de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showModal(
      "Correo inválido",
      "Por favor, ingresa un correo electrónico válido.",
      "📧",
      "error"
    );
    return;
  }

  // Validación de contraseña
  if (password.length < 6) {
    showModal(
      "Contraseña muy corta",
      "La contraseña debe tener al menos 6 caracteres.",
      "🔒",
      "error"
    );
    return;
  }

  // Verificar que Firebase esté inicializado

  setLoginLoading(true);

  try {
    // Intentar el login
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Verificar si el email está verificado
    if (!user.emailVerified) {
      setLoginLoading(false);
      showModal(
        "Email no verificado",
        "Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada y haz clic en el enlace de verificación.",
        "📧",
        "error"
      );
      return;
    }

    // Obtener datos del usuario
    const userData = await getUserData(user.uid);

    if (!userData) {
      throw new Error("No se encontraron datos del usuario en Firestore");
    }

    // Actualizar último acceso
    await updateLastAccess(user.uid);

    setLoginLoading(false);

    // Crear sesión
    const userSession = {
      uid: user.uid,
      correo: user.email,
      nombreUsuario: userData.nombreUsuario,
      apellido: userData.apellido || "",
      edad: userData.edad,
      codigoUsuario: userData.codigoUsuario,
      facultad: userData.facultad,
      ciclo: userData.ciclo,
      esAdmin: userData.esAdmin || false,
      idRol: userData.idRol || null,
      loginTime: new Date().toISOString(),
    };

    saveSession(userSession);

    // Auto-limpiado después del login exitoso
    autoCleanOnLogin();

    showModal(
      "¡Bienvenido!",
      `Hola ${userData.nombreUsuario}. Redirigiendo a tu portal...`,
      "✅",
      "success"
    );

    setTimeout(() => {
      closeModal();
      redirectUserByRole(userData);
    }, 2000);
  } catch (error) {
    setLoginLoading(false);

    let errorMessage =
      "Hubo un problema al iniciar sesión. Intenta nuevamente.";

    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "No existe una cuenta con este correo electrónico.";
        break;
      case "auth/wrong-password":
        errorMessage = "La contraseña es incorrecta.";
        break;
      case "auth/invalid-email":
        errorMessage = "El correo electrónico no es válido.";
        break;
      case "auth/user-disabled":
        errorMessage = "Esta cuenta ha sido deshabilitada.";
        break;
      case "auth/network-request-failed":
        errorMessage = "Error de conexión. Verifica tu conexión a internet.";
        break;
      case "auth/too-many-requests":
        errorMessage = "Demasiados intentos fallidos. Intenta más tarde.";
        break;
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
        errorMessage =
          "Email o contraseña incorrectos. Verifica tus credenciales.";
        break;
      case "auth/missing-password":
        errorMessage = "La contraseña es requerida.";
        break;
      case "auth/weak-password":
        errorMessage = "La contraseña debe tener al menos 6 caracteres.";
        break;
      default:
        errorMessage = `Error de autenticación: ${error.message}`;
        break;
    }

    showModal("Error de acceso", errorMessage, "🔒", "error");
  }
};

// =============================================
// FUNCIÓN DE LOGOUT
// =============================================

window.logout = async function () {
  try {
    await signOut(auth);
    clearSession();

    showModal(
      "Sesión cerrada",
      "Has cerrado sesión exitosamente",
      "👋",
      "success"
    );

    setTimeout(() => {
      closeModal();
      window.location.href = "index.html";
    }, 2000);
  } catch (error) {
    clearSession();
    window.location.href = "index.html";
  }
};

// =============================================
// OBSERVER DE ESTADO DE AUTENTICACIÓN
// =============================================

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userData = await getUserData(user.uid);

    if (userData) {
      const userSession = {
        uid: user.uid,
        correo: user.email,
        nombreUsuario: userData.nombreUsuario,
        apellido: userData.apellido || "",
        edad: userData.edad,
        codigoUsuario: userData.codigoUsuario,
        facultad: userData.facultad,
        ciclo: userData.ciclo,
        esAdmin: userData.esAdmin || false,
        idRol: userData.idRol || null,
        loginTime: new Date().toISOString(),
      };

      saveSession(userSession);
    }
  } else {
    clearSession();
  }
});

// =============================================
// INICIALIZACIÓN
// =============================================

if (modal) {
  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (!auth) {
  }

  if (!db) {
  }

  document.querySelectorAll(".form-input").forEach((input) => {
    input.addEventListener("focus", function () {
      this.parentNode.style.transform = "scale(1.02)";
      this.parentNode.style.transition = "transform 0.2s ease";
    });

    input.addEventListener("blur", function () {
      this.parentNode.style.transform = "scale(1)";
    });
  });
});
