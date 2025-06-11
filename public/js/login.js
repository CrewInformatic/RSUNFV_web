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
  } catch (error) {
    console.error("Error al guardar sesión:", error);
  }
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
    console.error("Error al obtener sesión:", error);
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

  if (!session.esAdmin) {
    alert("No tienes permisos para acceder a esta página");
    window.location.href = "portal_test.html";
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

  if (!session.esAdmin) {
    alert("No tienes permisos de administrador");
    window.location.href = "portal_test.html";
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

  if (adminPages.includes(pageName) && !session.esAdmin) {
    alert("No tienes permisos para acceder a esta página");
    return;
  }

  window.location.href = pageName;
};

window.showProfile = function () {
  const session = getStoredSession();
  if (session) {
    alert(
      `Perfil de Usuario:\n\nnombreUsuario: ${session.nombreUsuario}\nCorreo: ${
        session.correo
      }\nRol: ${
        session.esAdmin ? "Administrador" : "Usuario"
      }\nÚltimo acceso: ${new Date(session.loginTime).toLocaleString()}`
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
    userRole.textContent = session.esAdmin ? "Administrador" : "Usuario";
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
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error al obtener datos del usuario:", error);
    return null;
  }
}

async function updateLastAccess(uid) {
  try {
    const userDocRef = doc(db, "usuarios", uid);
    await updateDoc(userDocRef, {
      ultimoAcceso: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al actualizar último acceso:", error);
  }
}

// =============================================
// FUNCIONES DE REDIRECCIÓN
// =============================================

function redirectUserByRole(userData) {
  if (userData.esAdmin === true) {
    window.location.href = "admin-dashboard.html";
  } else {
    window.location.href = "portal_test.html";
  }
}

// =============================================
// FUNCIÓN PRINCIPAL DE LOGIN
// =============================================

window.handleLogin = async function (event) {
  event.preventDefault();

  const email =
    document.getElementById("email_login")?.value.trim().toLowerCase() || "";
  const password =
    document.getElementById("password_login")?.value.trim() || "";

  if (!email || !password) {
    showModal(
      "Campos incompletos",
      "Por favor, completa todos los campos.",
      "📝",
      "error"
    );
    return;
  }

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

  setLoginLoading(true);

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const userData = await getUserData(user.uid);

    if (!userData) {
      throw new Error("No se encontraron datos del usuario en Firestore");
    }

    await updateLastAccess(user.uid);

    setLoginLoading(false);

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
      loginTime: new Date().toISOString(),
    };

    saveSession(userSession);

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
    console.error("Error en login:", error);
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
        errorMessage =
          "Las credenciales son inválidas. Verifica tu email y contraseña.";
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
    console.error("Error al cerrar sesión:", error);
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
        loginTime: new Date().toISOString(),
      };

      saveSession(userSession);
    }
  } else {
    clearSession();
  }
});

// =============================================
// FUNCIONES UTILITARIAS DUPLICADAS (LIMPIAR)
// =============================================

window.getCurrentSession = function () {
  return currentUser || getStoredSession();
};

window.getCurrentUser = function () {
  return auth.currentUser;
};

window.requireAuth = async function () {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "index.html";
    return null;
  }

  const userData = await getUserData(user.uid);
  return userData;
};

window.requireAdmin = async function () {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "index.html";
    return null;
  }

  const userData = await getUserData(user.uid);
  if (!userData || !userData.esAdmin) {
    alert("No tienes permisos de administrador");
    window.location.href = "portal_test.html";
    return null;
  }

  return userData;
};

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
    console.error("Firebase Authentication: No disponible");
  }

  if (!db) {
    console.error("Firestore Database: No disponible");
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
