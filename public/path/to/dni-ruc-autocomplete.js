// Configuración de APIs
const API_CONFIG = {
  dni: {
    url: "https://apiperu.dev/api/dni",
    token: "ba742adab9788366016a4e5aef915cbe8d5747e509e3ce4e4250728ef32ecc41", // Reemplaza con tu token de APIPERU
  },
  ruc: {
    url: "https://apiperu.dev/api/ruc_sunat",
    token: "ba742adab9788366016a4e5aef915cbe8d5747e509e3ce4e4250728ef32ecc41", // Reemplaza con tu token de APIPERU
  },
};

// Función para mostrar loading en el campo
function showLoading(input, show = true) {
  const parent = input.parentElement;
  let loadingSpinner = parent.querySelector(".loading-spinner");

  if (show) {
    if (!loadingSpinner) {
      loadingSpinner = document.createElement("div");
      loadingSpinner.className = "loading-spinner position-absolute";
      loadingSpinner.style.cssText = `
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
      `;
      loadingSpinner.innerHTML =
        '<i class="fas fa-spinner fa-spin text-primary"></i>';
      parent.style.position = "relative";
      parent.appendChild(loadingSpinner);
    }
    loadingSpinner.style.display = "block";
    input.style.paddingRight = "40px";
  } else {
    if (loadingSpinner) {
      loadingSpinner.style.display = "none";
      input.style.paddingRight = "";
    }
  }
}

// Función para mostrar mensaje de estado
function showMessage(input, message, type = "info") {
  const parent = input.parentElement;
  let messageDiv = parent.querySelector(".api-message");

  if (!messageDiv) {
    messageDiv = document.createElement("div");
    messageDiv.className = "api-message form-text mt-1";
    parent.appendChild(messageDiv);
  }

  const iconClass =
    type === "success"
      ? "fa-check-circle text-success"
      : type === "error"
      ? "fa-exclamation-circle text-danger"
      : "fa-info-circle text-info";

  messageDiv.innerHTML = `<i class="fas ${iconClass}"></i> ${message}`;
  messageDiv.className = `api-message form-text mt-1 text-${
    type === "success" ? "success" : type === "error" ? "danger" : "info"
  }`;
}

// Función para limpiar mensajes
function clearMessage(input) {
  const parent = input.parentElement;
  const messageDiv = parent.querySelector(".api-message");
  if (messageDiv) {
    messageDiv.remove();
  }
}

// Función para consultar DNI
async function consultarDNI(dni) {
  try {
    const response = await fetch(`${API_CONFIG.dni.url}/${dni}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_CONFIG.dni.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: {
          nombres: data.data.nombres,
          apellidoPaterno: data.data.apellido_paterno,
          apellidoMaterno: data.data.apellido_materno,
          nombreCompleto: data.data.nombre_completo,
        },
      };
    } else {
      return {
        success: false,
        message: data.message || "DNI no encontrado",
      };
    }
  } catch (error) {
    console.error("Error consultando DNI:", error);
    return {
      success: false,
      message: "Error al consultar DNI. Verifica tu conexión.",
    };
  }
}

// Función para consultar RUC
async function consultarRUC(ruc) {
  try {
    const response = await fetch(`${API_CONFIG.ruc.url}/${ruc}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_CONFIG.ruc.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        data: {
          razonSocial: data.data.nombre_o_razon_social,
          estado: data.data.estado,
          condicion: data.data.condicion,
          direccion: data.data.direccion,
          distrito: data.data.distrito,
          provincia: data.data.provincia,
          departamento: data.data.departamento,
          representanteLegal: data.data.representante_legal,
        },
      };
    } else {
      return {
        success: false,
        message: data.message || "RUC no encontrado",
      };
    }
  } catch (error) {
    console.error("Error consultando RUC:", error);
    return {
      success: false,
      message: "Error al consultar RUC. Verifica tu conexión.",
    };
  }
}

// Función para validar formato DNI
function validarDNI(dni) {
  return /^\d{8}$/.test(dni);
}

// Función para validar formato RUC
function validarRUC(ruc) {
  return /^\d{11}$/.test(ruc);
}

// Debounce para evitar múltiples consultas
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Función principal para manejar DNI
const handleDNIInput = debounce(async (input) => {
  const dni = input.value.trim();

  // Limpiar mensajes previos
  clearMessage(input);

  if (!dni) return;

  if (!validarDNI(dni)) {
    if (dni.length === 8) {
      showMessage(input, "El DNI debe contener solo números", "error");
    }
    return;
  }

  // Mostrar loading
  showLoading(input, true);
  showMessage(input, "Consultando DNI...", "info");

  try {
    const result = await consultarDNI(dni);

    if (result.success) {
      // Llenar campos automáticamente
      const firstNameInput = document.querySelector('input[name="firstName"]');
      const lastNameInput = document.querySelector('input[name="lastName"]');

      if (firstNameInput && lastNameInput) {
        firstNameInput.value = result.data.nombres;
        lastNameInput.value = `${result.data.apellidoPaterno} ${result.data.apellidoMaterno}`;

        // Agregar clase de éxito
        firstNameInput.classList.add("is-valid");
        lastNameInput.classList.add("is-valid");
      }

      showMessage(
        input,
        `✓ Datos encontrados: ${result.data.nombreCompleto}`,
        "success"
      );
    } else {
      showMessage(input, result.message, "error");
    }
  } catch (error) {
    showMessage(input, "Error al consultar DNI", "error");
  } finally {
    showLoading(input, false);
  }
}, 1000);

// Función principal para manejar RUC
const handleRUCInput = debounce(async (input) => {
  const ruc = input.value.trim();

  // Limpiar mensajes previos
  clearMessage(input);

  if (!ruc) return;

  if (!validarRUC(ruc)) {
    if (ruc.length === 11) {
      showMessage(input, "El RUC debe contener solo números", "error");
    }
    return;
  }

  // Mostrar loading
  showLoading(input, true);
  showMessage(input, "Consultando RUC...", "info");

  try {
    const result = await consultarRUC(ruc);

    if (result.success) {
      // Llenar campos automáticamente
      const companyNameInput = document.querySelector(
        'input[name="companyName"]'
      );
      const representativeInput = document.querySelector(
        'input[name="representative"]'
      );
      const addressInput = document.querySelector('textarea[name="address"]');

      if (companyNameInput) {
        companyNameInput.value = result.data.razonSocial;
        companyNameInput.classList.add("is-valid");
      }

      if (representativeInput && result.data.representanteLegal) {
        representativeInput.value = result.data.representanteLegal;
        representativeInput.classList.add("is-valid");
      }

      if (addressInput && result.data.direccion) {
        const direccionCompleta = `${result.data.direccion}, ${result.data.distrito}, ${result.data.provincia}, ${result.data.departamento}`;
        addressInput.value = direccionCompleta;
        addressInput.classList.add("is-valid");
      }

      let statusMessage = `✓ Empresa encontrada: ${result.data.razonSocial}`;
      if (result.data.estado !== "ACTIVO") {
        statusMessage += ` (Estado: ${result.data.estado})`;
      }

      showMessage(input, statusMessage, "success");
    } else {
      showMessage(input, result.message, "error");
    }
  } catch (error) {
    showMessage(input, "Error al consultar RUC", "error");
  } finally {
    showLoading(input, false);
  }
}, 1000);

// Función para limpiar todos los campos del modal
function clearAllModalFields() {
  // Campos para DNI
  const dniInput = document.querySelector('input[name="dni"]');
  const firstNameInput = document.querySelector('input[name="firstName"]');
  const lastNameInput = document.querySelector('input[name="lastName"]');

  // Campos para RUC
  const rucInput = document.querySelector('input[name="ruc"]');
  const companyNameInput = document.querySelector('input[name="companyName"]');
  const representativeInput = document.querySelector(
    'input[name="representative"]'
  );
  const addressInput = document.querySelector('textarea[name="address"]');

  // Lista de todos los campos
  const allFields = [
    dniInput,
    firstNameInput,
    lastNameInput,
    rucInput,
    companyNameInput,
    representativeInput,
    addressInput,
  ];

  // Limpiar cada campo
  allFields.forEach((field) => {
    if (field) {
      field.value = "";
      field.classList.remove("is-valid", "is-invalid");
      clearMessage(field);
      showLoading(field, false);
    }
  });

  // Limpiar también cualquier mensaje de error que pueda quedar
  const allMessages = document.querySelectorAll(".api-message");
  allMessages.forEach((message) => message.remove());

  // Limpiar spinners de loading
  const allSpinners = document.querySelectorAll(".loading-spinner");
  allSpinners.forEach((spinner) => spinner.remove());

  console.log("✅ Todos los campos del modal han sido limpiados");
}

// Función para inicializar los event listeners
function initializeAutoComplete() {
  // Event listener para DNI
  const dniInput = document.querySelector('input[name="dni"]');
  if (dniInput) {
    dniInput.addEventListener("input", function (e) {
      // Solo permitir números
      e.target.value = e.target.value.replace(/[^0-9]/g, "");

      // Manejar autocompletado
      handleDNIInput(e.target);
    });

    // Limpiar validación al borrar
    dniInput.addEventListener("input", function (e) {
      if (!e.target.value) {
        const firstNameInput = document.querySelector(
          'input[name="firstName"]'
        );
        const lastNameInput = document.querySelector('input[name="lastName"]');

        if (firstNameInput) {
          firstNameInput.classList.remove("is-valid");
          firstNameInput.value = "";
        }
        if (lastNameInput) {
          lastNameInput.classList.remove("is-valid");
          lastNameInput.value = "";
        }

        clearMessage(e.target);
      }
    });
  }

  // Event listener para RUC
  const rucInput = document.querySelector('input[name="ruc"]');
  if (rucInput) {
    rucInput.addEventListener("input", function (e) {
      // Solo permitir números
      e.target.value = e.target.value.replace(/[^0-9]/g, "");

      // Manejar autocompletado
      handleRUCInput(e.target);
    });

    // Limpiar validación al borrar
    rucInput.addEventListener("input", function (e) {
      if (!e.target.value) {
        const companyNameInput = document.querySelector(
          'input[name="companyName"]'
        );
        const representativeInput = document.querySelector(
          'input[name="representative"]'
        );
        const addressInput = document.querySelector('textarea[name="address"]');

        if (companyNameInput) {
          companyNameInput.classList.remove("is-valid");
          companyNameInput.value = "";
        }
        if (representativeInput) {
          representativeInput.classList.remove("is-valid");
          representativeInput.value = "";
        }
        if (addressInput) {
          addressInput.classList.remove("is-valid");
          addressInput.value = "";
        }

        clearMessage(e.target);
      }
    });
  }
}

// Función para inicializar los event listeners del modal
function initializeModalEvents() {
  const donorDataModal = document.getElementById("donorDataModal");

  if (donorDataModal) {
    // Evento cuando se abre el modal
    donorDataModal.addEventListener("shown.bs.modal", function () {
      initializeAutoComplete();
      console.log("✅ Modal abierto - Autocompletado inicializado");
    });

    // Evento cuando se cierra el modal (con X o botón cerrar)
    donorDataModal.addEventListener("hidden.bs.modal", function () {
      clearAllModalFields();
      console.log("✅ Modal cerrado - Campos limpiados");
    });

    // Evento cuando se está cerrando el modal (antes de que se cierre completamente)
    donorDataModal.addEventListener("hide.bs.modal", function () {
      console.log("ℹ️ Modal cerrándose...");
    });
  }

  // También agregar event listeners a los botones de cerrar específicos
  const closeButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Pequeño delay para asegurar que el modal se cierre
      setTimeout(() => {
        clearAllModalFields();
      }, 100);
    });
  });
}

// Función para validar configuración de API
function validateApiConfig() {
  if (
    API_CONFIG.dni.token === "TU_TOKEN_AQUI" ||
    API_CONFIG.ruc.token === "TU_TOKEN_AQUI"
  ) {
    console.warn(
      "⚠️ IMPORTANTE: Debes configurar tus tokens de APIPERU en API_CONFIG"
    );
    return false;
  }
  return true;
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", function () {
  // Validar configuración
  if (!validateApiConfig()) {
    console.error(
      "❌ Configuración de API incompleta. El autocompletado no funcionará."
    );
    return;
  }

  // Inicializar autocompletado
  initializeAutoComplete();

  // Inicializar eventos del modal
  initializeModalEvents();

  console.log("✅ Autocompletado DNI/RUC inicializado correctamente");
});

// Función adicional para limpiar manualmente (por si necesitas llamarla desde otro lugar)
window.clearDonorModal = clearAllModalFields;
