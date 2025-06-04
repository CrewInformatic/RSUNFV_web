// Importar configuración de Firebase desde archivo dedicado
import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  updateDoc,
} from "./firebase_config.js";

// Importar funciones adicionales de Firestore que necesitas
import {
  addDoc,
  deleteDoc,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Hacer disponible globalmente (auth ya está inicializada en firebase_config.js)
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseTimestamp = Timestamp;
window.firebaseServerTimestamp = serverTimestamp;

console.log("🔥 Firebase importado desde firebase_config.js correctamente");

// =============================================
// VARIABLES GLOBALES COMPARTIDAS
// =============================================
window.currentUser = null;
window.isCreatingEvent = false;
window.isFormInitialized = false;
window.isProcessingFiles = false;
window.isSubmitting = false;
window.currentFiles = [];

// =============================================
// CONFIGURACIÓN DE CLOUDINARY GLOBAL
// =============================================
window.CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

// =============================================
// FUNCIONES DE GESTIÓN DE SESIÓN (COMPARTIDAS)
// =============================================

function getStoredSession() {
  try {
    if (window.currentUser) {
      return window.currentUser;
    }

    const storedSession = sessionStorage.getItem("userSession");
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession);
      window.currentUser = parsedSession;
      return parsedSession;
    }

    return null;
  } catch (error) {
    console.error("❌ Error al obtener sesión:", error);
    sessionStorage.removeItem("userSession");
    return null;
  }
}

function clearSession() {
  try {
    window.currentUser = null;
    sessionStorage.removeItem("userSession");
    console.log("🧹 Sesión limpiada");
  } catch (error) {
    console.error("❌ Error al limpiar sesión:", error);
  }
}

function checkAuthentication() {
  console.log("🔍 Verificando autenticación...");

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
// FUNCIONES DE NAVEGACIÓN COMPARTIDAS
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
// FUNCIONES DE SIDEBAR Y NAVEGACIÓN
// =============================================

function initializeSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      sidebar.classList.toggle("show");
      sidebarOverlay.classList.toggle("show");
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", function () {
      sidebar.classList.remove("show");
      sidebarOverlay.classList.remove("show");
    });
  }

  const navLinks = document.querySelectorAll(".nav-link[data-section]");
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      navLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      if (window.innerWidth < 992) {
        sidebar.classList.remove("show");
        sidebarOverlay.classList.remove("show");
      }
    });
  });
}

// =============================================
// FUNCIÓN DE ACTUALIZACIÓN DE USUARIO
// =============================================

function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombre || session.correo;
  }
}

// =============================================
// INICIALIZACIÓN PRINCIPAL
// =============================================

async function initializeEventsPage() {
  console.log("🚀 Inicializando página de eventos...");

  try {
    // Verificar autenticación
    const session = checkAuthentication();
    if (!session) return;

    // Actualizar información del usuario
    updateUserInfo(session);

    // Inicializar sidebar
    initializeSidebar();

    // Esperar a que los otros módulos estén disponibles
    await waitForModules();

    // Inicializar módulos en orden específico
    console.log("📊 Inicializando módulos...");

    // 1. Inicializar módulo de creación de eventos
    if (window.initializeCreateEvent) {
      console.log("📝 Inicializando módulo de creación de eventos...");
      window.initializeCreateEvent();
    } else {
      console.warn("⚠️ Módulo de creación de eventos no disponible");
    }

    // 2. Inicializar módulo de eventos futuros
    if (window.initializeUpcomingEvents) {
      console.log("📅 Inicializando módulo de eventos futuros...");
      window.initializeUpcomingEvents();
    } else {
      console.warn("⚠️ Módulo de eventos futuros no disponible");
    }

    // 3. Inicializar módulo de eventos pasados
    if (window.initializePastEvents) {
      console.log("📋 Inicializando módulo de eventos pasados...");
      window.initializePastEvents();
    } else {
      console.warn("⚠️ Módulo de eventos pasados no disponible");
    }

    // Configurar event listeners para las pestañas
    setupTabListeners();

    // Cargar eventos iniciales de la pestaña activa
    loadInitialEvents();

    console.log("✅ Página de eventos inicializada correctamente");
  } catch (error) {
    console.error("❌ Error durante la inicialización:", error);
    alert("Error al inicializar la página. Por favor, recarga la página.");
  }
}

// =============================================
// FUNCIÓN PARA ESPERAR A QUE LOS MÓDULOS SE CARGUEN
// =============================================

async function waitForModules() {
  const maxWait = 5000; // 5 segundos máximo
  const interval = 100; // Verificar cada 100ms
  let waited = 0;

  return new Promise((resolve) => {
    const checkModules = () => {
      const createEventReady =
        typeof window.initializeCreateEvent === "function";
      const upcomingEventsReady =
        typeof window.initializeUpcomingEvents === "function";
      const pastEventsReady = typeof window.initializePastEvents === "function";

      console.log("🔍 Verificando módulos:", {
        createEvent: createEventReady,
        upcomingEvents: upcomingEventsReady,
        pastEvents: pastEventsReady,
        waited: `${waited}ms`,
      });

      if (createEventReady && upcomingEventsReady && pastEventsReady) {
        console.log("✅ Todos los módulos están listos");
        resolve();
        return;
      }

      waited += interval;
      if (waited >= maxWait) {
        console.warn("⚠️ Tiempo de espera agotado para cargar módulos");
        console.log("📊 Estado final de módulos:", {
          createEvent: createEventReady,
          upcomingEvents: upcomingEventsReady,
          pastEvents: pastEventsReady,
        });
        resolve();
        return;
      }

      setTimeout(checkModules, interval);
    };

    checkModules();
  });
}

// =============================================
// CONFIGURACIÓN DE PESTAÑAS
// =============================================

function setupTabListeners() {
  console.log("🏷️ Configurando listeners de pestañas...");

  const upcomingTab = document.getElementById("upcoming-tab");
  const pastTab = document.getElementById("past-tab");

  if (upcomingTab) {
    upcomingTab.addEventListener("shown.bs.tab", function () {
      console.log("📅 Pestaña de eventos futuros activada");
      if (window.loadUpcomingEvents) {
        window.loadUpcomingEvents();
      }
    });
    console.log("✅ Listener configurado para pestaña de eventos futuros");
  } else {
    console.warn("⚠️ Pestaña 'upcoming-tab' no encontrada");
  }

  if (pastTab) {
    pastTab.addEventListener("shown.bs.tab", function () {
      console.log("📋 Pestaña de eventos pasados activada");
      if (window.loadPastEvents) {
        window.loadPastEvents();
      }
    });
    console.log("✅ Listener configurado para pestaña de eventos pasados");
  } else {
    console.warn("⚠️ Pestaña 'past-tab' no encontrada");
  }
}

// =============================================
// FUNCIÓN PARA CARGAR EVENTOS INICIALES
// =============================================

function loadInitialEvents() {
  console.log("🔄 Cargando eventos iniciales...");

  // Determinar qué pestaña está activa
  const activeTab = document.querySelector(".nav-link.active");
  const upcomingPane = document.getElementById("upcoming");

  if (activeTab && activeTab.id === "upcoming-tab") {
    console.log("📅 Cargando eventos futuros (pestaña activa)");
    if (window.loadUpcomingEvents) {
      window.loadUpcomingEvents();
    }
  } else if (upcomingPane && upcomingPane.classList.contains("active")) {
    console.log("📅 Cargando eventos futuros (panel activo)");
    if (window.loadUpcomingEvents) {
      window.loadUpcomingEvents();
    }
  } else if (activeTab && activeTab.id === "past-tab") {
    console.log("📋 Cargando eventos pasados (pestaña activa)");
    if (window.loadPastEvents) {
      window.loadPastEvents();
    }
  } else {
    // Por defecto, cargar eventos futuros
    console.log("📅 Cargando eventos futuros (por defecto)");
    if (window.loadUpcomingEvents) {
      window.loadUpcomingEvents();
    }
  }
}

// =============================================
// FUNCIONES GLOBALES ADICIONALES
// =============================================

// Función para refrescar eventos
window.refreshEvents = function () {
  console.log("🔄 Refrescando eventos...");
  const activeTab = document.querySelector(".nav-link.active");
  if (activeTab && activeTab.id === "past-tab") {
    if (window.loadPastEvents) {
      console.log("📋 Refrescando eventos pasados");
      window.loadPastEvents();
    }
  } else {
    if (window.loadUpcomingEvents) {
      console.log("📅 Refrescando eventos futuros");
      window.loadUpcomingEvents();
    }
  }
};

// Manejar cambios de tamaño de ventana
window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (window.innerWidth >= 992) {
    if (sidebar) sidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }
});

// =============================================
// EXPORTAR FUNCIONES GLOBALES
// =============================================

window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.checkAuthentication = checkAuthentication;
window.updateUserInfo = updateUserInfo;

// =============================================
// EVENT LISTENERS Y INICIALIZACIÓN
// =============================================

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    console.log("📄 DOM cargado, inicializando en 300ms...");
    setTimeout(initializeEventsPage, 300); // Delay más largo para asegurar carga completa
  });
} else {
  console.log("📄 DOM ya cargado, inicializando en 300ms...");
  setTimeout(initializeEventsPage, 300);
}

// =============================================
// FUNCIONES DE UTILIDAD COMPARTIDAS
// =============================================

// Función para mostrar mensajes de error consistentes
window.showError = function (message, error = null) {
  console.error("❌ Error:", message, error);
  alert(`Error: ${message}`);
};

// Función para mostrar mensajes de éxito
window.showSuccess = function (message) {
  console.log("✅ Éxito:", message);
  alert(message);
};

// Función para validar sesión en cualquier módulo
window.validateSession = function () {
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return false;
  }
  return session;
};

// Función de debug para verificar estado de los módulos
window.debugModules = function () {
  console.log("🔍 Estado de los módulos:");
  console.log("- Firebase DB:", !!window.firebaseDB);
  console.log("- Create Event:", typeof window.initializeCreateEvent);
  console.log("- Upcoming Events:", typeof window.initializeUpcomingEvents);
  console.log("- Load Upcoming:", typeof window.loadUpcomingEvents);
  console.log("- Past Events:", typeof window.initializePastEvents);
  console.log("- Current User:", window.currentUser);
};

// Función para forzar recarga de eventos futuros
window.forceLoadUpcoming = function () {
  console.log("🔄 Forzando carga de eventos futuros...");
  if (window.loadUpcomingEvents) {
    window.loadUpcomingEvents();
  } else {
    console.error("❌ Función loadUpcomingEvents no disponible");
  }
};

console.log("🔧 Archivo coordinador events-main.js cargado correctamente");
