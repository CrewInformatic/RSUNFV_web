/* eslint-disable no-console */
// users-profile-service.js - Gestión de Perfil de Usuario y Estadísticas OPTIMIZADO
// OPTIMIZACIONES: Carga inmediata, cache mejorado, operaciones paralelas

import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onAuthStateChanged,
} from "./firebase_config.js";

// =============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// =============================================

/**
 * Configuración del módulo optimizada
 */
const USER_PROFILE_CONFIG = {
  SESSION_KEY: "userSession",
  PROFILE_CACHE_KEY: "userProfileCache",
  CACHE_DURATION: 15 * 60 * 1000, // 15 minutos (aumentado)
  STATISTICS_CACHE_DURATION: 5 * 60 * 1000, // 5 minutos para estadísticas
  RETRY_ATTEMPTS: 2, // Reducido para mayor velocidad
  RETRY_DELAY: 500, // Reducido a 500ms
  UI_UPDATE_DELAY: 0, // Sin delay para UI
};

/**
 * Variables globales del módulo
 */
let currentUserSession = null;
const profileCache = new Map();
let isProfileLoading = false;
let statisticsCache = null;
let lastStatisticsUpdate = null;
let pendingProfileRequest = null; // Para evitar múltiples requests

// Cache en localStorage para persistencia entre sesiones
const PERSISTENT_CACHE_KEY = "ecovoluntarios_cache";

// =============================================
// FUNCIONES DE UTILIDAD OPTIMIZADAS
// =============================================

/**
 * Muestra notificaciones toast (versión optimizada)
 * @param {string} title - Título del toast
 * @param {string} message - Mensaje del toast
 * @param {string} type - Tipo de toast (info, error, success, warning)
 */
function showToast(title, message, type = "info") {
  try {
    const toastElement = document.getElementById("liveToast");
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");

    if (!toastElement || !toastTitle || !toastBody) {
      // Solo mostrar en consola si no hay elementos toast (evita spam)
      if (type === "error") {
        console.warn(`${title}: ${message}`);
      }
      return;
    }

    toastTitle.textContent = title;
    toastBody.textContent = message;
    toastElement.className = `toast show toast-${type}`;

    // eslint-disable-next-line no-undef
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
  } catch (error) {
    console.error("❌ Error al mostrar toast:", error);
  }
}

/**
 * Maneja errores de manera optimizada
 * @param {Error} error - Error a manejar
 * @param {string} context - Contexto donde ocurrió el error
 * @param {boolean} showUser - Si mostrar el error al usuario
 */
function handleError(error, context, showUser = false) {
  console.error(`❌ Error en ${context}:`, error);

  if (showUser) {
    showToast(
      "Error",
      `Problema ${context}. Intentando nuevamente...`,
      "error"
    );
  }
}

/**
 * Cache persistente optimizado
 */
const PersistentCache = {
  /**
   * Obtiene un elemento del cache
   * @param {string} key - Clave del elemento
   * @returns {any|null} Datos del cache o null si no existe/expiró
   */
  get(key) {
    try {
      const cache = JSON.parse(
        localStorage.getItem(PERSISTENT_CACHE_KEY) || "{}"
      );
      const item = cache[key];

      if (item && Date.now() - item.timestamp < item.ttl) {
        return item.data;
      }

      // Limpiar entrada expirada
      this.delete(key);
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Guarda un elemento en el cache
   * @param {string} key - Clave del elemento
   * @param {any} data - Datos a guardar
   * @param {number} ttl - Tiempo de vida del cache
   */
  set(key, data, ttl = USER_PROFILE_CONFIG.CACHE_DURATION) {
    try {
      const cache = JSON.parse(
        localStorage.getItem(PERSISTENT_CACHE_KEY) || "{}"
      );
      cache[key] = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn("⚠️ Error al guardar en cache persistente:", error);
    }
  },

  /**
   * Elimina un elemento del cache
   * @param {string} key - Clave del elemento a eliminar
   */
  delete(key) {
    try {
      const cache = JSON.parse(
        localStorage.getItem(PERSISTENT_CACHE_KEY) || "{}"
      );
      delete cache[key];
      localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      // Ignorar errores de eliminación
    }
  },

  /**
   * Limpia todo el cache
   */
  clear() {
    try {
      localStorage.removeItem(PERSISTENT_CACHE_KEY);
    } catch (error) {
      // Ignorar errores
    }
  },
};

// =============================================
// GESTIÓN DE SESIÓN OPTIMIZADA
// =============================================

/**
 * Obtiene la sesión almacenada (optimizado)
 * @returns {Object|null} Datos de sesión o null
 */
function getStoredSession() {
  if (currentUserSession) {
    return currentUserSession;
  }

  try {
    const storedSession = sessionStorage.getItem(
      USER_PROFILE_CONFIG.SESSION_KEY
    );
    if (storedSession) {
      const parsedSession = JSON.parse(storedSession);
      currentUserSession = parsedSession;
      return parsedSession;
    }
  } catch (error) {
    console.error("❌ Error al obtener sesión:", error);
    sessionStorage.removeItem(USER_PROFILE_CONFIG.SESSION_KEY);
  }

  return null;
}

/**
 * Almacena la sesión del usuario (optimizado)
 * @param {Object} sessionData - Datos de sesión a almacenar
 */
function storeSession(sessionData) {
  try {
    currentUserSession = sessionData;
    sessionStorage.setItem(
      USER_PROFILE_CONFIG.SESSION_KEY,
      JSON.stringify(sessionData)
    );
  } catch (error) {
    console.error("❌ Error al almacenar sesión:", error);
  }
}

/**
 * Limpia la sesión del usuario (optimizado)
 */
function clearSession() {
  try {
    currentUserSession = null;
    sessionStorage.removeItem(USER_PROFILE_CONFIG.SESSION_KEY);
    profileCache.clear();
    PersistentCache.clear();
    statisticsCache = null;
    lastStatisticsUpdate = null;
    pendingProfileRequest = null;
  } catch (error) {
    console.error("❌ Error al limpiar sesión:", error);
  }
}

/**
 * Verifica autenticación (optimizado)
 * @returns {Object|null} Sesión válida o null
 */
function checkAuthentication() {
  const session = getStoredSession();

  if (!session) {
    showToast(
      "Sesión expirada",
      "Por favor, inicia sesión nuevamente",
      "warning"
    );
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
    return null;
  }

  // Verificación rápida de permisos admin
  const currentPage = window.location.pathname.split("/").pop();
  const adminPages = [
    "usuarios.html",
    "administradores.html",
    "eventos.html",
    "configuracion.html",
    "reportes.html",
  ];

  if (adminPages.includes(currentPage) && !session.esAdmin) {
    showToast("Acceso denegado", "Sin permisos para esta página", "error");
    setTimeout(() => {
      window.location.href = "descarga_app.html";
    }, 1500);
    return null;
  }

  return session;
}

// =============================================
// GESTIÓN DEL PERFIL OPTIMIZADA
// =============================================

/**
 * Actualiza inmediatamente la UI con datos de sesión
 * @param {Object} session - Datos de sesión
 */
function updateUIImmediate(session) {
  try {
    const userDisplayName = document.getElementById("userDisplayName");
    if (userDisplayName && session) {
      // CAMBIO: Solo usar el primer nombre
      let displayName = "Usuario";

      if (session.nombreUsuario) {
        // SOLO el nombre, sin apellido
        displayName = session.nombreUsuario;
      } else if (session.correo) {
        displayName = session.correo.split("@")[0];
      }

      userDisplayName.textContent = displayName;
    }

    // Mostrar indicador de admin inmediatamente
    updateAdminIndicator(session?.esAdmin || false);
  } catch (error) {
    console.error("❌ Error al actualizar UI inmediata:", error);
  }
}

/**
 * Actualiza indicador de administrador
 * @param {boolean} isAdmin - Si el usuario es administrador
 */
function updateAdminIndicator(isAdmin) {
  try {
    const pageTitle = document.querySelector(".page-title");
    if (pageTitle && isAdmin) {
      const currentTitle = pageTitle.textContent;
      if (!currentTitle.includes("👑")) {
        pageTitle.innerHTML = `👑 ${currentTitle}`;
      }
    }

    // Actualizar elementos según permisos
    const adminOnlyElements = document.querySelectorAll("[data-admin-only]");
    adminOnlyElements.forEach((element) => {
      const el = element;
      el.style.display = isAdmin ? "block" : "none";
    });

    const nonAdminElements = document.querySelectorAll("[data-non-admin]");
    nonAdminElements.forEach((element) => {
      const el = element;
      el.style.display = isAdmin ? "none" : "block";
    });
  } catch (error) {
    console.error("❌ Error al actualizar indicador admin:", error);
  }
}

/**
 * Obtiene el perfil del usuario (optimizado con cache)
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Datos del perfil
 */
async function fetchUserProfile(userId) {
  try {
    if (!userId) {
      throw new Error("ID de usuario no proporcionado");
    }

    const cacheKey = `profile_${userId}`;

    // 1. Verificar cache en memoria
    const memoryCache = profileCache.get(cacheKey);
    if (
      memoryCache &&
      Date.now() - memoryCache.timestamp < USER_PROFILE_CONFIG.CACHE_DURATION
    ) {
      return memoryCache.data;
    }

    // 2. Verificar cache persistente
    const persistentCache = PersistentCache.get(cacheKey);
    if (persistentCache) {
      // Actualizar cache en memoria
      profileCache.set(cacheKey, {
        data: persistentCache,
        timestamp: Date.now(),
      });
      return persistentCache;
    }

    // 3. Evitar múltiples requests simultáneos
    if (pendingProfileRequest) {
      return await pendingProfileRequest;
    }

    // 4. Hacer request a Firestore
    pendingProfileRequest = fetchProfileFromFirestore(userId);
    const profileData = await pendingProfileRequest;
    pendingProfileRequest = null;

    // 5. Guardar en ambos caches
    profileCache.set(cacheKey, {
      data: profileData,
      timestamp: Date.now(),
    });
    PersistentCache.set(cacheKey, profileData);

    return profileData;
  } catch (error) {
    pendingProfileRequest = null;
    handleError(error, "al obtener el perfil del usuario", false);
    throw error;
  }
}

/**
 * Obtiene perfil desde Firestore con operaciones paralelas
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Datos del perfil enriquecidos
 */
async function fetchProfileFromFirestore(userId) {
  const userDocRef = doc(db, "usuarios", userId);
  const userSnapshot = await getDoc(userDocRef);

  if (!userSnapshot.exists()) {
    throw new Error("Perfil de usuario no encontrado");
  }

  const profileData = userSnapshot.data();

  // Enriquecer datos en paralelo para mayor velocidad
  const enrichedProfile = await enrichUserProfileParallel(profileData);

  return enrichedProfile;
}

/**
 * Enriquece el perfil con operaciones paralelas - VERSIÓN CORREGIDA
 * @param {Object} profileData - Datos básicos del perfil
 * @returns {Promise<Object>} Datos del perfil enriquecidos
 */
async function enrichUserProfileParallel(profileData) {
  try {
    const enrichedData = { ...profileData };

    // Ejecutar consultas en paralelo
    const promises = [];

    // Obtener escuela - CORREGIDO
    if (profileData.escuelaID) {
      promises.push(
        (async () => {
          try {
            // Buscar en la colección 'escuela' por el campo 'idEscuela'
            const escuelaQuery = query(
              collection(db, "escuela"),
              where("idEscuela", "==", profileData.escuelaID)
            );
            const escuelaSnapshot = await getDocs(escuelaQuery);

            if (!escuelaSnapshot.empty) {
              const escuelaDoc = escuelaSnapshot.docs[0];
              enrichedData.nombreEscuela =
                escuelaDoc.data().nombreEscuela || "Escuela no encontrada";
            } else {
              enrichedData.nombreEscuela = "Escuela no encontrada";
            }
          } catch (error) {
            console.warn("Error al obtener escuela:", error);
            enrichedData.nombreEscuela = "Escuela no disponible";
          }
        })()
      );
    }

    // Obtener facultad - CORREGIDO
    if (profileData.facultadID) {
      promises.push(
        (async () => {
          try {
            // Buscar en la colección 'facultad' por el campo 'idFacultad'
            const facultadQuery = query(
              collection(db, "facultad"),
              where("idFacultad", "==", profileData.facultadID)
            );
            const facultadSnapshot = await getDocs(facultadQuery);

            if (!facultadSnapshot.empty) {
              const facultadDoc = facultadSnapshot.docs[0];
              enrichedData.nombreFacultad =
                facultadDoc.data().nombreFacultad || "Facultad no encontrada";
            } else {
              enrichedData.nombreFacultad = "Facultad no encontrada";
            }
          } catch (error) {
            console.warn("Error al obtener facultad:", error);
            enrichedData.nombreFacultad = "Facultad no disponible";
          }
        })()
      );
    }

    // Esperar todas las consultas (máximo 2 segundos)
    await Promise.allSettled(promises);

    // Calcular días desde registro
    if (profileData.fechaRegistro) {
      const registroDate = new Date(profileData.fechaRegistro);
      const today = new Date();
      const diffTime = Math.abs(today - registroDate);
      enrichedData.diasDesdeRegistro = Math.ceil(
        diffTime / (1000 * 60 * 60 * 24)
      );
    }

    // CAMBIO: Crear nombre completo SOLO con el primer nombre
    if (profileData.nombreUsuario) {
      enrichedData.nombreCompleto = profileData.nombreUsuario; // SOLO EL NOMBRE
    }

    return enrichedData;
  } catch (error) {
    console.warn("⚠️ Error al enriquecer perfil:", error);
    return profileData;
  }
}

/**
 * Actualiza la interfaz con el perfil completo
 * @param {Object} userProfile - Datos del perfil del usuario
 */
function updateUserInterface(userProfile) {
  try {
    const userDisplayName = document.getElementById("userDisplayName");
    if (userDisplayName && userProfile) {
      let displayName = "Usuario";

      // CAMBIO: Solo usar el primer nombre
      if (userProfile.nombreUsuario) {
        displayName = userProfile.nombreUsuario; // SOLO EL NOMBRE
      } else if (userProfile.correo) {
        displayName = userProfile.correo.split("@")[0];
      }

      userDisplayName.textContent = displayName;

      // Actualizar sesión con nombre completo para próximas cargas
      const session = getStoredSession();
      if (session) {
        session.nombreCompleto = displayName; // SOLO EL NOMBRE
        session.nombreUsuario = userProfile.nombreUsuario;
        // NO guardar apellidoUsuario en la sesión
        storeSession(session);
      }
    }

    updateAdminIndicator(userProfile?.esAdmin || false);
  } catch (error) {
    console.error("❌ Error al actualizar interfaz:", error);
  }
}

// =============================================
// GESTIÓN DE ESTADÍSTICAS OPTIMIZADA
// =============================================

/**
 * Obtiene estadísticas con cache optimizado
 * @returns {Promise<Object>} Estadísticas del sistema
 */
async function fetchUserStatistics() {
  try {
    // Verificar cache de estadísticas
    if (
      statisticsCache &&
      lastStatisticsUpdate &&
      Date.now() - lastStatisticsUpdate <
        USER_PROFILE_CONFIG.STATISTICS_CACHE_DURATION
    ) {
      return statisticsCache;
    }

    // Verificar cache persistente para estadísticas
    const cachedStats = PersistentCache.get("user_statistics");
    if (cachedStats) {
      statisticsCache = cachedStats;
      lastStatisticsUpdate = Date.now();
      return cachedStats;
    }

    // Obtener estadísticas desde Firestore
    const usuariosRef = collection(db, "usuarios");
    const usuariosSnapshot = await getDocs(usuariosRef);

    if (usuariosSnapshot.empty) {
      const emptyStats = {
        totalUsuarios: 0,
        usuariosActivos: 0,
        escuelasRepresentadas: 0,
        rolesDisponibles: 2,
        usuariosInactivos: 0,
        porcentajeActivos: 0,
      };
      return emptyStats;
    }

    // Procesar datos de manera eficiente
    const escuelasSet = new Set();
    let usuariosActivos = 0;
    let totalUsuarios = 0;

    usuariosSnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      totalUsuarios += 1;

      if (userData.estadoActivo) {
        usuariosActivos += 1;
      }

      if (userData.escuelaID) {
        escuelasSet.add(userData.escuelaID);
      }
    });

    const statistics = {
      totalUsuarios,
      usuariosActivos,
      escuelasRepresentadas: escuelasSet.size,
      rolesDisponibles: 2,
      usuariosInactivos: totalUsuarios - usuariosActivos,
      porcentajeActivos:
        totalUsuarios > 0
          ? Math.round((usuariosActivos / totalUsuarios) * 100)
          : 0,
    };

    // Guardar en caches
    statisticsCache = statistics;
    lastStatisticsUpdate = Date.now();
    PersistentCache.set(
      "user_statistics",
      statistics,
      USER_PROFILE_CONFIG.STATISTICS_CACHE_DURATION
    );

    return statistics;
  } catch (error) {
    handleError(error, "al obtener estadísticas", false);
    return {
      totalUsuarios: 0,
      usuariosActivos: 0,
      escuelasRepresentadas: 0,
      rolesDisponibles: 2,
      usuariosInactivos: 0,
      porcentajeActivos: 0,
    };
  }
}

/**
 * Actualiza tarjetas de estadísticas con animación optimizada
 * @param {Object} statistics - Estadísticas a mostrar
 */
function updateStatisticsCards(statistics) {
  try {
    const cardMappings = [
      { id: "totalUsersCount", value: statistics.totalUsuarios },
      { id: "activeUsersCount", value: statistics.usuariosActivos },
      { id: "schoolsCount", value: statistics.escuelasRepresentadas },
      { id: "rolesCount", value: statistics.rolesDisponibles },
    ];

    cardMappings.forEach(({ id, value }) => {
      const element = document.getElementById(id);
      if (element) {
        // Animación más rápida para mejor UX
        animateCounterFast(element, 0, value, 800);
      }
    });
  } catch (error) {
    console.error("❌ Error al actualizar tarjetas:", error);
  }
}

/**
 * Animación de contador optimizada
 * @param {HTMLElement} element - Elemento a animar
 * @param {number} start - Valor inicial
 * @param {number} end - Valor final
 * @param {number} duration - Duración de la animación
 */
function animateCounterFast(element, start, end, duration) {
  try {
    if (start === end) {
      element.textContent = end.toLocaleString();
      return;
    }

    const startTime = performance.now();
    const range = end - start;

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing más suave
      const easeOut = 1 - Math.pow(1 - progress, 2);
      const currentValue = Math.round(start + range * easeOut);

      element.textContent = currentValue.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    }

    requestAnimationFrame(updateCounter);
  } catch (error) {
    console.error("❌ Error en animación:", error);
    element.textContent = end.toLocaleString();
  }
}

// =============================================
// FUNCIONES DE NAVEGACIÓN Y ACCIONES
// =============================================

/**
 * Navega a una página específica
 * @param {string} pageName - Nombre de la página
 */
function navigateToPage(pageName) {
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
    showToast(
      "Acceso denegado",
      "No tienes permisos para acceder a esta página",
      "error"
    );
    return;
  }

  window.location.href = pageName;
}

/**
 * Muestra el perfil del usuario (optimizado)
 */
async function showProfile() {
  try {
    const session = getStoredSession();
    if (!session) return;

    if (isProfileLoading) return; // Evitar múltiples clicks
    isProfileLoading = true;

    const userProfile = await fetchUserProfile(
      session.uid || session.idUsuario
    );

    if (!userProfile) {
      throw new Error("No se pudo obtener el perfil del usuario");
    }

    // CAMBIO: Mostrar solo el nombre
    const profileInfo = `
Información del Perfil:

Nombre: ${userProfile.nombreUsuario} ${userProfile.apellidoUsuario || ""}
Correo: ${userProfile.correo || "No disponible"}
Código: ${userProfile.codigoUsuario || "No disponible"}
Escuela: ${userProfile.nombreEscuela || "No disponible"}
Facultad: ${userProfile.nombreFacultad || "No disponible"}
Ciclo: ${userProfile.ciclo || "No disponible"}
Edad: ${userProfile.edad || "No disponible"} años
Rol: ${userProfile.esAdmin ? "Administrador" : "Colaborador"}
Estado: ${userProfile.estadoActivo ? "Activo" : "Inactivo"}
Registrado: ${
      userProfile.diasDesdeRegistro
        ? `hace ${userProfile.diasDesdeRegistro} días`
        : "Fecha no disponible"
    }
Último acceso: ${
      session.loginTime
        ? new Date(session.loginTime).toLocaleString()
        : "No disponible"
    }
    `.trim();

    // eslint-disable-next-line no-alert
    alert(profileInfo);
  } catch (error) {
    handleError(error, "al mostrar el perfil", true);
  } finally {
    isProfileLoading = false;
  }
}

/**
 * Configuración placeholder
 */
function showSettings() {
  showToast("En desarrollo", "Configuración disponible pronto", "info");
}

/**
 * Maneja el cierre de sesión
 */
function handleLogout() {
  try {
    // eslint-disable-next-line no-alert
    if (!confirm("¿Estás seguro de que deseas cerrar sesión?")) return;

    clearSession();

    if (auth?.currentUser) {
      auth
        .signOut()
        .catch((error) =>
          console.warn("⚠️ Error al cerrar sesión de Firebase:", error)
        );
    }

    showToast("Sesión cerrada", "Has cerrado sesión exitosamente", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  } catch (error) {
    handleError(error, "al cerrar sesión");
    window.location.href = "index.html";
  }
}

// =============================================
// INICIALIZACIÓN OPTIMIZADA
// =============================================

/**
 * Inicializa el módulo de manera optimizada
 */
async function initializeUserProfile() {
  try {
    // 1. Verificar autenticación inmediatamente
    const session = checkAuthentication();
    if (!session) return;

    // 2. Actualizar UI inmediatamente con datos de sesión
    updateUIImmediate(session);

    // 3. Operaciones en paralelo para mejor rendimiento
    const promises = [];

    // Obtener perfil completo (en background)
    promises.push(
      fetchUserProfile(session.uid || session.idUsuario)
        .then((userProfile) => {
          if (userProfile) {
            updateUserInterface(userProfile);

            // Actualizar sesión si hay cambios importantes
            if (userProfile.esAdmin !== session.esAdmin) {
              storeSession({ ...session, esAdmin: userProfile.esAdmin });
            }
          }
        })
        .catch((error) =>
          console.warn("⚠️ Error al cargar perfil completo:", error)
        )
    );

    // Obtener estadísticas solo si estamos en la página correcta
    if (window.location.pathname.includes("usuarios.html")) {
      promises.push(
        fetchUserStatistics()
          .then((statistics) => updateStatisticsCards(statistics))
          .catch((error) =>
            console.warn("⚠️ Error al cargar estadísticas:", error)
          )
      );
    }

    // Ejecutar en paralelo sin bloquear la UI
    await Promise.allSettled(promises);
  } catch (error) {
    handleError(error, "al inicializar el perfil", false);
  }
}

/**
 * Configura event listeners optimizados
 */
function setupEventListeners() {
  // Auth state listener
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      if (!user && currentUserSession) {
        clearSession();
        window.location.href = "index.html";
      }
    });
  }

  // Actualización inteligente en visibility change
  let visibilityTimeout;
  document.addEventListener("visibilitychange", () => {
    if (
      !document.hidden &&
      window.location.pathname.includes("usuarios.html")
    ) {
      // Debounce para evitar múltiples actualizaciones
      clearTimeout(visibilityTimeout);
      visibilityTimeout = setTimeout(async () => {
        try {
          const statistics = await fetchUserStatistics();
          updateStatisticsCards(statistics);
        } catch (error) {
          console.warn("⚠️ Error al actualizar estadísticas:", error);
        }
      }, 1000);
    }
  });
}

// =============================================
// INICIALIZACIÓN AUTOMÁTICA
// =============================================

// Inicializar lo más rápido posible
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeUserProfile();
    setupEventListeners();
  });
} else {
  // DOM ya está listo
  initializeUserProfile();
  setupEventListeners();
}

// Exponer funciones al window para compatibilidad
window.navigateToPage = navigateToPage;
window.showProfile = showProfile;
window.showSettings = showSettings;
window.handleLogout = handleLogout;

// API pública
window.UserProfileService = {
  getStoredSession,
  checkAuthentication,
  fetchUserProfile,
  fetchUserStatistics,
  updateStatisticsCards,
  clearSession,
};
