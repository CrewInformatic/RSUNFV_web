import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAUBAyRnT0XEoKLlv-9GAmxi6F12peZd7c",
  authDomain: "rsunfv.firebaseapp.com",
  projectId: "rsunfv",
  storageBucket: "rsunfv.firebasestorage.app",
  messagingSenderId: "125433829660",
  appId: "1:125433829660:web:ef60f4871bf4ad74ae02d9",
  measurementId: "G-QCWGD7EJ46",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables globales para el sistema de autenticación
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

// Guardar sesión en localStorage
function saveSession(userSession) {
  try {
    localStorage.setItem("userSession", JSON.stringify(userSession));
    currentUser = userSession;
    console.log("Sesión guardada:", userSession);
  } catch (error) {
    console.error("Error al guardar sesión:", error);
  }
}

// Obtener sesión de localStorage
function getStoredSession() {
  try {
    const storedSession = localStorage.getItem("userSession");
    if (storedSession) {
      const session = JSON.parse(storedSession);
      currentUser = session;
      return session;
    }
    return null;
  } catch (error) {
    console.error("Error al obtener sesión:", error);
    localStorage.removeItem("userSession"); // Limpiar sesión corrupta
    return null;
  }
}

// Limpiar sesión
function clearSession() {
  try {
    localStorage.removeItem("userSession");
    currentUser = null;
    console.log("Sesión limpiada");
  } catch (error) {
    console.error("Error al limpiar sesión:", error);
  }
}

// Verificar si hay una sesión activa
function checkActiveSession() {
  const session = getStoredSession();
  if (session) {
    console.log("Sesión activa encontrada:", session);
    return session;
  }
  return null;
}

// Verificar validez de la sesión (opcional: verificar si el usuario aún existe en BD)
async function validateSession(session) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", session.correo));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Actualizar datos de la sesión si es necesario
      const updatedSession = {
        id: userDoc.id,
        correo: userData.correo,
        nombre: userData.nombre || "",
        esAdmin: userData.esAdmin || false,
        loginTime: session.loginTime, // Mantener tiempo original de login
      };

      saveSession(updatedSession);
      return updatedSession;
    } else {
      // Usuario ya no existe, limpiar sesión
      clearSession();
      return null;
    }
  } catch (error) {
    console.error("Error al validar sesión:", error);
    return session; // Mantener sesión en caso de error de red
  }
}

// Redireccionar según el rol del usuario
function redirectUserByRole(userData) {
  if (userData.esAdmin === true) {
    console.log("Redirigiendo a admin dashboard");
    window.location.href = "admin-dashboard.html";
  } else {
    console.log("Redirigiendo a portal estudiantil");
    window.location.href = "portal_test.html";
  }
}

// =============================================
// FUNCIONES DE INTERFAZ DE USUARIO
// =============================================

// Función para mostrar modal
function showModal(title, message, icon, type = "error") {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalIcon.textContent = icon;

  // Cambiar estilo del botón según el tipo
  modalBtn.className = `modal-btn ${type}`;

  modal.classList.add("show");
}

// Función para cerrar modal
window.closeModal = function () {
  modal.classList.remove("show");
};

// Función para mostrar loading en el botón
function setLoginLoading(isLoading) {
  const loginBtn = document.getElementById("submit_login");
  if (isLoading) {
    loginBtn.innerHTML = '<span class="loading"></span>Verificando...';
    loginBtn.disabled = true;
  } else {
    loginBtn.innerHTML = "Iniciar Sesión";
    loginBtn.disabled = false;
  }
}

function setRegisterLoading(isLoading) {
  const registerBtn = document.getElementById("submit");
  if (isLoading) {
    registerBtn.innerHTML = '<span class="loading"></span>Registrando...';
    registerBtn.disabled = true;
  } else {
    registerBtn.innerHTML = "Crear Cuenta";
    registerBtn.disabled = false;
  }
}

// Función para cambiar entre pestañas
window.switchTab = function (tabName) {
  // Remover clase active de todos los botones y formularios
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".form-container")
    .forEach((form) => form.classList.remove("active"));

  // Activar pestaña y formulario correspondiente
  event.target.classList.add("active");
  document.getElementById(tabName + "-form").classList.add("active");

  // Cerrar modal si está abierto
  closeModal();
};

// =============================================
// FUNCIONES DE AUTENTICACIÓN
// =============================================

// Función para manejar el registro de usuarios con Firebase
window.handleRegister = async function (event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  // Validaciones básicas
  if (name.length < 2) {
    showModal(
      "Error de validación",
      "El nombre debe tener al menos 2 caracteres",
      "📝",
      "error"
    );
    return;
  }

  if (password.length < 6) {
    showModal(
      "Error de validación",
      "La contraseña debe tener al menos 6 caracteres",
      "🔒",
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

  setRegisterLoading(true);

  try {
    // Verificar si el usuario ya existe
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      setRegisterLoading(false);
      showModal(
        "Usuario existente",
        "Ya existe una cuenta con este correo electrónico",
        "👤",
        "error"
      );
      return;
    }

    // Crear nuevo usuario en Firebase
    const newUser = {
      nombre: name,
      correo: email,
      clave: password, // En producción, esto debería estar encriptado
      esAdmin: false,
      fechaRegistro: new Date().toISOString(),
    };

    await addDoc(usuariosRef, newUser);

    setRegisterLoading(false);

    // Mostrar mensaje de éxito
    showModal(
      "¡Registro exitoso!",
      "Cuenta creada exitosamente. Ahora puedes iniciar sesión.",
      "✅",
      "success"
    );

    // Limpiar formulario
    document.getElementById("name").value = "";
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";

    // Cambiar a pestaña de login después de cerrar el modal
    setTimeout(() => {
      closeModal();
      switchTab("login");
      document.getElementById("email_login").value = email;
    }, 2000);
  } catch (error) {
    console.error("Error en registro:", error);
    setRegisterLoading(false);
    showModal(
      "Error de conexión",
      "Hubo un problema al registrar tu cuenta. Intenta nuevamente.",
      "⚠️",
      "error"
    );
  }
};

// Función para manejar el inicio de sesión con Firebase
window.handleLogin = async function (event) {
  event.preventDefault();

  const email = document
    .getElementById("email_login")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("password_login").value.trim();

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
    console.log("Buscando usuario con correo:", email);

    // Crear query para buscar usuario por correo
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Usuario no encontrado
      console.log("Usuario no encontrado");
      setLoginLoading(false);
      showModal("Usuario no registrado", "Te falta registrarte", "👤", "error");
      return;
    }

    // Usuario encontrado, verificar clave
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    console.log("Usuario encontrado:", userData);

    if (userData.clave !== password) {
      // Clave incorrecta
      console.log("Clave incorrecta");
      setLoginLoading(false);
      showModal(
        "Credenciales incorrectas",
        "Correo o clave incorrectos",
        "🔒",
        "error"
      );
      return;
    }

    // Login exitoso
    console.log("Login exitoso");
    setLoginLoading(false);

    // Crear sesión del usuario
    const userSession = {
      id: userDoc.id,
      correo: userData.correo,
      nombre: userData.nombre || "",
      esAdmin: userData.esAdmin || false,
      loginTime: new Date().toISOString(),
    };

    // Guardar sesión persistente
    saveSession(userSession);

    // Mostrar mensaje de éxito
    showModal(
      "¡Bienvenido!",
      `Hola ${userData.nombre || email}. Redirigiendo...`,
      "✅",
      "success"
    );

    // Redirigir según el rol después de 2 segundos
    setTimeout(() => {
      closeModal();
      redirectUserByRole(userData);
    }, 2000);
  } catch (error) {
    console.error("Error en login:", error);
    setLoginLoading(false);
    showModal(
      "Error de conexión",
      "Hubo un problema al conectar con el servidor. Intenta nuevamente.",
      "⚠️",
      "error"
    );
  }
};

// Función para cerrar sesión
window.logout = function () {
  // Limpiar sesión persistente
  clearSession();

  // Ocultar panel de bienvenida
  const welcomePanel = document.getElementById("welcome-panel");
  if (welcomePanel) {
    welcomePanel.classList.remove("active");
  }

  // Mostrar pestañas y formulario de login
  const tabs = document.querySelector(".tabs");
  if (tabs) {
    tabs.style.display = "flex";
  }

  // Limpiar formularios
  const emailLogin = document.getElementById("email_login");
  const passwordLogin = document.getElementById("password_login");
  if (emailLogin) emailLogin.value = "";
  if (passwordLogin) passwordLogin.value = "";

  // Activar pestaña de login
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".form-container")
    .forEach((form) => form.classList.remove("active"));

  const firstTabBtn = document.querySelector(".tab-btn");
  const loginForm = document.getElementById("login-form");
  if (firstTabBtn) firstTabBtn.classList.add("active");
  if (loginForm) loginForm.classList.add("active");

  showModal(
    "Sesión cerrada",
    "Has cerrado sesión exitosamente",
    "👋",
    "success"
  );

  // Redirigir a la página de login después de mostrar el mensaje
  setTimeout(() => {
    closeModal();
    // Si estamos en una página protegida, redirigir al login
    if (
      window.location.pathname.includes("admin-dashboard.html") ||
      window.location.pathname.includes("portal_test.html")
    ) {
      window.location.href = "index.html";
    }
  }, 2000);
};

// Función específica para el logout desde el dashboard
window.handleLogout = function () {
  const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (confirmed) {
    // Limpiar sesión persistente
    clearSession();

    // Redirigir inmediatamente al login
    window.location.href = "index.html";
  }
};

// =============================================
// FUNCIONES DE VERIFICACIÓN DE ACCESO
// =============================================

// Verificar si el usuario tiene acceso a una página específica
function checkPageAccess() {
  const currentPage = window.location.pathname.split("/").pop();
  const session = checkActiveSession();

  // Páginas que requieren autenticación
  const protectedPages = [
    "admin-dashboard.html",
    "portal_test.html",
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "configuracion.html",
    "reportes.html",
  ];

  // Páginas que requieren rol de administrador
  const adminPages = [
    "admin-dashboard.html",
    "eventos.html",
    "administradores.html",
    "usuarios.html",
    "configuracion.html",
    "reportes.html",
  ];

  if (protectedPages.includes(currentPage)) {
    if (!session) {
      console.log("No hay sesión activa, redirigiendo al login");
      window.location.href = "index.html";
      return false;
    }

    if (adminPages.includes(currentPage) && !session.esAdmin) {
      console.log("Usuario sin privilegios de administrador");
      alert("No tienes permisos para acceder a esta página");
      window.location.href = "portal_test.html";
      return false;
    }

    // Validar sesión en segundo plano
    validateSession(session);
  }

  return true;
}

// =============================================
// FUNCIONES UTILITARIAS
// =============================================

// Función para mostrar el panel de bienvenida
function showWelcomePanel(user) {
  // Ocultar formularios y pestañas
  document
    .querySelectorAll(".form-container")
    .forEach((form) => form.classList.remove("active"));
  const tabs = document.querySelector(".tabs");
  if (tabs) tabs.style.display = "none";

  // Mostrar panel de bienvenida
  const welcomePanel = document.getElementById("welcome-panel");
  const welcomeMessage = document.getElementById("welcomeMessage");

  if (welcomePanel && welcomeMessage) {
    welcomeMessage.textContent = `¡Hola ${
      user.nombre || user.correo
    }! Has iniciado sesión exitosamente en el portal UNFV.`;
    welcomePanel.classList.add("active");
  }
}

// Funciones utilitarias para usar en otras páginas
window.getCurrentSession = function () {
  return currentUser || checkActiveSession();
};

window.requireAuth = function () {
  const session = checkActiveSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
};

window.requireAdmin = function () {
  const session = checkActiveSession();
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

// Para desarrollo - mostrar usuarios registrados
window.showRegisteredUsers = async function () {
  try {
    const usuariosRef = collection(db, "usuarios");
    const querySnapshot = await getDocs(usuariosRef);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log("Usuarios registrados:", users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
  }
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
  console.log("Página cargada, verificando sesión...");

  // Verificar acceso a la página actual
  checkPageAccess();

  // Si estamos en la página de login y hay una sesión activa, redirigir
  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage === "index.html" || currentPage === "") {
    const session = checkActiveSession();
    if (session) {
      console.log("Sesión activa encontrada, redirigiendo...");
      setTimeout(() => {
        redirectUserByRole(session);
      }, 1000);
      return;
    }
  }

  // Actualizar UI si hay sesión activa
  const session = getCurrentSession();
  if (session) {
    // Actualizar nombre de usuario en el dashboard
    const userDisplayName = document.getElementById("userDisplayName");
    if (userDisplayName) {
      userDisplayName.textContent = session.nombre || session.correo;
    }
  }

  // Agregar efectos de hover a los inputs
  document.querySelectorAll(".form-input").forEach((input) => {
    input.addEventListener("focus", function () {
      this.parentNode.style.transform = "scale(1.02)";
      this.parentNode.style.transition = "transform 0.2s ease";
    });

    input.addEventListener("blur", function () {
      this.parentNode.style.transform = "scale(1)";
    });
  });

  console.log("Sistema de autenticación inicializado");
});
