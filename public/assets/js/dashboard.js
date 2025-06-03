import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Configuración de Firebase (debe coincidir con el archivo principal)
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

// =============================================
// FUNCIONES DE GESTIÓN DE SESIÓN (ACTUALIZADAS)
// =============================================

let currentUser = null;

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
// INICIALIZACIÓN MEJORADA
// =============================================

async function initializeEventsPage() {
  console.log("🚀 Inicializando página de eventos...");

  // Verificar autenticación PRIMERO
  const session = checkAuthentication();
  if (!session) {
    return; // Si no pasa la verificación, ya fue redirigido
  }

  // Continuar con la inicialización solo si la autenticación es exitosa
  updateUserInfo(session);
  initializeSidebar();
  initializeEventForm();
  await loadUpcomingEvents();

  // Configurar event listeners para las pestañas
  const upcomingTab = document.getElementById("upcoming-tab");
  const pastTab = document.getElementById("past-tab");

  if (upcomingTab) {
    upcomingTab.addEventListener("shown.bs.tab", loadUpcomingEvents);
  }

  if (pastTab) {
    pastTab.addEventListener("shown.bs.tab", loadPastEvents);
  }

  console.log("✅ Página de eventos inicializada correctamente");
}
// =============================================
// FUNCIONES DE NAVEGACIÓN Y UI
// =============================================

// Función para navegar a otras páginas
window.navigateToPage = function (pageName) {
  // Verificar sesión antes de navegar
  const session = getStoredSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  // Para páginas de administrador, verificar permisos
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

// Función para mostrar perfil
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

// Función para mostrar configuración
window.showSettings = function () {
  alert("Página de configuración en desarrollo");
};

// Función para cerrar sesión desde el dashboard
window.handleLogout = function () {
  const confirmed = confirm("¿Estás seguro de que deseas cerrar sesión?");
  if (confirmed) {
    console.log("Cerrando sesión desde dashboard...");

    // Limpiar sesión persistente
    clearSession();

    // Mostrar mensaje y redirigir
    alert("Sesión cerrada exitosamente");
    window.location.href = "index.html";
  }
};

// =============================================
// FUNCIONES DE CARGA DE DATOS
// =============================================

// Función para cargar estadísticas del dashboard
async function loadDashboardStats() {
  try {
    console.log("Cargando estadísticas del dashboard...");

    // Cargar eventos
    const eventosRef = collection(db, "eventos");
    const eventosSnapshot = await getDocs(eventosRef);
    const totalEvents = eventosSnapshot.size;

    // Cargar usuarios
    const usuariosRef = collection(db, "usuarios");
    const usuariosSnapshot = await getDocs(usuariosRef);
    const allUsers = [];
    usuariosSnapshot.forEach((doc) => {
      allUsers.push(doc.data());
    });

    const totalVolunteers = allUsers.filter((user) => !user.esAdmin).length;
    const totalAdmins = allUsers.filter((user) => user.esAdmin).length;

    // Cargar participaciones (asumiendo que existe una colección de participaciones)
    let totalParticipants = 0;
    try {
      const participacionesRef = collection(db, "participaciones");
      const participacionesSnapshot = await getDocs(participacionesRef);
      totalParticipants = participacionesSnapshot.size;
    } catch (error) {
      console.log("Colección de participaciones no encontrada");
    }

    // Actualizar UI con las estadísticas
    updateStatsUI({
      totalEvents,
      totalVolunteers,
      totalAdmins,
      totalParticipants,
    });
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
    // Mostrar valores por defecto en caso de error
    updateStatsUI({
      totalEvents: 0,
      totalVolunteers: 0,
      totalAdmins: 0,
      totalParticipants: 0,
    });
  }
}

// Función para actualizar la UI con las estadísticas
function updateStatsUI(stats) {
  // Actualizar números
  const totalEventsEl = document.getElementById("totalEvents");
  const totalVolunteersEl = document.getElementById("totalVolunteers");
  const totalAdminsEl = document.getElementById("totalAdmins");
  const totalParticipantsEl = document.getElementById("totalParticipants");

  if (totalEventsEl) {
    animateNumber(totalEventsEl, stats.totalEvents);
  }
  if (totalVolunteersEl) {
    animateNumber(totalVolunteersEl, stats.totalVolunteers);
  }
  if (totalAdminsEl) {
    animateNumber(totalAdminsEl, stats.totalAdmins);
  }
  if (totalParticipantsEl) {
    animateNumber(totalParticipantsEl, stats.totalParticipants);
  }

  // Actualizar cambios estadísticos
  updateStatChanges(stats);
}

// Función para animar números
function animateNumber(element, finalNumber) {
  const duration = 1000; // 1 segundo
  const steps = 30;
  const stepValue = finalNumber / steps;
  const stepDuration = duration / steps;

  let currentNumber = 0;
  const timer = setInterval(() => {
    currentNumber += stepValue;
    if (currentNumber >= finalNumber) {
      currentNumber = finalNumber;
      clearInterval(timer);
    }
    element.textContent = Math.floor(currentNumber);
  }, stepDuration);
}

// Función para actualizar cambios estadísticos
function updateStatChanges(stats) {
  // Esta función podría comparar con estadísticas anteriores
  // Por ahora, mostraremos estados estáticos

  const changes = document.querySelectorAll(".stat-change");
  changes.forEach((change, index) => {
    switch (index) {
      case 0: // Eventos
        change.innerHTML = '<i class="fas fa-arrow-up"></i> +2 este mes';
        break;
      case 1: // Voluntarios
        change.innerHTML = `<i class="fas fa-arrow-up"></i> ${stats.totalVolunteers} registrados`;
        break;
      case 2: // Administradores
        change.innerHTML = `<i class="fas fa-minus"></i> ${stats.totalAdmins} activos`;
        break;
      case 3: // Participaciones
        change.innerHTML = '<i class="fas fa-arrow-up"></i> +15 este mes';
        break;
    }
  });
}
// Función mejorada para cargar eventos recientes
async function loadRecentEvents() {
  try {
    console.log("🔄 Cargando eventos recientes...");

    const eventosRef = collection(db, "eventos");

    // Cargar TODOS los eventos sin restricciones primero
    const querySnapshot = await getDocs(eventosRef);

    console.log(
      `📊 Total de eventos en la base de datos: ${querySnapshot.size}`
    );

    const events = [];
    querySnapshot.forEach((doc) => {
      const eventData = { id: doc.id, ...doc.data() };
      console.log("📅 Evento encontrado:", {
        id: doc.id,
        titulo: eventData.titulo || eventData.nombre,
        fechaInicio: eventData.fechaInicio,
        fechaCreacion: eventData.fechaCreacion,
      });
      events.push(eventData);
    });

    // Ordenar eventos por múltiples criterios
    const sortedEvents = events.sort((a, b) => {
      // 1. Primero por fechaCreacion si existe
      if (a.fechaCreacion && b.fechaCreacion) {
        const dateA = new Date(a.fechaCreacion);
        const dateB = new Date(b.fechaCreacion);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime(); // Más reciente primero
        }
      }

      // 2. Luego por fechaInicio si existe
      if (a.fechaInicio && b.fechaInicio) {
        const dateA = new Date(a.fechaInicio);
        const dateB = new Date(b.fechaInicio);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime(); // Más reciente primero
        }
      }

      // 3. Si uno tiene fecha y el otro no, priorizar el que tiene fecha
      if (a.fechaInicio && !b.fechaInicio) return -1;
      if (!a.fechaInicio && b.fechaInicio) return 1;

      // 4. Como último recurso, ordenar alfabéticamente por título
      const titleA = (a.titulo || a.nombre || "").toLowerCase();
      const titleB = (b.titulo || b.nombre || "").toLowerCase();
      return titleA.localeCompare(titleB);
    });

    console.log(`✅ Eventos ordenados: ${sortedEvents.length}`);

    // Tomar los primeros 5 para mostrar
    const recentEvents = sortedEvents.slice(0, 5);

    // Log de eventos que se van a mostrar
    console.log("🎯 Eventos que se mostrarán:");
    recentEvents.forEach((event, index) => {
      console.log(
        `${index + 1}. ${event.titulo || event.nombre} - ${event.fechaInicio}`
      );
    });

    // Actualizar tabla de eventos
    updateEventsTable(recentEvents);
  } catch (error) {
    console.error("❌ Error al cargar eventos:", error);
    // En caso de error, intentar una consulta más simple
    await loadEventsSimple();
  }
}

// Función de respaldo con consulta simple
async function loadEventsSimple() {
  try {
    console.log("🔄 Intentando carga simple de eventos...");
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    // Mostrar todos los eventos encontrados (limitado a 10)
    const limitedEvents = events.slice(0, 10);
    updateEventsTable(limitedEvents);

    console.log(`✅ Carga simple completada: ${limitedEvents.length} eventos`);
  } catch (error) {
    console.error("❌ Error en carga simple:", error);
    updateEventsTable([]);
  }
}

// Función COMPLETAMENTE MEJORADA para actualizar la tabla de eventos
function updateEventsTable(events) {
  const eventsTable = document.getElementById("eventsTable");
  if (!eventsTable) {
    console.error("❌ Elemento eventsTable no encontrado en el DOM");
    return;
  }

  console.log(`🔄 Actualizando tabla con ${events.length} eventos`);

  if (events.length === 0) {
    eventsTable.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4">
          <div class="d-flex flex-column align-items-center">
            <i class="fas fa-calendar-times fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">No hay eventos registrados</h5>
            <p class="text-muted mb-0">Los eventos aparecerán aquí una vez creados</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let tableHTML = "";
  events.forEach((event, index) => {
    console.log(`🔧 Procesando evento ${index + 1}:`, {
      id: event.id,
      titulo: event.titulo || event.nombre,
      ubicacion: event.ubicacion || event.ubicación,
      fechaInicio: event.fechaInicio,
      cantidadVoluntarios: event.cantidadVoluntarios || event.voluntarios,
    });

    // Manejo robusto de fechas
    let fechaInicio = " No definida";
    let fechaOriginal = null;

    if (event.fechaInicio) {
      try {
        // Intentar diferentes formatos de fecha
        let fecha;

        // Si es un string que parece una fecha ISO
        if (
          typeof event.fechaInicio === "string" &&
          event.fechaInicio.includes("-")
        ) {
          fecha = new Date(event.fechaInicio);
        }
        // Si es un timestamp de Firestore
        else if (event.fechaInicio.seconds) {
          fecha = new Date(event.fechaInicio.seconds * 1000);
        }
        // Si es un número (timestamp)
        else if (typeof event.fechaInicio === "number") {
          fecha = new Date(event.fechaInicio);
        }
        // Cualquier otro caso
        else {
          fecha = new Date(event.fechaInicio);
        }

        if (!isNaN(fecha.getTime())) {
          fechaOriginal = fecha;
          fechaInicio = fecha.toLocaleDateString("es-ES", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        } else {
          fechaInicio = `📅 ${event.fechaInicio}`;
        }
      } catch (error) {
        console.error("❌ Error al formatear fecha:", error);
        fechaInicio = `📅 ${event.fechaInicio}`;
      }
    }

    // Determinar estado del evento
    const estado = getEventStatus(event, fechaOriginal);

    // Manejo de ubicación
    const ubicacion =
      event.ubicacion || event.ubicación || "📍 No especificada";

    // Manejo de voluntarios
    const voluntarios =
      event.cantidadVoluntarios || event.voluntarios || event.capacidad || 0;

    // Manejo de título y descripción
    const titulo = event.titulo || event.nombre || "Sin nombre";
    const descripcion = event.descripcion || event.resumen || "Sin descripción";

    tableHTML += `
      <tr class="align-middle">
        <td>
          <div class="d-flex flex-column">
            <div class="fw-bold text-dark">${titulo}</div>
            <small class="text-muted">${
              descripcion.length > 60
                ? descripcion.substring(0, 60) + "..."
                : descripcion
            }</small>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-map-marker-alt text-primary me-2"></i>
            <span>${ubicacion}</span>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <i class="fas fa-calendar text-info me-2"></i>
            <span>${fechaInicio}</span>
          </div>
        </td>
        <td>
          <span class="badge bg-primary rounded-pill px-3 py-2">
            <i class="fas fa-users me-1"></i>
            ${voluntarios}
          </span>
        </td>
        <td>
          <span class="badge ${estado.class} px-3 py-2">${estado.text}</span>
        </td>
      </tr>
    `;
  });

  eventsTable.innerHTML = tableHTML;
  console.log("✅ Tabla de eventos actualizada correctamente");
}

// Función MEJORADA para determinar el estado del evento
function getEventStatus(event, fechaDate = null) {
  // Si no hay fecha, es pendiente
  if (!event.fechaInicio) {
    return { class: "bg-secondary text-white", text: "⏳ Pendiente" };
  }

  try {
    const now = new Date();
    let startDate = fechaDate;

    // Si no se pasó la fecha ya procesada, procesarla
    if (!startDate) {
      if (typeof event.fechaInicio === "string") {
        startDate = new Date(event.fechaInicio);
      } else if (event.fechaInicio.seconds) {
        startDate = new Date(event.fechaInicio.seconds * 1000);
      } else {
        startDate = new Date(event.fechaInicio);
      }
    }

    // Verificar si la fecha es válida
    if (isNaN(startDate.getTime())) {
      return { class: "bg-warning text-dark", text: "⚠️ Fecha inválida" };
    }

    // Manejo de fecha de fin
    let endDate = null;
    if (event.fechaFin) {
      try {
        if (typeof event.fechaFin === "string") {
          endDate = new Date(event.fechaFin);
        } else if (event.fechaFin.seconds) {
          endDate = new Date(event.fechaFin.seconds * 1000);
        } else {
          endDate = new Date(event.fechaFin);
        }

        if (isNaN(endDate.getTime())) {
          endDate = null;
        }
      } catch (error) {
        endDate = null;
      }
    }

    // Determinar estado
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventStart = new Date(startDate);
    eventStart.setHours(0, 0, 0, 0);
    const eventEnd = endDate ? new Date(endDate) : null;
    if (eventEnd) eventEnd.setHours(23, 59, 59, 999);

    if (eventEnd && today > eventEnd) {
      return { class: "bg-success text-white", text: "✅ Completado" };
    } else if (today >= eventStart && (!eventEnd || today <= eventEnd)) {
      return { class: "bg-warning text-dark", text: "🔥 En curso" };
    } else if (today < eventStart) {
      const diffDays = Math.ceil((eventStart - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return { class: "bg-info text-white", text: `🔜 En ${diffDays}d` };
      } else {
        return { class: "bg-info text-white", text: "📅 Próximo" };
      }
    }

    return { class: "bg-secondary text-white", text: "⏳ Pendiente" };
  } catch (error) {
    console.error("❌ Error al determinar estado del evento:", error);
    return { class: "bg-danger text-white", text: "❌ Error" };
  }
}

// Función DEBUG mejorada
window.debugEvents = async function () {
  try {
    console.log("🔍 === DEBUG COMPLETO DE EVENTOS ===");
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    console.log(
      `📊 Total de eventos en la base de datos: ${querySnapshot.size}`
    );

    if (querySnapshot.size === 0) {
      console.log("❌ No se encontraron eventos en la base de datos");
      return;
    }

    const allEvents = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allEvents.push({
        id: doc.id,
        ...data,
      });

      console.log("📋 ===== EVENTO =====");
      console.log("🆔 ID:", doc.id);
      console.log("📝 Título:", data.titulo || data.nombre || "SIN TÍTULO");
      console.log("📅 Fecha inicio:", data.fechaInicio);
      console.log("🕐 Fecha creación:", data.fechaCreacion);
      console.log("📍 Ubicación:", data.ubicacion || data.ubicación);
      console.log(
        "👥 Voluntarios:",
        data.cantidadVoluntarios || data.voluntarios
      );
      console.log("📄 Descripción:", data.descripcion || "SIN DESCRIPCIÓN");
      console.log("🗂️ Todos los campos:", Object.keys(data));
      console.log("===================");
    });

    // Buscar específicamente eventos del 28 de mayo
    console.log("🔍 Buscando eventos del 28 de mayo...");
    const eventosDelDia = allEvents.filter((event) => {
      if (!event.fechaInicio) return false;

      try {
        let fecha;
        if (typeof event.fechaInicio === "string") {
          fecha = new Date(event.fechaInicio);
        } else if (event.fechaInicio.seconds) {
          fecha = new Date(event.fechaInicio.seconds * 1000);
        } else {
          fecha = new Date(event.fechaInicio);
        }

        if (isNaN(fecha.getTime())) return false;

        return fecha.getDate() === 28 && fecha.getMonth() === 4; // Mayo es mes 4 (0-indexed)
      } catch (error) {
        return false;
      }
    });

    console.log(
      `🎯 Eventos del 28 de mayo encontrados: ${eventosDelDia.length}`
    );
    eventosDelDia.forEach((event) => {
      console.log("📅 Evento del 28:", {
        id: event.id,
        titulo: event.titulo || event.nombre,
        fecha: event.fechaInicio,
      });
    });

    // Verificar si el elemento tabla existe
    const table = document.getElementById("eventsTable");
    console.log("🔧 Elemento tabla encontrado:", !!table);

    return allEvents;
  } catch (error) {
    console.error("❌ Error en debug:", error);
  }
};

// Función para forzar recarga de eventos
window.forceReloadEvents = async function () {
  console.log("🔄 Forzando recarga de eventos...");
  await loadRecentEvents();
};

// Función para mostrar TODOS los eventos (sin límite)
window.showAllEvents = async function () {
  try {
    console.log("📋 Mostrando TODOS los eventos...");
    const eventosRef = collection(db, "eventos");
    const querySnapshot = await getDocs(eventosRef);

    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📊 Total eventos: ${events.length}`);
    updateEventsTable(events); // Mostrar todos sin límite
  } catch (error) {
    console.error("❌ Error al mostrar todos los eventos:", error);
  }
};
// =============================================
// FUNCIONES DE SIDEBAR Y NAVEGACIÓN
// =============================================

// Función para toggle del sidebar en móviles
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

  // Manejar clicks en los enlaces del sidebar
  const navLinks = document.querySelectorAll(".nav-link[data-section]");
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      // Remover clase active de todos los enlaces
      navLinks.forEach((l) => l.classList.remove("active"));
      // Agregar clase active al enlace clickeado
      this.classList.add("active");

      // Cerrar sidebar en móviles
      if (window.innerWidth < 992) {
        sidebar.classList.remove("show");
        sidebarOverlay.classList.remove("show");
      }
    });
  });
}

// =============================================
// FUNCIONES DE INICIALIZACIÓN
// =============================================

// Función principal de inicialización del dashboard
async function initializeDashboard() {
  console.log("Inicializando dashboard...");

  // Verificar autenticación
  const session = checkAuthentication();
  if (!session) return;

  // Actualizar información del usuario en la UI
  updateUserInfo(session);

  // Inicializar sidebar
  initializeSidebar();

  // Cargar datos del dashboard
  await loadDashboardStats();
  await loadRecentEvents();

  console.log("Dashboard inicializado correctamente");
}

// Función para actualizar información del usuario en la UI
function updateUserInfo(session) {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName) {
    userDisplayName.textContent = session.nombre || session.correo;
  }

  // Actualizar mensaje de bienvenida si existe
  const welcomeSection = document.querySelector(".welcome-section h2");
  if (welcomeSection) {
    welcomeSection.textContent = `¡Bienvenido${
      session.nombre ? ", " + session.nombre : ""
    }!`;
  }
}

// =============================================
// EVENT LISTENERS Y INICIALIZACIÓN
// =============================================

// Inicializar cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM cargado, inicializando dashboard...");
  initializeDashboard();
});

// Manejar cambios de tamaño de ventana
window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  // Cerrar sidebar en pantallas grandes
  if (window.innerWidth >= 992) {
    if (sidebar) sidebar.classList.remove("show");
    if (sidebarOverlay) sidebarOverlay.classList.remove("show");
  }
});

// =============================================
// FUNCIONES ADICIONALES PARA DESARROLLO
// =============================================

// Función para mostrar información de debug
window.showDebugInfo = function () {
  const session = getStoredSession();
  console.log("Información de sesión:", session);
  console.log("Página actual:", window.location.pathname);
  console.log("Usuario autenticado:", !!session);
  console.log("Es administrador:", session?.esAdmin || false);
};

// Función para refrescar datos del dashboard
window.refreshDashboard = async function () {
  console.log("Refrescando datos del dashboard...");
  await loadDashboardStats();
  await loadRecentEvents();
  console.log("Dashboard actualizado");
};

// Exportar funciones para uso global
window.getStoredSession = getStoredSession;
window.clearSession = clearSession;
window.checkAuthentication = checkAuthentication;
