// role-management.js - Módulo de Gestión de Roles
// Módulo independiente para operaciones de roles de usuarios

import { db, collection, doc, getDocs, updateDoc } from "./firebase_config.js";

// =============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// =============================================

/**
 * Configuración del módulo de roles
 */
const ROLE_MANAGEMENT_CONFIG = {
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutos
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

/**
 * Variables globales del módulo
 */
let rolesCache = new Map();
let isLoading = false;

// Referencias a colecciones
const COLLECTIONS = {
  USUARIOS: "usuarios",
  ROLES: "roles",
};

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================

/**
 * Muestra notificaciones toast
 */
function showToast(title, message, type = "info") {
  try {
    const toastElement = document.getElementById("liveToast");
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");

    if (!toastElement || !toastTitle || !toastBody) return;

    // Configurar colores según tipo
    const typeColors = {
      success: "text-success",
      error: "text-danger",
      warning: "text-warning",
      info: "text-primary",
    };

    const iconElement = toastElement.querySelector("i");
    if (iconElement) {
      iconElement.className = `fas fa-${
        type === "success"
          ? "check-circle"
          : type === "error"
          ? "exclamation-triangle"
          : type === "warning"
          ? "exclamation-circle"
          : "info-circle"
      } ${typeColors[type]} me-2`;
    }

    toastTitle.textContent = title;
    toastBody.textContent = message;

    const toast = new bootstrap.Toast(toastElement, { delay: 4000 });
    toast.show();
  } catch (error) {
    console.error("❌ Error al mostrar toast:", error);
  }
}

/**
 * Maneja errores de manera consistente
 */
function handleError(error, context, showUser = true) {
  console.error(`❌ Error en ${context}:`, error);

  if (showUser) {
    const message = error.message || `Error ${context}`;
    showToast("Error", message, "error");
  }
}

/**
 * Calcula la edad basada en fecha de nacimiento
 */
function calculateAge(birthDate) {
  if (!birthDate) return null;

  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  } catch (error) {
    console.error("Error al calcular edad:", error);
    return null;
  }
}

// =============================================
// FUNCIONES DE CARGA DE ROLES
// =============================================

/**
 * Carga todos los roles disponibles
 */
async function loadRoles() {
  try {
    const cacheKey = "roles_list";
    const cached = rolesCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.timestamp < ROLE_MANAGEMENT_CONFIG.CACHE_DURATION
    ) {
      return cached.data;
    }

    const rolesRef = collection(db, COLLECTIONS.ROLES);
    const rolesSnapshot = await getDocs(rolesRef);

    const roles = [];
    rolesSnapshot.forEach((doc) => {
      const roleData = doc.data();
      roles.push({
        firebaseId: doc.id, // ID del documento en Firebase (ej: "43GwVcVi7R0NXJwUIrko")
        id: roleData.idRol || doc.id, // idRol real del documento (ej: "rol_004")
        name: roleData.nombre || "Rol sin nombre",
        description: roleData.descripcion || "Sin descripción",
        permissions: roleData.permisos || [],
      });
    });

    console.log("🔍 Roles cargados:", roles); // Para debugging

    // Guardar en cache
    rolesCache.set(cacheKey, {
      data: roles,
      timestamp: Date.now(),
    });

    return roles;
  } catch (error) {
    console.error("❌ Error detallado al cargar roles:", error);
    handleError(error, "al cargar roles");
    return [];
  }
}

// =============================================
// FUNCIONES DE VISUALIZACIÓN DE ROLES
// =============================================

/**
 * Genera el badge de visualización de rol para la tabla
 */
function getRoleDisplayBadge(user) {
  let badgeHTML = "";

  // Mostrar rol de administrador si aplica
  if (user.esAdmin) {
    badgeHTML += `<span class="badge bg-primary">
      <i class="fas fa-crown me-1"></i>
      Administrador
    </span>`;
  }

  // Mostrar rol específico si existe
  if (user.idRol && user.nombreRol) {
    if (user.esAdmin) {
      badgeHTML += `<br><span class="badge bg-info mt-1" style="font-size: 0.75em;">
        <i class="fas fa-user-tag me-1"></i>
        ${user.nombreRol}
      </span>`;
    } else {
      badgeHTML = `<span class="badge bg-info">
        <i class="fas fa-user-tag me-1"></i>
        ${user.nombreRol}
      </span>`;
    }
  } else if (!user.esAdmin) {
    // Si no es admin y no tiene rol específico
    badgeHTML = `<span class="badge bg-secondary">
      <i class="fas fa-user me-1"></i>
      Colaborador
    </span>`;
  }

  // Si no tiene nada, mostrar colaborador básico
  if (!badgeHTML) {
    badgeHTML = `<span class="badge bg-secondary">
      <i class="fas fa-user me-1"></i>
      Colaborador
    </span>`;
  }

  return badgeHTML;
}

/**
 * Genera HTML detallado de roles para el modal de detalles
 */
function generateRoleDisplayHTML(user) {
  let html = "";

  // Mostrar si es administrador
  if (user.esAdmin) {
    html += `<span class="badge bg-primary mb-2">
      <i class="fas fa-crown me-1"></i>
      Administrador
    </span><br>`;
  }

  // Mostrar rol específico si existe
  if (user.idRol && user.nombreRol) {
    html += `<span class="badge bg-info mb-2">
      <i class="fas fa-user-tag me-1"></i>
      ${user.nombreRol}
    </span>`;

    if (user.descripcionRol) {
      html += `<br><small class="text-muted">${user.descripcionRol}</small>`;
    }

    html += `<br><small class="text-muted">Código: ${user.idRol}</small>`;

    // Mostrar permisos si existen
    if (
      user.permisosRol &&
      Array.isArray(user.permisosRol) &&
      user.permisosRol.length > 0
    ) {
      html += `<br><small class="text-info">Permisos: ${user.permisosRol.join(
        ", "
      )}</small>`;
    }
  } else if (!user.esAdmin) {
    // Si no es admin y no tiene rol específico
    html += `<span class="badge bg-secondary mb-2">
      <i class="fas fa-user me-1"></i>
      Colaborador
    </span>`;
  } else if (user.esAdmin && !user.idRol) {
    // Si es admin pero no tiene rol específico
    html += `<small class="text-muted">Sin rol específico asignado</small>`;
  }

  // Debug: mostrar idRol si existe pero no se encuentra el rol
  if (user.idRol && !user.nombreRol) {
    html += `<br><small class="text-warning">⚠️ Rol ${user.idRol} no encontrado en la base de datos</small>`;
  }

  return (
    html ||
    `<span class="badge bg-secondary">
    <i class="fas fa-user me-1"></i>
    Sin rol asignado
  </span>`
  );
}

// =============================================
// FUNCIONES DE GESTIÓN DE ROLES
// =============================================

/**
 * Asigna un rol a un usuario
 */
async function assignRole(userId, allUsers) {
  try {
    const user = allUsers.find((u) => u.id === userId);
    if (!user) throw new Error("Usuario no encontrado");

    console.log("🔍 Asignando rol a usuario:", {
      userId,
      currentRole: user.idRol,
    });

    // Cargar roles para el select
    const roles = await loadRoles();
    console.log("📋 Roles disponibles para asignar:", roles);

    // Llenar el select de roles
    const roleSelect = document.getElementById("roleSelect");
    if (roleSelect) {
      roleSelect.innerHTML =
        '<option value="">Sin rol específico</option>' +
        roles
          .map(
            (role) =>
              `<option value="${role.firebaseId}" ${
                user.idRol === role.id ? "selected" : "" // Comparar con el idRol real, no con firebaseId
              }>
              ${role.name}
            </option>`
          )
          .join("");
    }

    // Configurar datos del usuario
    document.getElementById("assignRoleUserId").value = userId;
    document.getElementById("assignRoleUserName").textContent =
      user.nombreCompleto;

    // Mostrar el rol actual correctamente
    const currentRoleText =
      user.idRol && user.nombreRol ? `${user.nombreRol}` : "Sin rol específico";

    document.getElementById("currentRole").textContent = currentRoleText;

    // Mostrar modal
    const modal = new bootstrap.Modal(
      document.getElementById("assignRoleModal")
    );
    modal.show();
  } catch (error) {
    console.error("❌ Error al cargar datos para asignar rol:", error);
    handleError(error, "al cargar datos para asignar rol");
  }
}

/**
 * Actualiza el rol de un usuario
 */
async function updateUserRole() {
  try {
    if (isLoading) return;
    isLoading = true;

    const userId = document.getElementById("assignRoleUserId").value;
    const selectedRoleFirebaseId = document.getElementById("roleSelect").value; // Este es el ID del documento de Firebase

    if (!userId) throw new Error("ID de usuario no encontrado");

    // Preparar datos para actualizar
    const updateData = {
      fechaActualizacion: new Date().toISOString(),
    };

    // Manejar correctamente el rol
    if (selectedRoleFirebaseId && selectedRoleFirebaseId.trim() !== "") {
      // AQUÍ ESTÁ EL CAMBIO IMPORTANTE:
      // Necesitamos obtener el idRol real del documento del rol seleccionado
      const roles = await loadRoles();
      const selectedRole = roles.find(
        (role) => role.firebaseId === selectedRoleFirebaseId
      );

      if (selectedRole && selectedRole.id) {
        updateData.idRol = selectedRole.id; // Esto será "rol_004", no el ID de Firebase
      } else {
        throw new Error("Rol seleccionado no encontrado");
      }
    } else {
      // Si no se selecciona rol, eliminar la propiedad idRol
      updateData.idRol = null;
    }

    // Actualizar en Firestore
    const userDocRef = doc(db, COLLECTIONS.USUARIOS, userId);
    await updateDoc(userDocRef, updateData);

    showToast("Éxito", "Rol asignado correctamente", "success");

    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("assignRoleModal")
    );
    if (modal) modal.hide();

    return true; // Indica éxito para que el módulo principal recargue
  } catch (error) {
    handleError(error, "al asignar rol");
    return false;
  } finally {
    isLoading = false;
  }
}

/**
 * Muestra diálogo de confirmación
 */
function showConfirmDialog(title, message, type = "info") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const titleElement = document.getElementById("confirmModalTitle");
    const bodyElement = document.getElementById("confirmModalBody");
    const confirmBtn = document.getElementById("confirmModalBtn");

    if (!modal || !titleElement || !bodyElement || !confirmBtn) {
      resolve(false);
      return;
    }

    // Configurar contenido
    titleElement.textContent = title;
    bodyElement.textContent = message;

    // Configurar colores según tipo
    const typeClasses = {
      danger: "btn-danger",
      warning: "btn-warning",
      info: "btn-info",
      success: "btn-success",
    };

    confirmBtn.className = `btn ${typeClasses[type] || "btn-primary"}`;

    // Configurar eventos
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener("click", handleConfirm);
      modal.removeEventListener("hidden.bs.modal", handleCancel);
      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) bootstrapModal.hide();
    };

    confirmBtn.addEventListener("click", handleConfirm);
    modal.addEventListener("hidden.bs.modal", handleCancel, { once: true });

    // Mostrar modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  });
}

/**
 * Cambia el rol de administrador del usuario
 */
async function toggleAdminRole(userId, makeAdmin, allUsers) {
  try {
    if (isLoading) return;

    const user = allUsers.find((u) => u.id === userId);
    if (!user) throw new Error("Usuario no encontrado");

    const action = makeAdmin ? "otorgar" : "quitar";
    const confirmed = await showConfirmDialog(
      `Confirmar Cambio de Rol`,
      `¿Estás seguro de ${action} privilegios de administrador ${
        makeAdmin ? "a" : "de"
      } "${user.nombreCompleto}"?`,
      makeAdmin ? "info" : "warning"
    );

    if (!confirmed) return false;

    // Actualizar rol en Firestore
    const userDocRef = doc(db, COLLECTIONS.USUARIOS, userId);
    await updateDoc(userDocRef, {
      esAdmin: makeAdmin,
      fechaActualizacion: new Date().toISOString(),
    });

    showToast(
      "Rol Actualizado",
      `Privilegios de administrador ${
        makeAdmin ? "otorgados" : "removidos"
      } correctamente`,
      "success"
    );

    return true; // Indica éxito para que el módulo principal recargue
  } catch (error) {
    handleError(error, "al cambiar rol del usuario");
    return false;
  }
}

// =============================================
// FUNCIONES GLOBALES PARA EL MÓDULO PRINCIPAL
// =============================================

/**
 * Función global para asignar rol (llamada desde el módulo principal)
 */
window.assignRole = function (userId) {
  // Esta función debe recibir allUsers del módulo principal
  const event = new CustomEvent("requestAllUsers", {
    detail: { callback: (allUsers) => assignRole(userId, allUsers) },
  });
  document.dispatchEvent(event);
};

/**
 * Función global para actualizar rol de usuario
 */
window.updateUserRole = async function () {
  const success = await updateUserRole();
  if (success) {
    // Solicitar recarga de usuarios al módulo principal
    const event = new CustomEvent("reloadUsers");
    document.dispatchEvent(event);
  }
};

/**
 * Función global para cambiar rol de administrador
 */
window.toggleAdminRole = function (userId, makeAdmin) {
  // Esta función debe recibir allUsers del módulo principal
  const event = new CustomEvent("requestAllUsers", {
    detail: {
      callback: (allUsers) =>
        toggleAdminRole(userId, makeAdmin, allUsers).then((success) => {
          if (success) {
            const reloadEvent = new CustomEvent("reloadUsers");
            document.dispatchEvent(reloadEvent);
          }
        }),
    },
  });
  document.dispatchEvent(event);
};

// =============================================
// EXPORTACIONES
// =============================================

export {
  loadRoles,
  getRoleDisplayBadge,
  generateRoleDisplayHTML,
  assignRole,
  updateUserRole,
  toggleAdminRole,
  calculateAge,
};
