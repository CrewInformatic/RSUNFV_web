// role-management.js - Módulo de Gestión de Roles con datos bancarios
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
  RECOLECTOR_ROLE_ID: "rol_004", // ID específico del rol recolector
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

// =============================================
// FUNCIONES DE VERIFICACIÓN DE ROL RECOLECTOR
// =============================================

/**
 * Verifica si un rol es el rol recolector (rol_004)
 */
function isRecolectorRole(roleId) {
  return roleId === ROLE_MANAGEMENT_CONFIG.RECOLECTOR_ROLE_ID;
}

/**
 * Verifica si el rol seleccionado en el dropdown es recolector
 */
function isSelectedRoleRecolector() {
  const roleSelect = document.getElementById("roleSelect");
  if (!roleSelect || !roleSelect.value) return false;

  // Buscar el rol seleccionado en el cache de roles
  const roles = rolesCache.get("roles_list")?.data || [];
  const selectedRole = roles.find(
    (role) => role.firebaseId === roleSelect.value
  );

  return selectedRole ? isRecolectorRole(selectedRole.id) : false;
}

/**
 * Verifica si un usuario necesita datos bancarios
 */
function userNeedsBankingData(user) {
  // Si el usuario tiene rol_004 pero no tiene datos bancarios
  return isRecolectorRole(user.idRol) && !user.Yape && !user.cuentaBancaria;
}

// =============================================
// FUNCIONES DE MANEJO DEL MODAL
// =============================================

/**
 * Maneja el cambio de rol seleccionado
 */
function handleRoleChange() {
  const roleSelect = document.getElementById("roleSelect");
  const bankingDataSection = document.getElementById("bankingDataSection");

  if (!roleSelect || !bankingDataSection) return;

  const isRecolector = isSelectedRoleRecolector();

  if (isRecolector) {
    bankingDataSection.classList.remove("d-none");
    console.log("🏦 Mostrando formulario bancario para rol_004");

    // 🎯 Autocompletar con datos existentes si los hay
    const userId = document.getElementById("assignRoleUserId").value;
    if (userId) {
      // Buscar usuario actual con datos bancarios
      const event = new CustomEvent("requestAllUsers", {
        detail: {
          callback: (allUsers) => {
            const user = allUsers.find((u) => u.id === userId);
            if (user && (user.Yape || user.cuentaBancaria)) {
              console.log("🔄 Autocompletando campos al cambiar a rol_004");
              populateBankingFields(user);
            }
          },
        },
      });
      document.dispatchEvent(event);
    }
  } else {
    bankingDataSection.classList.add("d-none");
    resetBankingFields();
    console.log("🚫 Ocultando formulario bancario - no es rol_004");
  }
}

/**
 * Maneja el cambio de tipo de cuenta
 */
function handleAccountTypeChange() {
  const accountType = document.getElementById("accountType");
  const yapeSection = document.getElementById("yapeSection");
  const bankAccountSection = document.getElementById("bankAccountSection");
  const commonFields = document.getElementById("commonBankingFields");

  if (!accountType || !yapeSection || !bankAccountSection || !commonFields)
    return;

  const accountTypeValue = accountType.value;

  // Ocultar todas las secciones primero
  yapeSection.classList.add("d-none");
  bankAccountSection.classList.add("d-none");
  commonFields.classList.add("d-none");

  if (accountTypeValue === "yape") {
    yapeSection.classList.remove("d-none");
    commonFields.classList.remove("d-none");
    // Auto-completar banco para Yape
    const yapeBank = document.getElementById("yapeBank");
    if (yapeBank) yapeBank.value = "BCP";
  } else if (accountTypeValue === "cuenta_bancaria") {
    bankAccountSection.classList.remove("d-none");
    commonFields.classList.remove("d-none");
  }
}

/**
 * Maneja el cambio de banco (para mostrar campo "Otro")
 */
function handleBankSelectChange() {
  const bankSelect = document.getElementById("bankSelect");
  const otherBankSection = document.getElementById("otherBankSection");

  if (!bankSelect || !otherBankSection) return;

  if (bankSelect.value === "Otro") {
    otherBankSection.classList.remove("d-none");
  } else {
    otherBankSection.classList.add("d-none");
    const otherBankName = document.getElementById("otherBankName");
    if (otherBankName) otherBankName.value = "";
  }
}

/**
 * Resetea todos los campos bancarios
 */
function resetBankingFields() {
  const fields = [
    "accountType",
    "yapeNumber",
    "accountNumber",
    "bankSelect",
    "otherBankName",
    "accountHolderName",
    "accountHolderDNI",
  ];

  fields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) field.value = "";
  });

  // Ocultar secciones
  const sectionsToHide = [
    "yapeSection",
    "bankAccountSection",
    "commonBankingFields",
    "otherBankSection",
  ];

  sectionsToHide.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) section.classList.add("d-none");
  });
}

/**
 * 🎯 NUEVA FUNCIÓN: Autocompleta los campos bancarios con datos existentes
 */
function populateBankingFields(user) {
  console.log("🔄 Autocompletando campos bancarios:", user);

  // Llenar datos del titular (siempre disponibles)
  const accountHolderName = document.getElementById("accountHolderName");
  const accountHolderDNI = document.getElementById("accountHolderDNI");

  if (accountHolderName && user.nombreTitular) {
    accountHolderName.value = user.nombreTitular;
  }

  if (accountHolderDNI && user.dniTitular) {
    accountHolderDNI.value = user.dniTitular;
  }

  // Determinar el tipo de cuenta basado en los datos existentes
  const accountType = document.getElementById("accountType");

  if (user.Yape && user.Yape.trim()) {
    // 💳 Tiene Yape - autocompletar formulario Yape
    console.log("💳 Autocompletando datos de Yape");

    if (accountType) {
      accountType.value = "yape";
      handleAccountTypeChange(); // Mostrar sección Yape
    }

    const yapeNumber = document.getElementById("yapeNumber");
    const yapeBank = document.getElementById("yapeBank");

    if (yapeNumber) {
      yapeNumber.value = user.Yape;
    }

    if (yapeBank) {
      yapeBank.value = user.banco || "BCP";
    }
  } else if (user.cuentaBancaria && user.cuentaBancaria.trim()) {
    // 🏦 Tiene cuenta bancaria - autocompletar formulario cuenta bancaria
    console.log("🏦 Autocompletando datos de cuenta bancaria");

    if (accountType) {
      accountType.value = "cuenta_bancaria";
      handleAccountTypeChange(); // Mostrar sección cuenta bancaria
    }

    const accountNumber = document.getElementById("accountNumber");
    const bankSelect = document.getElementById("bankSelect");

    if (accountNumber) {
      accountNumber.value = user.cuentaBancaria;
    }

    if (bankSelect && user.banco) {
      // Verificar si el banco está en la lista predefinida
      const bankOptions = Array.from(bankSelect.options).map(
        (option) => option.value
      );

      if (bankOptions.includes(user.banco)) {
        bankSelect.value = user.banco;
      } else {
        // Si no está en la lista, seleccionar "Otro" y mostrar el campo personalizado
        bankSelect.value = "Otro";
        handleBankSelectChange(); // Mostrar campo "Otro"

        const otherBankName = document.getElementById("otherBankName");
        if (otherBankName) {
          otherBankName.value = user.banco;
        }
      }
    }
  }

  // Siempre mostrar campos comunes si hay datos bancarios
  if (
    (user.Yape && user.Yape.trim()) ||
    (user.cuentaBancaria && user.cuentaBancaria.trim())
  ) {
    const commonFields = document.getElementById("commonBankingFields");
    if (commonFields) {
      commonFields.classList.remove("d-none");
    }
  }

  console.log("✅ Campos bancarios autocompletados");
}

/**
 * Valida los datos bancarios según el tipo de cuenta
 */
function validateBankingData() {
  const isRecolector = isSelectedRoleRecolector();

  if (!isRecolector) {
    return { valid: true }; // No necesita validación si no es recolector
  }

  const accountType = document.getElementById("accountType");
  if (!accountType || !accountType.value) {
    return {
      valid: false,
      message: "Debe seleccionar un tipo de cuenta para el rol recolector",
    };
  }

  const accountHolderName = document.getElementById("accountHolderName");
  const accountHolderDNI = document.getElementById("accountHolderDNI");

  if (!accountHolderName || !accountHolderName.value.trim()) {
    return {
      valid: false,
      message: "Debe ingresar el nombre del titular de la cuenta",
    };
  }

  const dniValue = accountHolderDNI ? accountHolderDNI.value.trim() : "";
  if (!dniValue || dniValue.length !== 8 || !/^\d{8}$/.test(dniValue)) {
    return {
      valid: false,
      message: "Debe ingresar un DNI válido de 8 dígitos",
    };
  }

  if (accountType.value === "yape") {
    const yapeNumber = document.getElementById("yapeNumber");
    const yapeValue = yapeNumber ? yapeNumber.value.trim() : "";
    if (!yapeValue || !/^\d{9}$/.test(yapeValue)) {
      return {
        valid: false,
        message: "Debe ingresar un número de Yape válido (9 dígitos)",
      };
    }
  } else if (accountType.value === "cuenta_bancaria") {
    const accountNumber = document.getElementById("accountNumber");
    const bankSelect = document.getElementById("bankSelect");

    if (!accountNumber || !accountNumber.value.trim()) {
      return { valid: false, message: "Debe ingresar el número de cuenta" };
    }

    if (!bankSelect || !bankSelect.value) {
      return { valid: false, message: "Debe seleccionar un banco" };
    }

    if (bankSelect.value === "Otro") {
      const otherBankName = document.getElementById("otherBankName");
      if (!otherBankName || !otherBankName.value.trim()) {
        return {
          valid: false,
          message: "Debe especificar el nombre del banco",
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Recopila los datos bancarios para guardar
 */
function collectBankingData() {
  const isRecolector = isSelectedRoleRecolector();

  if (!isRecolector) {
    return null; // No hay datos bancarios que guardar
  }

  const accountType = document.getElementById("accountType");
  const accountHolderName = document.getElementById("accountHolderName");
  const accountHolderDNI = document.getElementById("accountHolderDNI");

  if (!accountType || !accountHolderName || !accountHolderDNI) return null;

  // Datos básicos obligatorios
  const bankingData = {
    nombreTitular: accountHolderName.value.trim(),
    dniTitular: accountHolderDNI.value.trim(),
    fechaRegistroBanco: new Date().toISOString(),
  };

  if (accountType.value === "yape") {
    const yapeNumber = document.getElementById("yapeNumber");
    if (yapeNumber && yapeNumber.value.trim()) {
      bankingData.Yape = yapeNumber.value.trim();
      bankingData.banco = "BCP";
      // NO agregar cuentaBancaria aquí
    }
  } else if (accountType.value === "cuenta_bancaria") {
    const accountNumber = document.getElementById("accountNumber");
    const bankSelect = document.getElementById("bankSelect");

    if (accountNumber && accountNumber.value.trim()) {
      bankingData.cuentaBancaria = accountNumber.value.trim();
      // NO agregar Yape aquí
    }

    if (bankSelect && bankSelect.value) {
      if (bankSelect.value === "Otro") {
        const otherBankName = document.getElementById("otherBankName");
        if (otherBankName && otherBankName.value.trim()) {
          bankingData.banco = otherBankName.value.trim();
        }
      } else {
        bankingData.banco = bankSelect.value;
      }
    }
  }

  console.log("🏦 Datos bancarios recopilados:", bankingData);
  return bankingData;
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
    const roleClass = isRecolectorRole(user.idRol) ? "bg-success" : "bg-info";
    const roleIcon = isRecolectorRole(user.idRol) ? "fa-coins" : "fa-user-tag";

    if (user.esAdmin) {
      badgeHTML += `<br><span class="badge ${roleClass} mt-1" style="font-size: 0.75em;">
        <i class="fas ${roleIcon} me-1"></i>
        ${user.nombreRol}
      </span>`;
    } else {
      badgeHTML = `<span class="badge ${roleClass}">
        <i class="fas ${roleIcon} me-1"></i>
        ${user.nombreRol}
      </span>`;
    }

    // Mostrar advertencia si es recolector sin datos bancarios
    if (isRecolectorRole(user.idRol) && !user.Yape && !user.cuentaBancaria) {
      badgeHTML += `<br><small class="text-warning"><i class="fas fa-exclamation-triangle"></i> Sin datos bancarios</small>`;
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
    const roleClass = isRecolectorRole(user.idRol) ? "bg-success" : "bg-info";
    const roleIcon = isRecolectorRole(user.idRol) ? "fa-coins" : "fa-user-tag";

    html += `<span class="badge ${roleClass} mb-2">
      <i class="fas ${roleIcon} me-1"></i>
      ${user.nombreRol}
    </span>`;

    if (user.descripcionRol) {
      html += `<br><small class="text-muted">${user.descripcionRol}</small>`;
    }

    html += `<br><small class="text-muted">Código: ${user.idRol}</small>`;

    // Mostrar información bancaria si es recolector
    if (isRecolectorRole(user.idRol)) {
      if (user.Yape || user.cuentaBancaria) {
        html += `<br><small class="text-success"><i class="fas fa-check-circle"></i> Con datos bancarios</small>`;
      } else {
        html += `<br><small class="text-warning"><i class="fas fa-exclamation-triangle"></i> Sin datos bancarios</small>`;
      }
    }

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
      needsBankingData: userNeedsBankingData(user),
      bankingData: {
        Yape: user.Yape,
        cuentaBancaria: user.cuentaBancaria,
        banco: user.banco,
        nombreTitular: user.nombreTitular,
        dniTitular: user.dniTitular,
      },
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

    // Resetear campos bancarios al abrir el modal
    resetBankingFields();
    const bankingDataSection = document.getElementById("bankingDataSection");

    // Mostrar/ocultar sección bancaria según el rol actual o si necesita datos bancarios
    if (bankingDataSection) {
      if (isRecolectorRole(user.idRol) || userNeedsBankingData(user)) {
        bankingDataSection.classList.remove("d-none");
        console.log(
          "🏦 Usuario ya tiene rol_004 o lo necesita - mostrando formulario bancario"
        );

        // 🎯 AUTOCOMPLETAR campos bancarios existentes
        populateBankingFields(user);
      } else {
        bankingDataSection.classList.add("d-none");
      }
    }

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
 * Actualiza el rol de un usuario con validación bancaria
 */
async function updateUserRole() {
  try {
    if (isLoading) return;
    isLoading = true;

    // Validar datos bancarios primero
    const validation = validateBankingData();
    if (!validation.valid) {
      showToast("Error de validación", validation.message, "error");
      return false;
    }

    const userId = document.getElementById("assignRoleUserId").value;
    const selectedRoleFirebaseId = document.getElementById("roleSelect").value;

    if (!userId) throw new Error("ID de usuario no encontrado");

    // Preparar datos para actualizar
    const updateData = {
      fechaActualizacion: new Date().toISOString(),
    };

    // Manejar correctamente el rol
    if (selectedRoleFirebaseId && selectedRoleFirebaseId.trim() !== "") {
      const roles = await loadRoles();
      const selectedRole = roles.find(
        (role) => role.firebaseId === selectedRoleFirebaseId
      );

      if (selectedRole && selectedRole.id) {
        updateData.idRol = selectedRole.id;

        // Si es rol_004 (recolector), agregar datos bancarios directamente al usuario
        if (isRecolectorRole(selectedRole.id)) {
          const bankingData = collectBankingData();
          if (bankingData) {
            // Solo agregar campos que tengan valor válido
            if (bankingData.Yape) {
              updateData.Yape = bankingData.Yape;
              updateData.cuentaBancaria = null; // Limpiar cuenta bancaria
            }
            if (bankingData.cuentaBancaria) {
              updateData.cuentaBancaria = bankingData.cuentaBancaria;
              updateData.Yape = null; // Limpiar Yape
            }
            if (bankingData.banco) {
              updateData.banco = bankingData.banco;
            }
            if (bankingData.nombreTitular) {
              updateData.nombreTitular = bankingData.nombreTitular;
            }
            if (bankingData.dniTitular) {
              updateData.dniTitular = bankingData.dniTitular;
            }
            if (bankingData.fechaRegistroBanco) {
              updateData.fechaRegistroBanco = bankingData.fechaRegistroBanco;
            }
          }
        } else {
          // Si no es recolector, limpiar datos bancarios
          updateData.Yape = null;
          updateData.cuentaBancaria = null;
          updateData.banco = null;
          updateData.nombreTitular = null;
          updateData.dniTitular = null;
          updateData.fechaRegistroBanco = null;
        }
      } else {
        throw new Error("Rol seleccionado no encontrado");
      }
    } else {
      // Si se quita el rol, también quitar datos bancarios
      updateData.idRol = null;
      updateData.Yape = null;
      updateData.cuentaBancaria = null;
      updateData.banco = null;
      updateData.nombreTitular = null;
      updateData.dniTitular = null;
      updateData.fechaRegistroBanco = null;
    }

    console.log("🔍 Datos a actualizar:", updateData);

    // Actualizar en Firestore
    const userDocRef = doc(db, COLLECTIONS.USUARIOS, userId);
    await updateDoc(userDocRef, updateData);

    const message =
      updateData.Yape || updateData.cuentaBancaria
        ? "Rol recolector y datos bancarios asignados correctamente"
        : "Rol asignado correctamente";

    showToast("Éxito", message, "success");

    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("assignRoleModal")
    );
    if (modal) modal.hide();

    return true;
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
// INICIALIZACIÓN DE EVENT LISTENERS
// =============================================

function initializeEventListeners() {
  // Event listener para cambio de rol
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "roleSelect") {
      handleRoleChange();
    }
    if (e.target && e.target.id === "accountType") {
      handleAccountTypeChange();
    }
    if (e.target && e.target.id === "bankSelect") {
      handleBankSelectChange();
    }
  });
}

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeEventListeners);
} else {
  initializeEventListeners();
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

// Funciones globales para el manejo del modal
window.handleRoleChange = handleRoleChange;
window.handleAccountTypeChange = handleAccountTypeChange;

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
  handleRoleChange,
  handleAccountTypeChange,
  validateBankingData,
  collectBankingData,
  resetBankingFields,
  populateBankingFields,
  isRecolectorRole,
  userNeedsBankingData,
};
