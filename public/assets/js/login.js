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

// Inicializar Firebase (usando versión compat)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales para el estado de la aplicación
window.appState = {
  currentUserData: null,
  authInitialized: false,
  isLoggingOut: false,
};

// Función para mostrar mensajes mejorados (disponible globalmente)
window.showMessage = function (message, type = "info") {
  // Remover alertas anteriores
  const existingAlert = document.querySelector(".custom-alert");
  if (existingAlert) {
    existingAlert.remove();
  }

  // Crear nueva alerta
  const alertDiv = document.createElement("div");
  alertDiv.className = "custom-alert";
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    ${
      type === "success"
        ? "background: linear-gradient(135deg, #4CAF50, #45a049);"
        : ""
    }
    ${
      type === "error"
        ? "background: linear-gradient(135deg, #f44336, #da190b);"
        : ""
    }
    ${
      type === "info"
        ? "background: linear-gradient(135deg, #2196F3, #0b7dda);"
        : ""
    }
    ${
      type === "loading"
        ? "background: linear-gradient(135deg, #FF9800, #F57C00);"
        : ""
    }
  `;

  alertDiv.innerHTML = `
    ${
      type === "loading"
        ? '<div style="display: inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>'
        : ""
    }
    ${message}
  `;

  document.body.appendChild(alertDiv);

  // Animar entrada
  setTimeout(() => {
    alertDiv.style.transform = "translateX(0)";
  }, 100);

  // Auto-remover después de cierto tiempo (excepto loading)
  if (type !== "loading") {
    setTimeout(() => {
      alertDiv.style.transform = "translateX(100%)";
      setTimeout(() => alertDiv.remove(), 300);
    }, 4000);
  }

  return alertDiv;
};

// Agregar estilos de animación
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Función para alternar entre pestañas
window.switchTab = function (tabName) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const tabBtns = document.querySelectorAll(".tab-btn");

  if (!loginForm || !registerForm) return;

  // Remover clase active de todos los botones y formularios
  tabBtns.forEach((btn) => btn.classList.remove("active"));
  loginForm.classList.remove("active");
  registerForm.classList.remove("active");

  if (tabName === "login") {
    loginForm.classList.add("active");
    tabBtns[0]?.classList.add("active");
  } else if (tabName === "register") {
    registerForm.classList.add("active");
    tabBtns[1]?.classList.add("active");
  }
};

// Función para obtener datos del usuario desde Firestore
async function getUserData(userId) {
  try {
    console.log("Obteniendo datos para usuario:", userId);
    const userDoc = await db.collection("usuarios").doc(userId).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log("Datos del usuario encontrados:", userData);
      return userData;
    } else {
      console.log("No se encontró el documento del usuario");
      return null;
    }
  } catch (error) {
    console.error("Error al obtener datos del usuario:", error);
    throw error;
  }
}

// Función para verificar si estamos en la página de login
function isLoginPage() {
  return (
    window.location.pathname.includes("index.html") ||
    window.location.pathname === "/" ||
    window.location.pathname.includes("login") ||
    window.location.pathname === "/index.html"
  );
}

// Función para verificar si estamos en una página protegida
function isProtectedPage() {
  return (
    window.location.pathname.includes("admin-dashboard.html") ||
    window.location.pathname.includes("portal_test.html") ||
    window.location.pathname.includes("dashboard")
  );
}

// Función para redirigir según el rol
function redirectByRole(userData, user) {
  const userName = userData.nombre || user.displayName || user.email;
  console.log("Datos del usuario para redirección:", userData);
  console.log("Es admin:", userData.esAdmin);

  // Verificar explícitamente el valor de esAdmin
  if (userData.esAdmin === true) {
    console.log("Redirigiendo a admin dashboard");
    if (!window.location.pathname.includes("admin-dashboard.html")) {
      window.showMessage(
        `¡Bienvenido Admin ${userName}! Redirigiendo al panel de administración...`,
        "success"
      );
      setTimeout(() => {
        window.location.href = "/public/admin-dashboard.html";
      }, 1500);
    }
  } else {
    console.log("Redirigiendo a portal estudiantil");
    if (!window.location.pathname.includes("portal_test.html")) {
      window.showMessage(
        `¡Bienvenido ${userName}! Redirigiendo al portal estudiantil...`,
        "success"
      );
      setTimeout(() => {
        window.location.href = "/public/portal_test.html";
      }, 1500);
    }
  }
}

// Función principal de login
window.handleLogin = async function (event) {
  event.preventDefault();
  console.log("Función handleLogin ejecutada");

  const email = document.getElementById("email_login")?.value.trim();
  const password = document.getElementById("password_login")?.value;

  console.log("Email ingresado:", email);
  console.log("Password length:", password?.length || 0);

  // Validaciones básicas
  if (!email || !password) {
    window.showMessage("Por favor, completa todos los campos", "error");
    return;
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    window.showMessage("Por favor, ingresa un email válido", "error");
    return;
  }

  // Mostrar mensaje de carga
  const loadingAlert = window.showMessage(
    "Verificando credenciales...",
    "loading"
  );

  try {
    console.log("Intentando autenticación con Firebase...");

    // Configurar persistencia de autenticación
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Iniciar sesión con Firebase Auth
    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password
    );
    const user = userCredential.user;
    console.log("Usuario autenticado:", user.uid);

    // Obtener datos del usuario desde Firestore
    const userData = await getUserData(user.uid);

    if (userData) {
      console.log("Verificando estado del usuario...");

      // Verificar si el usuario está activo
      if (userData.estadoActivo === false) {
        console.log("Usuario desactivado");
        window.showMessage(
          "Tu cuenta ha sido desactivada. Contacta al administrador.",
          "error"
        );
        await auth.signOut();
        loadingAlert.remove();
        return;
      }

      // Guardar datos del usuario en variable global
      window.appState.currentUserData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        userData: userData,
      };

      console.log("Datos guardados:", window.appState.currentUserData);

      // Remover mensaje de carga
      loadingAlert.remove();

      // Redirigir según el rol
      redirectByRole(userData, user);
    } else {
      console.log("No se encontraron datos del usuario en Firestore");
      loadingAlert.remove();
      window.showMessage(
        "No se encontraron datos de usuario. Contacta al administrador.",
        "error"
      );
    }
  } catch (error) {
    console.error("Error en login:", error);

    // Remover mensaje de carga
    if (loadingAlert && loadingAlert.parentNode) {
      loadingAlert.remove();
    }

    // Manejar diferentes tipos de errores
    let errorMessage = "Error al iniciar sesión";

    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "No existe una cuenta con este correo electrónico";
        break;
      case "auth/wrong-password":
        errorMessage = "Contraseña incorrecta";
        break;
      case "auth/invalid-email":
        errorMessage = "El formato del correo electrónico no es válido";
        break;
      case "auth/user-disabled":
        errorMessage = "Esta cuenta ha sido deshabilitada";
        break;
      case "auth/too-many-requests":
        errorMessage = "Demasiados intentos fallidos. Intenta más tarde";
        break;
      case "auth/network-request-failed":
        errorMessage = "Error de conexión. Verifica tu internet";
        break;
      case "auth/invalid-credential":
        errorMessage = "Credenciales inválidas. Verifica tu email y contraseña";
        break;
      default:
        errorMessage = `Error: ${error.message}`;
    }

    window.showMessage(errorMessage, "error");
  }
};

// Función para manejar registro
window.handleRegister = function (event) {
  event.preventDefault();
  window.showMessage("Función de registro aún no implementada", "info");
};

// Función para cerrar sesión
window.logout = async function () {
  try {
    window.appState.isLoggingOut = true;
    console.log("Iniciando proceso de logout...");

    await auth.signOut();
    window.appState.currentUserData = null;
    window.appState.isLoggingOut = false;

    window.showMessage("Sesión cerrada exitosamente", "success");

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 1500);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    window.appState.isLoggingOut = false;
    window.showMessage("Error al cerrar sesión", "error");
  }
};

// Función principal para manejar el estado de autenticación
auth.onAuthStateChanged(async (user) => {
  console.log("onAuthStateChanged ejecutado, usuario:", user?.uid || "null");

  // Marcar que la autenticación se ha inicializado
  window.appState.authInitialized = true;

  if (user) {
    console.log("Usuario autenticado detectado:", user.uid);

    try {
      // Obtener datos del usuario desde Firestore
      const userData = await getUserData(user.uid);

      if (userData) {
        // Verificar si el usuario está activo
        if (userData.estadoActivo === false) {
          console.log("Usuario desactivado, cerrando sesión");
          await auth.signOut();
          if (isProtectedPage()) {
            window.location.href = "/index.html";
          }
          return;
        }

        // Actualizar datos del usuario
        window.appState.currentUserData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          userData: userData,
        };

        console.log(
          "Datos del usuario actualizados:",
          window.appState.currentUserData
        );

        // Si estamos en la página de login y el usuario está autenticado, redirigir
        if (isLoginPage() && !window.appState.isLoggingOut) {
          console.log(
            "Usuario autenticado en página de login, redirigiendo..."
          );
          redirectByRole(userData, user);
        }

        // Si estamos en una página protegida y hay función de carga de dashboard, ejecutarla
        if (
          isProtectedPage() &&
          typeof window.loadDashboardData === "function"
        ) {
          console.log("Cargando datos del dashboard...");
          setTimeout(() => {
            window.loadDashboardData();
          }, 500);
        }

        // Actualizar elementos de la interfaz si existen
        const displayNameElement = document.getElementById("userDisplayName");
        if (displayNameElement) {
          displayNameElement.textContent = userData.nombre || user.email;
        }

        // Disparar evento personalizado para notificar que el usuario está listo
        window.dispatchEvent(
          new CustomEvent("userAuthenticated", {
            detail: { userData: window.appState.currentUserData },
          })
        );
      } else {
        console.log("No se encontraron datos del usuario en Firestore");
        // Si no hay datos del usuario, cerrar sesión
        await auth.signOut();
        if (isProtectedPage()) {
          window.location.href = "/index.html";
        }
      }
    } catch (error) {
      console.error("Error al verificar datos del usuario:", error);
      // En caso de error, redirigir al login si estamos en página protegida
      if (isProtectedPage()) {
        window.showMessage(
          "Error al verificar sesión. Redirigiendo al login...",
          "error"
        );
        setTimeout(() => {
          window.location.href = "/index.html";
        }, 2000);
      }
    }
  } else {
    console.log("No hay usuario autenticado");
    window.appState.currentUserData = null;

    // Solo redirigir si no estamos en proceso de logout
    if (isProtectedPage() && !window.appState.isLoggingOut) {
      console.log("No hay usuario en página protegida, redirigiendo al login");
      window.location.href = "/index.html";
    }
  }
});

// Función para obtener el usuario actual
window.getCurrentUser = function () {
  return window.appState.currentUserData;
};

// Función para verificar si el usuario está autenticado
window.isUserAuthenticated = function () {
  return window.appState.currentUserData !== null && auth.currentUser !== null;
};

// Función para esperar a que la autenticación se inicialice
window.waitForAuthInit = function () {
  return new Promise((resolve) => {
    if (window.appState.authInitialized) {
      resolve();
    } else {
      const unsubscribe = auth.onAuthStateChanged(() => {
        unsubscribe();
        resolve();
      });
    }
  });
};

// Función auxiliar para manejar logout desde HTML
window.handleLogout = async function () {
  if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
    try {
      window.showMessage("Cerrando sesión...", "loading");
      await window.logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      window.showMessage("Error al cerrar sesión", "error");
    }
  }
};

console.log("Auth.js cargado - Funciones disponibles globalmente");
