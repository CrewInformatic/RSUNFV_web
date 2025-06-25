// export-users-excel.js - Sistema mejorado de exportación de usuarios a Excel
// SOLUCIÓN MEJORADA: Múltiples métodos de carga con fallbacks

// =============================================
// CONFIGURACIÓN Y ESTADO
// =============================================
const exportConfig = {
  fileName: "usuarios_unfv",
  sheetNames: {
    users: "Usuarios",
    stats: "Estadísticas",
    summary: "Resumen",
  },
  // CDNs de respaldo para XLSX
  xlsxSources: [
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  ],
};

let exportState = {
  allUsers: [],
  filteredUsers: [],
  isExporting: false,
  xlsxLoaded: false,
  xlsxInstance: null,
  loadAttempts: 0,
};

// =============================================
// CARGA MEJORADA DE XLSX CON MÚLTIPLES FALLBACKS
// =============================================
const xlsxLoader = {
  /**
   * Carga la librería XLSX con múltiples métodos de fallback
   */
  async loadXLSX() {
    if (exportState.xlsxLoaded && exportState.xlsxInstance) {
      return exportState.xlsxInstance;
    }

    console.log("📦 Iniciando carga de XLSX...");

    // Método 1: Verificar si ya está disponible globalmente
    if (this.checkGlobalXLSX()) {
      console.log("✅ XLSX ya disponible globalmente");
      return window.XLSX;
    }

    // Método 2: Intentar carga con múltiples CDNs
    for (let i = 0; i < exportConfig.xlsxSources.length; i++) {
      try {
        console.log(`📦 Intentando cargar desde CDN ${i + 1}...`);
        const XLSX = await this.loadFromCDN(exportConfig.xlsxSources[i]);
        if (XLSX) {
          return XLSX;
        }
      } catch (error) {
        console.warn(`⚠️ CDN ${i + 1} falló:`, error.message);
        continue;
      }
    }

    throw new Error("No se pudo cargar XLSX desde ningún CDN disponible");
  },

  /**
   * Verifica si XLSX está disponible globalmente
   */
  checkGlobalXLSX() {
    try {
      if (
        window.XLSX &&
        window.XLSX.utils &&
        window.XLSX.utils.book_new &&
        window.XLSX.writeFile
      ) {
        exportState.xlsxInstance = window.XLSX;
        exportState.xlsxLoaded = true;
        return true;
      }
    } catch (error) {
      console.warn("Error verificando XLSX global:", error);
    }
    return false;
  },

  /**
   * Carga XLSX desde un CDN específico
   */
  async loadFromCDN(cdnUrl) {
    return new Promise((resolve, reject) => {
      // Crear un ID único para evitar conflictos
      const scriptId = `xlsx-script-${Date.now()}`;

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = cdnUrl;
      script.async = true;

      const timeout = setTimeout(() => {
        this.cleanup(scriptId);
        reject(new Error("Timeout al cargar XLSX"));
      }, 15000); // 15 segundos de timeout

      script.onload = () => {
        clearTimeout(timeout);

        // Verificar que XLSX se cargó correctamente
        if (this.checkGlobalXLSX()) {
          console.log(`✅ XLSX cargado desde: ${cdnUrl}`);
          resolve(window.XLSX);
        } else {
          this.cleanup(scriptId);
          reject(new Error("XLSX no disponible después de cargar"));
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        this.cleanup(scriptId);
        reject(new Error(`Error al cargar desde ${cdnUrl}`));
      };

      document.head.appendChild(script);
    });
  },

  /**
   * Limpia scripts fallidos
   */
  cleanup(scriptId) {
    const script = document.getElementById(scriptId);
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
    }
  },

  /**
   * Verifica si XLSX está disponible y funcional
   */
  isXLSXAvailable() {
    return (
      exportState.xlsxLoaded &&
      exportState.xlsxInstance &&
      exportState.xlsxInstance.utils &&
      exportState.xlsxInstance.utils.book_new &&
      exportState.xlsxInstance.writeFile
    );
  },

  /**
   * Método de emergencia: crear Excel básico sin XLSX
   */
  createBasicExcel(users) {
    console.log("📋 Creando Excel básico sin XLSX...");

    // Preparar datos CSV
    const headers = [
      "N°",
      "Nombre Completo",
      "Correo Electrónico",
      "Código de Usuario",
      "Teléfono",
      "Edad",
      "Fecha de Nacimiento",
      "Escuela",
      "Facultad",
      "Rol",
      "Es Administrador",
      "Estado",
      "Fecha de Registro",
    ];

    const csvData = [headers];

    users.forEach((user, index) => {
      csvData.push([
        index + 1,
        user.nombreCompleto || "Sin nombre",
        user.correo || "Sin email",
        !user.esAdmin ? user.codigoUsuario || "N/A" : "ADMIN",
        user.celular || "No especificado",
        user.edad || "No especificado",
        this.formatDateForCSV(user.fechaNacimiento),
        user.nombreEscuela || "No especificado",
        user.nombreFacultad || "No especificado",
        user.nombreRol || "Sin rol",
        user.esAdmin ? "SÍ" : "NO",
        user.estadoActivo ? "ACTIVO" : "INACTIVO",
        this.formatDateForCSV(user.fechaRegistro),
      ]);
    });

    // Convertir a CSV
    const csvContent = csvData
      .map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    // Descargar como CSV
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const fileName = `usuarios_unfv_${timestamp}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return true;
    }

    return false;
  },

  /**
   * Formatea fecha para CSV
   */
  formatDateForCSV(dateString) {
    if (!dateString) return "No disponible";
    try {
      return new Date(dateString).toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "Fecha inválida";
    }
  },
};

// =============================================
// UTILIDADES DE EXPORTACIÓN (sin cambios)
// =============================================
const exportUtils = {
  /**
   * Muestra toast personalizado para exportación
   */
  showExportToast(title, message, type = "info") {
    const toastElement = document.getElementById("liveToast");
    const toastTitle = document.getElementById("toastTitle");
    const toastBody = document.getElementById("toastBody");

    if (!toastElement || !toastTitle || !toastBody) {
      console.log(`Toast: ${title} - ${message}`);
      // Fallback: usar alert si no hay toast
      if (type === "error" || type === "warning") {
        alert(`${title}: ${message}`);
      }
      return;
    }

    const typeColors = {
      success: "text-success",
      error: "text-danger",
      warning: "text-warning",
      info: "text-primary",
    };

    toastTitle.textContent = title;
    toastBody.textContent = message;

    const iconElement = toastElement.querySelector("i");
    if (iconElement) {
      const icons = {
        success: "check-circle",
        error: "exclamation-triangle",
        warning: "exclamation-circle",
        info: "download",
      };
      iconElement.className = `fas fa-${icons[type]} ${typeColors[type]} me-2`;
    }

    new bootstrap.Toast(toastElement, { delay: 5000 }).show();
  },

  /**
   * Formatea fecha para Excel
   */
  formatDateForExcel(dateString) {
    if (!dateString) return "No disponible";
    try {
      return new Date(dateString).toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "Fecha inválida";
    }
  },

  /**
   * Prepara datos de usuario para Excel
   */
  prepareUserData(users) {
    return users.map((user, index) => ({
      "N°": index + 1,
      "Nombre Completo": user.nombreCompleto || "Sin nombre",
      "Correo Electrónico": user.correo || "Sin email",
      "Código de Usuario": !user.esAdmin
        ? user.codigoUsuario || "N/A"
        : "ADMIN",
      Teléfono: user.celular || "No especificado",
      Edad: user.edad || "No especificado",
      "Fecha de Nacimiento": this.formatDateForExcel(user.fechaNacimiento),
      Escuela: user.nombreEscuela || "No especificado",
      Facultad: user.nombreFacultad || "No especificado",
      Rol: user.nombreRol || "Sin rol",
      "Es Administrador": user.esAdmin ? "SÍ" : "NO",
      Estado: user.estadoActivo ? "ACTIVO" : "INACTIVO",
      "Fecha de Registro": this.formatDateForExcel(user.fechaRegistro),
      "Última Actualización": this.formatDateForExcel(user.fechaActualizacion),
    }));
  },

  /**
   * Genera estadísticas para Excel
   */
  generateStatistics(users) {
    const total = users.length;
    const active = users.filter((u) => u.estadoActivo).length;
    const inactive = total - active;
    const admins = users.filter((u) => u.esAdmin).length;
    const regular = total - admins;

    const schools = [...new Set(users.map((u) => u.nombreEscuela))].filter(
      Boolean
    );
    const faculties = [...new Set(users.map((u) => u.nombreFacultad))].filter(
      Boolean
    );
    const roles = [...new Set(users.map((u) => u.nombreRol))].filter(Boolean);

    return [
      ["ESTADÍSTICAS GENERALES", ""],
      ["Total de Usuarios", total],
      ["Usuarios Activos", active],
      ["Usuarios Inactivos", inactive],
      ["Administradores", admins],
      ["Usuarios Regulares", regular],
      ["", ""],
      ["DISTRIBUCIÓN POR ESCUELA", ""],
      ...schools.map((school) => [
        school,
        users.filter((u) => u.nombreEscuela === school).length,
      ]),
      ["", ""],
      ["DISTRIBUCIÓN POR FACULTAD", ""],
      ...faculties.map((faculty) => [
        faculty,
        users.filter((u) => u.nombreFacultad === faculty).length,
      ]),
      ["", ""],
      ["DISTRIBUCIÓN POR ROLES", ""],
      ...roles.map((role) => [
        role,
        users.filter((u) => u.nombreRol === role).length,
      ]),
      ["Sin rol asignado", users.filter((u) => !u.nombreRol).length],
      ["", ""],
      ["INFORMACIÓN DEL REPORTE", ""],
      ["Fecha de Generación", new Date().toLocaleDateString("es-PE")],
      ["Hora de Generación", new Date().toLocaleTimeString("es-PE")],
      ["Generado por", "Sistema UNFV"],
    ];
  },
};

// =============================================
// FUNCIÓN PRINCIPAL DE EXPORTACIÓN MEJORADA
// =============================================

/**
 * Exporta usuarios a Excel con sistema de fallback mejorado
 */
async function exportUsersToExcel(users, customFileName = null) {
  if (exportState.isExporting) {
    exportUtils.showExportToast(
      "Exportación en Proceso",
      "Ya hay una exportación en curso, espera un momento",
      "warning"
    );
    return;
  }

  if (!users || users.length === 0) {
    exportUtils.showExportToast(
      "Sin Datos",
      "No hay usuarios para exportar",
      "warning"
    );
    return;
  }

  exportState.isExporting = true;

  try {
    // Mostrar indicador de carga
    exportUtils.showExportToast(
      "Preparando Exportación",
      "Cargando librería y preparando datos...",
      "info"
    );

    console.log("📊 Iniciando exportación de", users.length, "usuarios");

    // Intentar cargar XLSX
    let XLSX;
    try {
      XLSX = await xlsxLoader.loadXLSX();
    } catch (xlsxError) {
      console.warn("⚠️ Error cargando XLSX:", xlsxError.message);

      // Preguntar al usuario si quiere continuar con CSV
      const userChoice = confirm(
        "❌ No se pudo cargar la librería de Excel.\n\n" +
          "¿Deseas descargar los datos en formato CSV (compatible con Excel)?\n\n" +
          "✅ Aceptar: Descargar como CSV\n" +
          "❌ Cancelar: Intentar más tarde"
      );

      if (userChoice) {
        const success = xlsxLoader.createBasicExcel(users);
        if (success) {
          exportUtils.showExportToast(
            "Exportación CSV Completada",
            `Se exportaron ${users.length} usuarios en formato CSV`,
            "success"
          );
        } else {
          throw new Error("No se pudo crear el archivo CSV");
        }
        return;
      } else {
        exportUtils.showExportToast(
          "Exportación Cancelada",
          "Puedes intentar más tarde o verificar tu conexión a internet",
          "info"
        );
        return;
      }
    }

    // Si llegamos aquí, XLSX se cargó correctamente
    console.log("✅ XLSX cargado, creando archivo Excel...");

    // Crear libro de trabajo
    const workbook = XLSX.utils.book_new();

    // Preparar datos de usuarios
    const userData = exportUtils.prepareUserData(users);
    const userSheet = XLSX.utils.json_to_sheet(userData);

    // Preparar estadísticas
    const statsData = exportUtils.generateStatistics(users);
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);

    // Preparar resumen
    const summaryData = [
      ["RESUMEN EJECUTIVO"],
      [""],
      ["Total de usuarios exportados:", users.length],
      ["Usuarios activos:", users.filter((u) => u.estadoActivo).length],
      ["Administradores:", users.filter((u) => u.esAdmin).length],
      [
        "Escuelas representadas:",
        [...new Set(users.map((u) => u.nombreEscuela))].filter(Boolean).length,
      ],
      [""],
      [
        "Tipo de exportación:",
        customFileName
          ? customFileName.replace(/_/g, " ").toUpperCase()
          : "PERSONALIZADA",
      ],
      ["Fecha:", new Date().toLocaleDateString("es-PE")],
      ["Hora:", new Date().toLocaleTimeString("es-PE")],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Agregar hojas al libro
    XLSX.utils.book_append_sheet(
      workbook,
      userSheet,
      exportConfig.sheetNames.users
    );
    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      exportConfig.sheetNames.summary
    );
    XLSX.utils.book_append_sheet(
      workbook,
      statsSheet,
      exportConfig.sheetNames.stats
    );

    // Generar nombre del archivo
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const fileName = customFileName
      ? `${customFileName}_${timestamp}.xlsx`
      : `${exportConfig.fileName}_${timestamp}.xlsx`;

    // Exportar archivo
    XLSX.writeFile(workbook, fileName);

    exportUtils.showExportToast(
      "Exportación Exitosa",
      `Se exportaron ${users.length} usuarios en formato Excel`,
      "success"
    );

    console.log("✅ Exportación Excel completada:", fileName);
  } catch (error) {
    console.error("❌ Error en exportación:", error);

    let errorMessage = "Error desconocido durante la exportación";

    if (error.message.includes("XLSX")) {
      errorMessage =
        "Error con la librería de Excel. Verifica tu conexión a internet.";
    } else if (error.message.includes("book_new")) {
      errorMessage = "La librería de Excel no funcionó correctamente.";
    } else if (error.message.includes("CDN")) {
      errorMessage = "No se pudo conectar a los servidores de descarga.";
    }

    exportUtils.showExportToast("Error de Exportación", errorMessage, "error");
  } finally {
    exportState.isExporting = false;
  }
}

// =============================================
// RESTO DE FUNCIONES (sin cambios significativos)
// =============================================

/**
 * Exporta usuarios filtrados
 */
async function exportFilteredUsersToExcel() {
  await exportUsersToExcel(
    exportState.filteredUsers,
    "usuarios_filtrados_unfv"
  );
}

/**
 * Exporta todos los usuarios
 */
async function exportAllUsersToExcel() {
  await exportUsersToExcel(exportState.allUsers, "todos_usuarios_unfv");
}

// =============================================
// SISTEMA DE MODAL Y OPCIONES DE EXPORTACIÓN
// =============================================
const modalManager = {
  /**
   * Muestra el modal de exportación con estadísticas actualizadas
   */
  showExportModal() {
    const modal = document.getElementById("exportUsersModal");
    if (!modal) {
      console.warn(
        "⚠️ Modal de exportación no encontrado, usando método alternativo"
      );
      this.showExportOptions();
      return;
    }

    // Actualizar estadísticas en el modal
    this.updateModalStatistics();

    // Mostrar modal
    new bootstrap.Modal(modal).show();
  },

  /**
   * Actualiza las estadísticas en el modal
   */
  updateModalStatistics() {
    const total = exportState.allUsers.length;
    const filtered = exportState.filteredUsers.length;
    const active = exportState.allUsers.filter((u) => u.estadoActivo).length;
    const inactive = total - active;
    const admins = exportState.allUsers.filter((u) => u.esAdmin).length;
    const regular = total - admins;

    // Actualizar contadores principales
    const elements = {
      statsTotal: total,
      statsFiltered: filtered,
      statsActive: active,
      badgeFiltered: `${filtered} usuarios`,
      badgeAll: `${total} usuarios`,
      badgeActive: `${active} usuarios`,
      badgeInactive: `${inactive} usuarios`,
      badgeAdmin: `${admins} usuarios`,
      badgeRegular: `${regular} usuarios`,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  },

  /**
   * Muestra opciones de exportación alternativas si no hay modal
   */
  async showExportOptions() {
    const totalUsers = exportState.allUsers.length;
    const filteredUsers = exportState.filteredUsers.length;

    const message =
      `📊 OPCIONES DE EXPORTACIÓN\n\n` +
      `🔍 Usuarios filtrados: ${filteredUsers}\n` +
      `👥 Todos los usuarios: ${totalUsers}\n` +
      `✅ Usuarios activos: ${
        exportState.allUsers.filter((u) => u.estadoActivo).length
      }\n` +
      `👨‍💼 Administradores: ${
        exportState.allUsers.filter((u) => u.esAdmin).length
      }\n\n` +
      `¿Deseas exportar los usuarios filtrados actuales?`;

    if (confirm(message)) {
      await exportFilteredUsersToExcel();
    } else {
      await this.showAdvancedOptions();
    }
  },

  /**
   * Muestra opciones avanzadas de exportación
   */
  async showAdvancedOptions() {
    const choice = prompt(
      `📋 OPCIONES AVANZADAS DE EXPORTACIÓN:\n\n` +
        `1️⃣ - Exportar usuarios filtrados (${exportState.filteredUsers.length})\n` +
        `2️⃣ - Exportar todos los usuarios (${exportState.allUsers.length})\n` +
        `3️⃣ - Exportar solo usuarios activos\n` +
        `4️⃣ - Exportar solo administradores\n` +
        `5️⃣ - Exportar solo usuarios inactivos\n` +
        `6️⃣ - Exportar solo usuarios regulares\n\n` +
        `Ingresa el número de tu opción (1-6):`
    );

    await this.executeExportChoice(choice);
  },

  /**
   * Ejecuta la opción de exportación seleccionada
   */
  async executeExportChoice(choice) {
    switch (choice) {
      case "1":
        await exportFilteredUsersToExcel();
        break;
      case "2":
        await exportAllUsersToExcel();
        break;
      case "3":
        await this.exportActiveUsers();
        break;
      case "4":
        await this.exportAdminUsers();
        break;
      case "5":
        await this.exportInactiveUsers();
        break;
      case "6":
        await this.exportRegularUsers();
        break;
      default:
        if (choice !== null) {
          exportUtils.showExportToast(
            "Opción inválida",
            "Por favor selecciona una opción válida (1-6)",
            "warning"
          );
        }
    }
  },

  // Métodos de exportación específicos
  async exportActiveUsers() {
    const activeUsers = exportState.allUsers.filter(
      (user) => user.estadoActivo
    );
    if (activeUsers.length === 0) {
      exportUtils.showExportToast(
        "Sin datos",
        "No hay usuarios activos para exportar",
        "warning"
      );
      return;
    }
    await exportUsersToExcel(activeUsers, "usuarios_activos_unfv");
  },

  async exportAdminUsers() {
    const adminUsers = exportState.allUsers.filter((user) => user.esAdmin);
    if (adminUsers.length === 0) {
      exportUtils.showExportToast(
        "Sin datos",
        "No hay administradores para exportar",
        "warning"
      );
      return;
    }
    await exportUsersToExcel(adminUsers, "administradores_unfv");
  },

  async exportInactiveUsers() {
    const inactiveUsers = exportState.allUsers.filter(
      (user) => !user.estadoActivo
    );
    if (inactiveUsers.length === 0) {
      exportUtils.showExportToast(
        "Sin datos",
        "No hay usuarios inactivos para exportar",
        "warning"
      );
      return;
    }
    await exportUsersToExcel(inactiveUsers, "usuarios_inactivos_unfv");
  },

  async exportRegularUsers() {
    const regularUsers = exportState.allUsers.filter((user) => !user.esAdmin);
    if (regularUsers.length === 0) {
      exportUtils.showExportToast(
        "Sin datos",
        "No hay usuarios regulares para exportar",
        "warning"
      );
      return;
    }
    await exportUsersToExcel(regularUsers, "usuarios_regulares_unfv");
  },
};

// =============================================
// FUNCIÓN PRINCIPAL Y INTEGRACIÓN
// =============================================

/**
 * Función principal de exportación - punto de entrada desde el CRUD
 */
async function exportUsers() {
  console.log("📊 Iniciando proceso de exportación...");

  // Verificar que tenemos datos
  if (!exportState.allUsers.length) {
    exportUtils.showExportToast(
      "Sin datos",
      "No hay usuarios cargados para exportar",
      "warning"
    );
    return;
  }

  // Pre-cargar XLSX de manera silenciosa (sin mostrar errores)
  try {
    await xlsxLoader.loadXLSX();
    console.log("✅ XLSX pre-cargado exitosamente");
  } catch (error) {
    console.log(
      "⚠️ XLSX no se pudo pre-cargar, se usará fallback durante exportación"
    );
  }

  // Mostrar modal o opciones
  modalManager.showExportModal();
}

/**
 * Ejecuta exportación específica desde el modal
 */
async function executeExport(type) {
  console.log(`🚀 Ejecutando exportación tipo: ${type}`);

  const exportTypes = {
    filtered: () => exportFilteredUsersToExcel(),
    all: () => exportAllUsersToExcel(),
    active: () => modalManager.exportActiveUsers(),
    inactive: () => modalManager.exportInactiveUsers(),
    admin: () => modalManager.exportAdminUsers(),
    regular: () => modalManager.exportRegularUsers(),
  };

  const exportFunction = exportTypes[type];
  if (exportFunction) {
    // Cerrar modal si existe
    const modal = document.getElementById("exportUsersModal");
    if (modal) {
      const bootstrapModal = bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) {
        bootstrapModal.hide();
      }
    }

    // Ejecutar exportación
    setTimeout(exportFunction, 300); // Pequeño delay para cerrar modal
  } else {
    exportUtils.showExportToast(
      "Error",
      "Tipo de exportación no válido",
      "error"
    );
  }
}

/**
 * Actualiza los datos de exportación desde el módulo principal
 */
function updateExportData(allUsers, filteredUsers) {
  exportState.allUsers = allUsers || [];
  exportState.filteredUsers = filteredUsers || [];
  console.log(
    `📊 Datos de exportación actualizados: ${
      allUsers?.length || 0
    } usuarios totales, ${filteredUsers?.length || 0} filtrados`
  );
}

// =============================================
// INICIALIZACIÓN Y EVENTOS
// =============================================
function initializeExportSystem() {
  console.log("🚀 Inicializando sistema de exportación mejorado...");

  // Pre-cargar XLSX de forma asíncrona y silenciosa
  xlsxLoader.loadXLSX().catch(() => {
    console.log(
      "📋 XLSX no disponible inicialmente, se cargará cuando sea necesario"
    );
  });

  // Hacer funciones globales para uso desde HTML
  window.exportUsers = exportUsers;
  window.executeExport = executeExport;
  window.exportFilteredUsersToExcel = exportFilteredUsersToExcel;
  window.exportAllUsersToExcel = exportAllUsersToExcel;
  window.updateExportData = updateExportData;

  // Evento para recibir datos del módulo principal
  document.addEventListener("exportDataUpdated", (event) => {
    if (event.detail) {
      updateExportData(event.detail.allUsers, event.detail.filteredUsers);
    }
  });

  console.log("✅ Sistema de exportación mejorado inicializado correctamente");
}

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExportSystem);
} else {
  initializeExportSystem();
}

// =============================================
// EXPORTACIONES
// =============================================
export {
  exportUsers,
  exportUsersToExcel,
  exportFilteredUsersToExcel,
  exportAllUsersToExcel,
  executeExport,
  updateExportData,
  initializeExportSystem,
};
