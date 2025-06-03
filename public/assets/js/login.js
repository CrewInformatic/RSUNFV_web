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
// FUNCIONES DE GESTIÓN DE SESIÓN CORREGIDAS
// =============================================

// OPCIÓN 1: Usar un sistema global de sesión que funcione en ambas páginas
function saveSession(userSession) {
  try {
    // Guardar tanto en memoria como en sessionStorage (solo para persistencia entre páginas)
    currentUser = userSession;
    sessionStorage.setItem("userSession", JSON.stringify(userSession));
    console.log("✅ Sesión guardada:", userSession);
  } catch (error) {
    console.error("❌ Error al guardar sesión:", error);
  }
}

function getStoredSession() {
  try {
    // Primero intentar obtener de memoria
    if (currentUser) {
      return currentUser;
    }

    // Si no está en memoria, intentar obtener de sessionStorage
    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession);
      currentUser = parsedSession; // Actualizar la variable en memoria
      return parsedSession;
    }

    return null;
  } catch (error) {
    console.error("❌ Error al obtener sesión:", error);
    // Limpiar sessionStorage si hay error
    sessionStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    currentUser = null;
    sessionStorage.removeItem("userSession");
    console.log("🧹 Sesión limpiada");
  } catch (error) {
    console.error("❌ Error al limpiar sesión:", error);
  }
}

// =============================================
// FUNCIÓN MEJORADA DE VERIFICACIÓN DE AUTENTICACIÓN
// =============================================

function checkAuthentication() {
  console.log("🔍 Verificando autenticación...");

  const session = getStoredSession();

  if (!session) {
    console.log("❌ No hay sesión activa, redirigiendo al login");
    window.location.href = "index.html";
    return null;
  }

  console.log("✅ Sesión encontrada:", {
    correo: session.correo,
    nombre: session.nombre,
    esAdmin: session.esAdmin,
  });

  return session;
}

// Función específica para verificar permisos de admin
function checkAdminAuthentication() {
  console.log("🔍 Verificando autenticación de administrador...");

  const session = getStoredSession();

  if (!session) {
    console.log("❌ No hay sesión activa, redirigiendo al login");
    window.location.href = "index.html";
    return null;
  }

  if (!session.esAdmin) {
    console.log("❌ Usuario sin privilegios de administrador");
    alert("No tienes permisos para acceder a esta página");
    window.location.href = "portal_test.html";
    return null;
  }

  console.log("✅ Usuario administrador verificado:", {
    correo: session.correo,
    nombre: session.nombre,
  });

  return session;
}

// =============================================
// FUNCIONES UTILITARIAS MEJORADAS
// =============================================

// Para usar en login.js
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
// FUNCIONES DE NAVEGACIÓN CORREGIDAS
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
      `Perfil de Usuario:\n\nNombre: ${session.nombre}\nCorreo: ${
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
    console.log("Cerrando sesión...");
    clearSession();
    alert("Sesión cerrada exitosamente");
    window.location.href = "index.html";
  }
};

// =============================================
// INICIALIZACIÓN MEJORADA PARA PÁGINAS DE ADMIN
// =============================================

function initializeAdminPage() {
  console.log("🚀 Inicializando página de administrador...");

  // Verificar autenticación de admin inmediatamente
  const session = checkAdminAuthentication();
  if (!session) {
    return; // Si no pasa la verificación, ya fue redirigido
  }

  // Actualizar información del usuario en la interfaz
  updateUserInfo(session);

  console.log("✅ Página de administrador inicializada correctamente");
  return session;
}

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombre || session.correo;
  }

  // Actualizar otros elementos de la interfaz si existen
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

// Hacer disponibles las funciones globalmente
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

// Función para mostrar modal
function showModal(title, message, icon, type = "error") {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalIcon.textContent = icon;

  modalBtn.className = `modal-btn ${type}`;
  modal.classList.add("show");
}

// Función para cerrar modal
window.closeModal = function () {
  modal.classList.remove("show");
};

// Función de loading para login
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

// Función para cambiar entre pestañas
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

// Obtener datos completos del usuario desde Firestore
async function getUserData(uid) {
  try {
    console.log("🔍 Obteniendo datos del usuario con UID:", uid);
    const userDocRef = doc(db, "usuarios", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = { id: uid, ...userDoc.data() };
      console.log("✅ Datos del usuario obtenidos desde Firestore:", userData);
      return userData;
    } else {
      console.log("⚠️ No se encontraron datos del usuario en Firestore");
      return null;
    }
  } catch (error) {
    console.error("❌ Error al obtener datos del usuario:", error);
    return null;
  }
}

// Actualizar último acceso del usuario
async function updateLastAccess(uid) {
  try {
    const userDocRef = doc(db, "usuarios", uid);
    await updateDoc(userDocRef, {
      ultimoAcceso: new Date().toISOString(),
    });
    console.log("✅ Último acceso actualizado en Firestore");
  } catch (error) {
    console.error("❌ Error al actualizar último acceso:", error);
  }
}

// =============================================
// FUNCIONES DE REDIRECCIÓN
// =============================================

// Redireccionar según el rol del usuario
function redirectUserByRole(userData) {
  if (userData.esAdmin === true) {
    console.log("🔒 Redirigiendo a admin dashboard");
    window.location.href = "admin-dashboard.html";
  } else {
    console.log("👤 Redirigiendo a portal estudiantil");
    window.location.href = "portal_test.html";
  }
}

// =============================================
// FUNCIÓN PRINCIPAL DE LOGIN
// =============================================

// Función para manejar el LOGIN
window.handleLogin = async function (event) {
  event.preventDefault();
  console.log("🔑 Iniciando proceso de login...");

  const email =
    document.getElementById("email_login")?.value.trim().toLowerCase() || "";
  const password =
    document.getElementById("password_login")?.value.trim() || "";

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

  // Validar formato de email
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
    console.log("🔐 Verificando credenciales en Firebase Authentication...");

    // PASO 1: Iniciar sesión con Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    console.log("✅ Login exitoso con Firebase Authentication. UID:", user.uid);

    // PASO 2: Obtener datos completos del usuario desde Firestore
    const userData = await getUserData(user.uid);

    if (!userData) {
      throw new Error("No se encontraron datos del usuario en Firestore");
    }

    console.log("📋 Datos del usuario obtenidos desde Firestore:", userData);

    // PASO 3: Actualizar último acceso en Firestore
    await updateLastAccess(user.uid);

    setLoginLoading(false);

    // PASO 4: Crear sesión del usuario combinando datos de Auth y Firestore
    const userSession = {
      uid: user.uid,
      correo: user.email, // Email desde Authentication
      nombre: userData.nombre, // Desde Firestore
      apellido: userData.apellido || "", // Desde Firestore
      edad: userData.edad, // Desde Firestore
      codigoUsuario: userData.codigoUsuario, // Desde Firestore
      facultad: userData.facultad, // Desde Firestore
      ciclo: userData.ciclo, // Desde Firestore
      esAdmin: userData.esAdmin || false, // Desde Firestore
      loginTime: new Date().toISOString(),
    };

    // PASO 5: Guardar sesión
    saveSession(userSession);

    console.log(
      "✅ Sesión creada combinando datos de Authentication y Firestore:",
      userSession
    );

    // PASO 6: Mostrar mensaje de éxito
    showModal(
      "¡Bienvenido!",
      `Hola ${userData.nombre}. Redirigiendo a tu portal...`,
      "✅",
      "success"
    );

    // PASO 7: Redirigir según el rol después de 2 segundos
    setTimeout(() => {
      closeModal();
      redirectUserByRole(userData);
    }, 2000);
  } catch (error) {
    console.error("❌ Error en login:", error);
    setLoginLoading(false);

    let errorMessage =
      "Hubo un problema al iniciar sesión. Intenta nuevamente.";

    // Manejar errores específicos de Firebase
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

// Función para cerrar sesión
window.logout = async function () {
  try {
    console.log("👋 Cerrando sesión...");

    // Cerrar sesión en Firebase Auth
    await signOut(auth);

    // Limpiar sesión local
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
    console.error("❌ Error al cerrar sesión:", error);
    // Forzar limpieza local incluso si falla el logout de Firebase
    clearSession();
    window.location.href = "index.html";
  }
};

// =============================================
// OBSERVER DE ESTADO DE AUTENTICACIÓN
// =============================================

// Escuchar cambios en el estado de autenticación
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("👤 Usuario autenticado detectado:", user.uid);

    // Obtener datos completos del usuario desde Firestore
    const userData = await getUserData(user.uid);

    if (userData) {
      // Crear sesión con los datos completos
      const userSession = {
        uid: user.uid,
        correo: user.email, // Email desde Authentication
        nombre: userData.nombre, // Desde Firestore
        apellido: userData.apellido || "", // Desde Firestore
        edad: userData.edad, // Desde Firestore
        codigoUsuario: userData.codigoUsuario, // Desde Firestore
        facultad: userData.facultad, // Desde Firestore
        ciclo: userData.ciclo, // Desde Firestore
        esAdmin: userData.esAdmin || false, // Desde Firestore
        loginTime: new Date().toISOString(),
      };

      saveSession(userSession);
    }
  } else {
    console.log("🚫 Usuario no autenticado");
    clearSession();
  }
});

// =============================================
// FUNCIONES UTILITARIAS
// =============================================

// Funciones utilitarias para usar en otras páginas
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

// Cerrar modal al hacer clic fuera de él
if (modal) {
  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });
}

// Inicialización cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Sistema de login Firebase inicializado");

  // Verificar Firebase Auth
  if (auth) {
    console.log("✅ Firebase Authentication: Conectado");
  } else {
    console.error("❌ Firebase Authentication: No disponible");
  }

  // Verificar Firestore
  if (db) {
    console.log("✅ Firestore Database: Conectado");
  } else {
    console.error("❌ Firestore Database: No disponible");
  }

  // Agregar efectos a los inputs
  document.querySelectorAll(".form-input").forEach((input) => {
    input.addEventListener("focus", function () {
      this.parentNode.style.transform = "scale(1.02)";
      this.parentNode.style.transition = "transform 0.2s ease";
    });

    input.addEventListener("blur", function () {
      this.parentNode.style.transform = "scale(1)";
    });
  });

  console.log("🎯 Inicialización de login completada");
});

console.log("🔑 Sistema de login cargado exitosamente");
