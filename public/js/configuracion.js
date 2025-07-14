// configuracion.js - Versión optimizada para producción
import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "./firebase_config.js";

// Variables globales
let currentUser = null;
let userProfile = null;
let isDataLoaded = false;

// Configuración de Cloudinary
const CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

const CLOUDINARY_UPLOAD_PRESET = CLOUDINARY_CONFIG.uploadPreset;
const CLOUDINARY_CLOUD_NAME = CLOUDINARY_CONFIG.cloudName;

// Datos estáticos del sistema
const FACULTADES = {
  F001: "Facultad de Ingeniería Electrónica e Informática",
};

const ESCUELAS = {
  E001: "Ingeniería Informática",
  E002: "Ingeniería Electrónica",
  E003: "Ingeniería Mecatrónica",
  E004: "Ingeniería Telecomunicaciones",
};

const BANCOS = [
  "BCP",
  "BBVA",
  "Scotiabank",
  "Interbank",
  "BanBif",
  "Pichincha",
];

const TALLAS = ["XS", "S", "M", "L", "XL", "XXL"];

const CICLOS_ROMANOS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
];

// Inicialización del sistema
document.addEventListener("DOMContentLoaded", function () {
  populateStaticData();
  setupEventListeners();
  initializeAuth();
});

// Autenticación y carga de datos
function initializeAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await loadUserProfile();

      // Delay para asegurar que el DOM esté completamente listo
      setTimeout(() => {
        populateFormFields();
      }, 500);
    } else {
      window.location.href = "login.html";
    }
  });
}

// Cargar perfil del usuario desde Firestore
async function loadUserProfile() {
  try {
    if (!currentUser) return;

    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));

    if (userDoc.exists()) {
      userProfile = userDoc.data();
      isDataLoaded = true;
    } else {
      await createDefaultProfile();
    }
  } catch (error) {
    showMessage("Error al cargar el perfil del usuario", "danger");
  }
}

// Crear perfil por defecto si no existe
async function createDefaultProfile() {
  try {
    const defaultProfile = {
      idUsuario: currentUser.uid,
      nombreUsuario: "",
      apellidoUsuario: "",
      correo: currentUser.email,
      celular: "",
      edad: "",
      facultadID: "",
      escuelaID: "",
      ciclo: "",
      poloTallaID: "",
      banco: "",
      cuentaBancaria: "",
      Yape: "",
      fotoPerfil:
        "https://res.cloudinary.com/dupkeaqnz/image/upload/v1750485086/h1yjan3omjtlrot1a4wa.jpg",
      idRol: "rol_004",
      esAdmin: "false",
      estadoActivo: "true",
      codigoUsuario: generateUserCode(),
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    };

    await setDoc(doc(db, "usuarios", currentUser.uid), defaultProfile);
    userProfile = defaultProfile;
  } catch (error) {
    showMessage("Error al crear el perfil", "danger");
  }
}

// Generar código de usuario único
function generateUserCode() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `USR${timestamp}${random}`;
}

// Poblar datos estáticos en los selects
function populateStaticData() {
  // Facultades
  const facultadSelect = document.getElementById("facultadId");
  if (facultadSelect) {
    const firstOption = facultadSelect.querySelector('option[value=""]');
    facultadSelect.innerHTML = "";
    if (firstOption) facultadSelect.appendChild(firstOption);

    Object.entries(FACULTADES).forEach(([id, nombre]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = nombre;
      facultadSelect.appendChild(option);
    });
  }

  // Bancos
  const bancoSelect = document.getElementById("banco");
  if (bancoSelect) {
    const firstOption = bancoSelect.querySelector('option[value=""]');
    bancoSelect.innerHTML = "";
    if (firstOption) bancoSelect.appendChild(firstOption);

    BANCOS.forEach((banco) => {
      const option = document.createElement("option");
      option.value = banco;
      option.textContent = banco;
      bancoSelect.appendChild(option);
    });
  }

  // Tallas
  const tallaSelect = document.getElementById("poloTallaID");
  if (tallaSelect) {
    const firstOption = tallaSelect.querySelector('option[value=""]');
    tallaSelect.innerHTML = "";
    if (firstOption) tallaSelect.appendChild(firstOption);

    TALLAS.forEach((talla) => {
      const option = document.createElement("option");
      option.value = talla;
      option.textContent = talla;
      tallaSelect.appendChild(option);
    });
  }

  // Ciclos
  const cicloSelect = document.getElementById("ciclo");
  if (cicloSelect) {
    cicloSelect.innerHTML = '<option value="">Selecciona tu ciclo</option>';

    CICLOS_ROMANOS.forEach((romano) => {
      const option = document.createElement("option");
      option.value = romano;
      option.textContent = `${romano} Ciclo`;
      cicloSelect.appendChild(option);
    });
  }
}

// Poblar campos del formulario con datos del usuario
function populateFormFields() {
  if (!userProfile || !isDataLoaded) return;

  // Campos editables
  const fields = {
    nombreUsuario: userProfile.nombreUsuario || "",
    apellidoUsuario: userProfile.apellidoUsuario || "",
    edad: userProfile.edad || "",
  };

  // Poblar campos básicos
  Object.entries(fields).forEach(([fieldId, value]) => {
    const element = document.getElementById(fieldId);
    if (element) element.value = value;
  });

  // Celular con formato
  const celularInput = document.getElementById("celular");
  if (celularInput && userProfile.celular) {
    const celular = userProfile.celular;
    celularInput.value =
      celular.length === 9
        ? `${celular.substring(0, 3)} ${celular.substring(
            3,
            6
          )} ${celular.substring(6)}`
        : celular;
  }

  // Selects
  const selects = {
    facultadId: userProfile.facultadID,
    ciclo: userProfile.ciclo,
    poloTallaID: userProfile.poloTallaID,
    banco: userProfile.banco,
  };

  Object.entries(selects).forEach(([selectId, value]) => {
    const element = document.getElementById(selectId);
    if (element && value) element.value = value;
  });

  // Campos de solo lectura
  const readonlyFields = [
    { id: "correo", value: userProfile.correo || "" },
    { id: "codigoUsuario", value: userProfile.codigoUsuario || "" },
    {
      id: "idRol",
      value:
        {
          rol_001: "Administrador",
          rol_002: "Coordinador",
          rol_003: "Voluntario",
          rol_004: "Recolector de Donaciones",
        }[userProfile.idRol] ||
        userProfile.idRol ||
        "",
    },
  ];

  readonlyFields.forEach(({ id, value }) => {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
      element.disabled = true;
      element.style.backgroundColor = "#f8f9fa";
      element.style.cursor = "not-allowed";
    }
  });

  // Cuenta bancaria con formato
  const cuentaInput = document.getElementById("cuentaBancaria");
  if (cuentaInput && userProfile.cuentaBancaria) {
    const cuenta = userProfile.cuentaBancaria;
    cuentaInput.value =
      cuenta.length > 4 ? cuenta.match(/.{1,4}/g).join("-") : cuenta;
  }

  // Yape con formato (múltiples intentos)
  const autocompletarYape = () => {
    const yapeInput = document.getElementById("yape");
    if (yapeInput && userProfile.Yape) {
      const yape = userProfile.Yape;
      yapeInput.value =
        yape.length === 9 && /^\d{9}$/.test(yape)
          ? `${yape.substring(0, 3)} ${yape.substring(3, 6)} ${yape.substring(
              6
            )}`
          : yape;
      return true;
    }
    return false;
  };

  if (!autocompletarYape()) {
    setTimeout(() => {
      if (!autocompletarYape()) {
        setTimeout(autocompletarYape, 300);
      }
    }, 100);
  }

  // Foto de perfil
  const profileImage = document.getElementById("profileImage");
  if (profileImage && userProfile.fotoPerfil) {
    profileImage.src = userProfile.fotoPerfil;
  }

  // Actualizar escuelas
  if (userProfile.facultadID) {
    updateEscuelas(userProfile.facultadID);
    setTimeout(() => {
      const escuelaSelect = document.getElementById("escuelaID");
      if (escuelaSelect && userProfile.escuelaID) {
        escuelaSelect.value = userProfile.escuelaID;
      }
    }, 200);
  }
}

// Actualizar escuelas según la facultad seleccionada
function updateEscuelas(facultadId) {
  const escuelaSelect = document.getElementById("escuelaID");
  if (!escuelaSelect) return;

  escuelaSelect.innerHTML = '<option value="">Selecciona una escuela</option>';

  if (facultadId === "F001") {
    Object.entries(ESCUELAS).forEach(([id, nombre]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = nombre;
      escuelaSelect.appendChild(option);
    });
  }
}

// Configurar event listeners
function setupEventListeners() {
  setupImageUpload();
  setupNumberFormatting();

  // Cambio de facultad
  const facultadSelect = document.getElementById("facultadId");
  if (facultadSelect) {
    facultadSelect.addEventListener("change", function () {
      updateEscuelas(this.value);
      const escuelaSelect = document.getElementById("escuelaID");
      if (escuelaSelect) escuelaSelect.value = "";
    });
  }

  // Botones principales
  const saveButton = document.querySelector(".btn-primary");
  const cancelButton = document.querySelector(".btn-outline-secondary");

  if (saveButton) saveButton.addEventListener("click", saveProfile);
  if (cancelButton) cancelButton.addEventListener("click", cancelChanges);
}

// Configurar subida de imagen
function setupImageUpload() {
  const fileInput = document.getElementById("fileInput");
  const profileImage = document.getElementById("profileImage");

  if (!fileInput || !profileImage) return;

  fileInput.addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar archivo
    if (!file.type.startsWith("image/")) {
      showMessage("Por favor selecciona un archivo de imagen válido", "danger");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage("El archivo es demasiado grande. Máximo 5MB", "danger");
      return;
    }

    const originalSrc = profileImage.src;

    try {
      // Mostrar preview
      const reader = new FileReader();
      reader.onload = (e) => (profileImage.src = e.target.result);
      reader.readAsDataURL(file);

      // Subir a Cloudinary
      const imageUrl = await uploadToCloudinary(file);
      await updateProfileImage(imageUrl);

      showMessage("Foto de perfil actualizada correctamente", "success");
    } catch (error) {
      showMessage("Error al subir la imagen", "danger");
      profileImage.src = originalSrc;
    }
  });
}

// Subir imagen a Cloudinary
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Error al subir imagen a Cloudinary");
  }

  const data = await response.json();
  return data.secure_url;
}

// Actualizar foto de perfil en la base de datos
async function updateProfileImage(imageUrl) {
  await updateDoc(doc(db, "usuarios", currentUser.uid), {
    fotoPerfil: imageUrl,
    fechaActualizacion: serverTimestamp(),
  });

  userProfile.fotoPerfil = imageUrl;
}

// Configurar formateo de números
function setupNumberFormatting() {
  // Formato de teléfono
  ["celular", "yape"].forEach((inputId) => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener("input", function () {
        formatPhoneNumber(this);
      });
    }
  });

  // Formato de cuenta bancaria
  const cuentaInput = document.getElementById("cuentaBancaria");
  if (cuentaInput) {
    cuentaInput.addEventListener("input", function () {
      formatAccountNumber(this);
    });
  }
}

// Formatear número de teléfono
function formatPhoneNumber(input) {
  let value = input.value.replace(/\D/g, "");
  if (value.length > 9) value = value.substring(0, 9);

  if (value.length >= 6) {
    value = `${value.substring(0, 3)} ${value.substring(
      3,
      6
    )} ${value.substring(6)}`;
  } else if (value.length >= 3) {
    value = `${value.substring(0, 3)} ${value.substring(3)}`;
  }

  input.value = value;
}

// Formatear número de cuenta
function formatAccountNumber(input) {
  let value = input.value.replace(/\D/g, "");
  if (value.length > 16) value = value.substring(0, 16);

  if (value.length > 0) {
    value = value.match(/.{1,4}/g).join("-");
  }

  input.value = value;
}

// Validar formulario completo
function validateForm() {
  const requiredFields = [
    "nombreUsuario",
    "apellidoUsuario",
    "celular",
    "edad",
    "facultadId",
    "escuelaID",
    "ciclo",
  ];

  for (let fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      const label = field?.previousElementSibling?.textContent || fieldId;
      showMessage(`El campo ${label} es requerido`, "danger");
      field?.focus();
      return false;
    }
  }

  // Validar edad
  const edadInput = document.getElementById("edad");
  if (edadInput) {
    const edad = parseInt(edadInput.value);
    if (isNaN(edad) || edad < 16 || edad > 80) {
      showMessage("La edad debe estar entre 16 y 80 años", "danger");
      return false;
    }
  }

  // Validar ciclo
  const cicloInput = document.getElementById("ciclo");
  if (cicloInput && !CICLOS_ROMANOS.includes(cicloInput.value)) {
    showMessage("Debe seleccionar un ciclo académico válido", "danger");
    return false;
  }

  return true;
}

// Guardar perfil
async function saveProfile() {
  if (!validateForm()) return;

  const saveButton = document.querySelector(".btn-primary");
  if (!saveButton) return;

  // Prevenir múltiples clics
  if (saveButton.disabled) return;

  const originalText = saveButton.innerHTML;

  try {
    // Deshabilitar botón inmediatamente
    saveButton.disabled = true;
    saveButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

    // Recopilar datos del formulario
    const profileData = {
      nombreUsuario:
        document.getElementById("nombreUsuario")?.value.trim() || "",
      apellidoUsuario:
        document.getElementById("apellidoUsuario")?.value.trim() || "",
      celular:
        document.getElementById("celular")?.value.replace(/\s/g, "") || "",
      edad: document.getElementById("edad")?.value || "",
      facultadID: document.getElementById("facultadId")?.value || "",
      escuelaID: document.getElementById("escuelaID")?.value || "",
      ciclo: document.getElementById("ciclo")?.value || "",
      poloTallaID: document.getElementById("poloTallaID")?.value || "",
      banco: document.getElementById("banco")?.value || "",
      cuentaBancaria:
        document.getElementById("cuentaBancaria")?.value.replace(/-/g, "") ||
        "",
      Yape: document.getElementById("yape")?.value.replace(/\s/g, "") || "",
      fechaActualizacion: serverTimestamp(),
    };

    // Actualizar en Firestore
    await updateDoc(doc(db, "usuarios", currentUser.uid), profileData);

    // Actualizar perfil local
    userProfile = { ...userProfile, ...profileData };

    showMessage("Perfil actualizado correctamente", "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    showMessage(`Error al guardar el perfil: ${error.message}`, "danger");
  }

  // Restaurar botón después de un pequeño delay
  setTimeout(() => {
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }, 500);
}

// Cancelar cambios
function cancelChanges() {
  if (
    confirm(
      "¿Estás seguro de que deseas cancelar los cambios? Se perderán todos los datos no guardados."
    )
  ) {
    populateFormFields();
    showMessage("Cambios cancelados", "info");
  }
}

// Mostrar mensajes
function showMessage(message, type) {
  const messageContainer = document.getElementById("messageContainer");
  if (!messageContainer) return;

  const alertClass =
    type === "danger" ? "danger" : type === "success" ? "success" : "info";
  const iconClass =
    type === "success"
      ? "check-circle"
      : type === "danger"
      ? "exclamation-triangle"
      : "info-circle";

  messageContainer.innerHTML = `
    <div class="alert alert-${alertClass} alert-dismissible fade show" role="alert">
      <i class="fas fa-${iconClass} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  // Auto-hide después de 5 segundos
  setTimeout(() => {
    const alert = messageContainer.querySelector(".alert");
    if (alert) alert.remove();
  }, 5000);
}

// Sidebar toggle para móviles
function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("show");
  }
}

// Cerrar sidebar al hacer clic fuera en móviles
document.addEventListener("click", function (e) {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const isClickInsideSidebar = sidebar.contains(e.target);
  const isMobile = window.innerWidth <= 992;

  if (!isClickInsideSidebar && isMobile && sidebar.classList.contains("show")) {
    sidebar.classList.remove("show");
  }
});

// Funciones globales
window.saveProfile = saveProfile;
window.cancelChanges = cancelChanges;
window.toggleSidebar = toggleSidebar;
