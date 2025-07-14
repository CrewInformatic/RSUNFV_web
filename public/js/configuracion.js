// configuracion.js
import {
  auth,
  db,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
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

// Para compatibilidad con el código existente
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

// Inicialización del sistema
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM cargado, iniciando sistema...");

  // Primero poblar los datos estáticos
  populateStaticData();

  // Luego configurar los event listeners
  setupEventListeners();

  // Finalmente inicializar la autenticación
  initializeAuth();
});

// Autenticación y carga de datos
function initializeAuth() {
  console.log("Inicializando autenticación...");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("Usuario autenticado:", user.email);
      currentUser = user;
      await loadUserProfile();

      // Esperar un poco más para asegurar que el DOM esté listo
      setTimeout(() => {
        console.log("🔄 Iniciando autocompletado de campos...");
        populateFormFields();
      }, 800); // Aumenté el timeout
    } else {
      console.log("Usuario no autenticado, redirigiendo...");
      // Redirigir al login si no hay usuario autenticado
      window.location.href = "login.html";
    }
  });
}

// Cargar perfil del usuario desde Firestore
async function loadUserProfile() {
  try {
    if (!currentUser) {
      console.log("No hay usuario actual");
      return;
    }

    console.log("Cargando perfil para usuario:", currentUser.uid);
    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));

    if (userDoc.exists()) {
      userProfile = userDoc.data();
      isDataLoaded = true;
      console.log("Perfil cargado exitosamente:", userProfile);

      // Debug específico para Yape
      console.log("🔍 DEBUG YAPE:");
      console.log("- userProfile.yape:", userProfile.yape);
      console.log("- Tipo:", typeof userProfile.yape);
      console.log("- Longitud:", userProfile.yape?.length);
      console.log("- Es número?", /^\d+$/.test(userProfile.yape || ""));
    } else {
      console.log(
        "No se encontró el perfil del usuario, creando uno por defecto"
      );
      await createDefaultProfile();
    }
  } catch (error) {
    console.error("Error al cargar el perfil:", error);
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
      edad: "", // STRING
      facultadID: "", // Corregido: facultadID (mayúscula)
      escuelaID: "", // Corregido: escuelaID (mayúscula)
      ciclo: "", // STRING en formato romano: "I", "II", etc.
      poloTallaID: "",
      banco: "",
      cuentaBancaria: "",
      yape: "",
      fotoPerfil:
        "https://res.cloudinary.com/dupkeaqnz/image/upload/v1750485086/h1yjan3omjtlrot1a4wa.jpg",
      idRol: "rol_004", // Rol de recolector de donaciones por defecto
      esAdmin: "false", // STRING
      estadoActivo: "true", // STRING
      codigoUsuario: generateUserCode(),
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    };

    await setDoc(doc(db, "usuarios", currentUser.uid), defaultProfile);
    userProfile = defaultProfile;
    console.log("Perfil por defecto creado");
  } catch (error) {
    console.error("Error al crear perfil por defecto:", error);
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
  console.log("Poblando datos estáticos...");

  // Facultades
  const facultadSelect = document.getElementById("facultadId");
  if (facultadSelect) {
    // Limpiar opciones existentes EXCEPTO la primera
    const firstOption = facultadSelect.querySelector('option[value=""]');
    facultadSelect.innerHTML = "";
    if (firstOption) facultadSelect.appendChild(firstOption);

    Object.entries(FACULTADES).forEach(([id, nombre]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = nombre;
      facultadSelect.appendChild(option);
    });
    console.log("Facultades pobladas:", FACULTADES);
  }

  // Bancos
  const bancoSelect = document.getElementById("banco");
  if (bancoSelect) {
    // Limpiar opciones existentes EXCEPTO la primera
    const firstOption = bancoSelect.querySelector('option[value=""]');
    bancoSelect.innerHTML = "";
    if (firstOption) bancoSelect.appendChild(firstOption);

    BANCOS.forEach((banco) => {
      const option = document.createElement("option");
      option.value = banco;
      option.textContent = banco;
      bancoSelect.appendChild(option);
    });
    console.log("Bancos poblados:", BANCOS);
  }

  // Tallas
  const tallaSelect = document.getElementById("poloTallaID");
  if (tallaSelect) {
    // Limpiar opciones existentes EXCEPTO la primera
    const firstOption = tallaSelect.querySelector('option[value=""]');
    tallaSelect.innerHTML = "";
    if (firstOption) tallaSelect.appendChild(firstOption);

    TALLAS.forEach((talla) => {
      const option = document.createElement("option");
      option.value = talla;
      option.textContent = talla;
      tallaSelect.appendChild(option);
    });
    console.log("Tallas pobladas:", TALLAS);
  }

  // Ciclos - REEMPLAZAR completamente para usar valores romanos
  const cicloSelect = document.getElementById("ciclo");
  if (cicloSelect) {
    cicloSelect.innerHTML = '<option value="">Selecciona tu ciclo</option>';
    const ciclosRomanos = [
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

    ciclosRomanos.forEach((romano, index) => {
      const option = document.createElement("option");
      option.value = romano; // Valor en romano: "I", "II", etc.
      option.textContent = `${romano} Ciclo`;
      cicloSelect.appendChild(option);
    });
    console.log("Ciclos poblados con valores romanos:", ciclosRomanos);
  }
}

// Poblar campos del formulario con datos del usuario
function populateFormFields() {
  if (!userProfile || !isDataLoaded) {
    console.log("Perfil no cargado aún", { userProfile, isDataLoaded });
    return;
  }

  console.log("🔄 POBLANDO CAMPOS CON PERFIL:", userProfile);

  // CAMPOS EDITABLES
  const nombreInput = document.getElementById("nombreUsuario");
  const apellidoInput = document.getElementById("apellidoUsuario");
  const celularInput = document.getElementById("celular");
  const edadInput = document.getElementById("edad");
  const facultadSelect = document.getElementById("facultadId");
  const escuelaSelect = document.getElementById("escuelaID");
  const cicloSelect = document.getElementById("ciclo");
  const tallaSelect = document.getElementById("poloTallaID");

  if (nombreInput) {
    nombreInput.value = userProfile.nombreUsuario || "";
    console.log("✅ Nombre poblado:", nombreInput.value);
  }
  if (apellidoInput) {
    apellidoInput.value = userProfile.apellidoUsuario || "";
    console.log("✅ Apellido poblado:", apellidoInput.value);
  }
  if (celularInput) {
    // Formatear el celular al mostrarlo
    const celular = userProfile.celular || "";
    if (celular.length === 9) {
      celularInput.value =
        celular.substring(0, 3) +
        " " +
        celular.substring(3, 6) +
        " " +
        celular.substring(6);
    } else {
      celularInput.value = celular;
    }
    console.log("✅ Celular poblado:", celularInput.value);
  }
  if (edadInput) {
    edadInput.value = userProfile.edad || "";
    console.log("✅ Edad poblada:", edadInput.value);
  }

  // FACULTAD - AUTOCOMPLETE
  if (facultadSelect && userProfile.facultadID) {
    facultadSelect.value = userProfile.facultadID;
    console.log(
      "🎯 FACULTAD AUTOCOMPLETADA:",
      userProfile.facultadID,
      "→",
      facultadSelect.options[facultadSelect.selectedIndex]?.text
    );
  }

  // CICLO - AUTOCOMPLETE
  if (cicloSelect && userProfile.ciclo) {
    cicloSelect.value = userProfile.ciclo;
    console.log(
      "🎯 CICLO AUTOCOMPLETADO:",
      userProfile.ciclo,
      "→",
      cicloSelect.options[cicloSelect.selectedIndex]?.text
    );
  }

  // TALLA - AUTOCOMPLETE
  if (tallaSelect && userProfile.poloTallaID) {
    tallaSelect.value = userProfile.poloTallaID;
    console.log("🎯 TALLA AUTOCOMPLETADA:", userProfile.poloTallaID);
  }

  // CAMPOS NO EDITABLES (Solo lectura)
  const correoInput = document.getElementById("correo");
  const codigoUsuarioInput = document.getElementById("codigoUsuario");
  const rolInput = document.getElementById("idRol");

  if (correoInput) {
    correoInput.value = userProfile.correo || "";
    correoInput.disabled = true;
    correoInput.style.backgroundColor = "#f8f9fa";
    correoInput.style.cursor = "not-allowed";
    console.log("🔒 Correo poblado (readonly):", correoInput.value);
  }

  if (codigoUsuarioInput) {
    codigoUsuarioInput.value = userProfile.codigoUsuario || "";
    codigoUsuarioInput.disabled = true;
    codigoUsuarioInput.style.backgroundColor = "#f8f9fa";
    codigoUsuarioInput.style.cursor = "not-allowed";
    console.log(
      "🔒 Código usuario poblado (readonly):",
      codigoUsuarioInput.value
    );
  }

  if (rolInput) {
    const rolesNombres = {
      rol_001: "Administrador",
      rol_002: "Coordinador",
      rol_003: "Voluntario",
      rol_004: "Recolector de Donaciones",
    };
    rolInput.value = rolesNombres[userProfile.idRol] || userProfile.idRol || "";
    rolInput.disabled = true;
    rolInput.style.backgroundColor = "#f8f9fa";
    rolInput.style.cursor = "not-allowed";
    console.log("🔒 Rol poblado (readonly):", rolInput.value);
  }

  // INFORMACIÓN BANCARIA - AUTOCOMPLETE
  const bancoSelect = document.getElementById("banco");
  const cuentaInput = document.getElementById("cuentaBancaria");
  const yapeInput = document.getElementById("yape");

  console.log("🔍 Verificando elementos bancarios:");
  console.log("- bancoSelect:", !!bancoSelect);
  console.log("- cuentaInput:", !!cuentaInput);
  console.log("- yapeInput:", !!yapeInput);

  // BANCO - AUTOCOMPLETE
  if (bancoSelect && userProfile.banco) {
    bancoSelect.value = userProfile.banco;
    console.log(
      "🎯 BANCO AUTOCOMPLETADO:",
      userProfile.banco,
      "→",
      bancoSelect.options[bancoSelect.selectedIndex]?.text
    );
  }

  // CUENTA BANCARIA - AUTOCOMPLETE Y FORMATO
  if (cuentaInput && userProfile.cuentaBancaria) {
    const cuenta = userProfile.cuentaBancaria;
    if (cuenta && cuenta.length > 4) {
      cuentaInput.value = cuenta.match(/.{1,4}/g).join("-");
    } else {
      cuentaInput.value = cuenta;
    }
    console.log("🎯 CUENTA BANCARIA AUTOCOMPLETADA:", cuentaInput.value);
  }

  // YAPE - AUTOCOMPLETE Y FORMATO (con múltiples intentos)
  function autocompletarYape() {
    const yapeInputNow = document.getElementById("yape");
    console.log("🔍 Reintentando Yape - Input encontrado:", !!yapeInputNow);

    if (yapeInputNow && userProfile.yape) {
      const yape = userProfile.yape || "";
      console.log(
        "🔍 Yape desde Firebase:",
        yape,
        "Longitud:",
        yape.length,
        "Tipo:",
        typeof yape
      );

      if (yape) {
        // Si tiene exactamente 9 dígitos, formatear
        if (yape.length === 9 && /^\d{9}$/.test(yape)) {
          yapeInputNow.value =
            yape.substring(0, 3) +
            " " +
            yape.substring(3, 6) +
            " " +
            yape.substring(6);
          console.log(
            "🎯 YAPE AUTOCOMPLETADO Y FORMATEADO:",
            yapeInputNow.value
          );
        } else {
          // Si no tiene 9 dígitos exactos, mostrar tal como está
          yapeInputNow.value = yape;
          console.log(
            "🎯 YAPE AUTOCOMPLETADO SIN FORMATO:",
            yapeInputNow.value
          );
        }
        return true; // Éxito
      }
    }
    return false; // Falló
  }

  // Intentar autocompletar Yape inmediatamente
  if (!autocompletarYape()) {
    console.log("⏳ Primer intento de Yape falló, reintentando en 100ms...");
    setTimeout(() => {
      if (!autocompletarYape()) {
        console.log(
          "⏳ Segundo intento de Yape falló, reintentando en 300ms..."
        );
        setTimeout(() => {
          if (!autocompletarYape()) {
            console.log(
              "❌ Yape no se pudo autocompletar después de 3 intentos"
            );
          }
        }, 300);
      }
    }, 100);
  }

  // FOTO DE PERFIL
  const profileImage = document.getElementById("profileImage");
  if (profileImage && userProfile.fotoPerfil) {
    profileImage.src = userProfile.fotoPerfil;
    console.log("🖼️ Foto de perfil poblada:", userProfile.fotoPerfil);
  }

  // ACTUALIZAR ESCUELAS Y AUTOCOMPLETAR
  if (userProfile.facultadID) {
    updateEscuelas(userProfile.facultadID);
    // Después de actualizar las escuelas, seleccionar la escuela del usuario
    setTimeout(() => {
      if (escuelaSelect && userProfile.escuelaID) {
        escuelaSelect.value = userProfile.escuelaID;
        console.log(
          "🎯 ESCUELA AUTOCOMPLETADA:",
          userProfile.escuelaID,
          "→",
          escuelaSelect.options[escuelaSelect.selectedIndex]?.text
        );
      }
    }, 200); // Aumenté el timeout para asegurar que las escuelas se carguen
  }

  console.log("✅ AUTOCOMPLETADO TERMINADO");
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
  // Toggle de contraseñas
  setupPasswordToggles();

  // Subida de imagen
  setupImageUpload();

  // Formateo de números
  setupNumberFormatting();

  // Cambio de facultad
  const facultadSelect = document.getElementById("facultadId");
  if (facultadSelect) {
    facultadSelect.addEventListener("change", function () {
      updateEscuelas(this.value);
      const escuelaSelect = document.getElementById("escuelaID");
      if (escuelaSelect) escuelaSelect.value = ""; // Limpiar escuela seleccionada
    });
  }

  // Validación de contraseña en tiempo real
  const confirmPasswordInput = document.getElementById("confirmPassword");
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener("input", validatePasswordMatch);
  }

  // Botones principales
  const saveButton = document.querySelector(".btn-primary");
  const cancelButton = document.querySelector(".btn-outline-secondary");

  if (saveButton) saveButton.addEventListener("click", saveProfile);
  if (cancelButton) cancelButton.addEventListener("click", cancelChanges);
}

// Configurar toggles de contraseña
function setupPasswordToggles() {
  const toggles = [
    { inputId: "currentPassword", buttonId: "toggleCurrentPassword" },
    { inputId: "newPassword", buttonId: "toggleNewPassword" },
    { inputId: "confirmPassword", buttonId: "toggleConfirmPassword" },
  ];

  toggles.forEach(({ inputId, buttonId }) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener("click", () => togglePassword(inputId, buttonId));
    }
  });
}

// Toggle de visibilidad de contraseña
function togglePassword(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);

  if (!input || !button) return;

  const icon = button.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    if (icon) {
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    }
  } else {
    input.type = "password";
    if (icon) {
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  }
}

// Configurar subida de imagen
function setupImageUpload() {
  const fileInput = document.getElementById("fileInput");
  const profileImage = document.getElementById("profileImage");

  if (!fileInput || !profileImage) return;

  fileInput.addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (file) {
      // Validar archivo
      if (!file.type.startsWith("image/")) {
        showMessage(
          "Por favor selecciona un archivo de imagen válido",
          "danger"
        );
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        // 5MB
        showMessage("El archivo es demasiado grande. Máximo 5MB", "danger");
        return;
      }

      try {
        // Mostrar preview inmediatamente
        const reader = new FileReader();
        reader.onload = function (e) {
          profileImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Subir a Cloudinary
        const imageUrl = await uploadToCloudinary(file);

        // Actualizar en la base de datos
        await updateProfileImage(imageUrl);

        showMessage("Foto de perfil actualizada correctamente", "success");
      } catch (error) {
        console.error("Error al subir imagen:", error);
        showMessage("Error al subir la imagen", "danger");

        // Restaurar imagen anterior
        if (userProfile && userProfile.fotoPerfil) {
          profileImage.src = userProfile.fotoPerfil;
        }
      }
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
  try {
    await updateDoc(doc(db, "usuarios", currentUser.uid), {
      fotoPerfil: imageUrl,
      fechaActualizacion: serverTimestamp(),
    });

    // Actualizar perfil local
    userProfile.fotoPerfil = imageUrl;
  } catch (error) {
    console.error("Error al actualizar foto de perfil:", error);
    throw error;
  }
}

// Configurar formateo de números
function setupNumberFormatting() {
  // Formato de teléfono
  const phoneInputs = ["celular", "yape"];
  phoneInputs.forEach((inputId) => {
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
    value =
      value.substring(0, 3) +
      " " +
      value.substring(3, 6) +
      " " +
      value.substring(6);
  } else if (value.length >= 3) {
    value = value.substring(0, 3) + " " + value.substring(3);
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

// Validar coincidencia de contraseñas
function validatePasswordMatch() {
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  if (!newPasswordInput || !confirmPasswordInput) return;

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (confirmPassword && newPassword !== confirmPassword) {
    confirmPasswordInput.setCustomValidity("Las contraseñas no coinciden");
    confirmPasswordInput.classList.add("is-invalid");
  } else {
    confirmPasswordInput.setCustomValidity("");
    confirmPasswordInput.classList.remove("is-invalid");
  }
}

// Validar formulario completo
function validateForm() {
  const requiredFields = [
    "nombreUsuario",
    "apellidoUsuario",
    // "correo", // NO validar correo porque es readonly
    "celular",
    "edad",
    "facultadId", // Mantener el ID del HTML
    "escuelaID",
    "ciclo",
  ];

  for (let fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      const label = field?.previousElementSibling?.textContent || fieldId;
      showMessage(`El campo ${label} es requerido`, "danger");
      if (field) field.focus();
      return false;
    }
  }

  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  if (newPasswordInput && confirmPasswordInput) {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword) {
      if (newPassword.length < 8) {
        showMessage("La contraseña debe tener al menos 8 caracteres", "danger");
        return false;
      }

      if (newPassword !== confirmPassword) {
        showMessage("Las contraseñas no coinciden", "danger");
        return false;
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        showMessage(
          "La contraseña debe contener al menos una mayúscula, una minúscula y un número",
          "danger"
        );
        return false;
      }
    }
  }

  // NO validar email porque es readonly y no se puede cambiar

  // Validar edad (como string pero verificar que sea número válido)
  const edadInput = document.getElementById("edad");
  if (edadInput) {
    const edad = parseInt(edadInput.value);
    if (isNaN(edad) || edad < 16 || edad > 80) {
      showMessage("La edad debe estar entre 16 y 80 años", "danger");
      return false;
    }
  }

  // Validar ciclo (debe ser romano válido)
  const cicloInput = document.getElementById("ciclo");
  if (cicloInput) {
    const ciclosValidos = [
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
    if (!ciclosValidos.includes(cicloInput.value)) {
      showMessage("Debe seleccionar un ciclo académico válido", "danger");
      return false;
    }
  }

  return true;
}

// Guardar perfil
async function saveProfile() {
  if (!validateForm()) return;

  const saveButton = document.querySelector(".btn-primary");
  if (!saveButton) return;

  const originalText = saveButton.innerHTML;

  try {
    // Mostrar estado de carga
    saveButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';
    saveButton.disabled = true;

    // Recopilar datos del formulario - TODOS COMO STRING
    // SOLO campos editables, excluyendo los protegidos
    const profileData = {
      nombreUsuario:
        document.getElementById("nombreUsuario")?.value.trim() || "",
      apellidoUsuario:
        document.getElementById("apellidoUsuario")?.value.trim() || "",
      // correo: NO SE ACTUALIZA - protegido
      celular:
        document.getElementById("celular")?.value.replace(/\s/g, "") || "",
      edad: document.getElementById("edad")?.value || "", // STRING
      facultadID: document.getElementById("facultadId")?.value || "", // HTML usa facultadId, DB usa facultadID
      escuelaID: document.getElementById("escuelaID")?.value || "",
      ciclo: document.getElementById("ciclo")?.value || "", // STRING
      poloTallaID: document.getElementById("poloTallaID")?.value || "",
      banco: document.getElementById("banco")?.value || "",
      cuentaBancaria:
        document.getElementById("cuentaBancaria")?.value.replace(/-/g, "") ||
        "",
      yape: document.getElementById("yape")?.value.replace(/\s/g, "") || "",
      fechaActualizacion: serverTimestamp(),
    };

    // CAMPOS PROTEGIDOS que NO se actualizan:
    // - idUsuario (inmutable)
    // - correo (protegido)
    // - codigoUsuario (inmutable)
    // - idRol (solo admin puede cambiar)
    // - esAdmin (solo admin puede cambiar)
    // - estadoActivo (solo admin puede cambiar)
    // - fechaCreacion (inmutable)

    // Actualizar en Firestore
    await updateDoc(doc(db, "usuarios", currentUser.uid), profileData);

    // Cambiar contraseña si se proporcionó
    const newPasswordInput = document.getElementById("newPassword");
    if (newPasswordInput && newPasswordInput.value) {
      const currentPasswordInput = document.getElementById("currentPassword");
      if (!currentPasswordInput || !currentPasswordInput.value) {
        showMessage(
          "Debes ingresar tu contraseña actual para cambiarla",
          "danger"
        );
        return;
      }

      await changePassword(currentPasswordInput.value, newPasswordInput.value);
    }

    // Actualizar perfil local
    userProfile = { ...userProfile, ...profileData };

    showMessage("Perfil actualizado correctamente", "success");

    // Limpiar campos de contraseña
    const currentPasswordInput = document.getElementById("currentPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    if (currentPasswordInput) currentPasswordInput.value = "";
    if (newPasswordInput) newPasswordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error("Error al guardar perfil:", error);
    showMessage("Error al guardar el perfil: " + error.message, "danger");
  } finally {
    // Restaurar botón
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}

// Cambiar contraseña
async function changePassword(currentPassword, newPassword) {
  try {
    // Reautenticar usuario
    await signInWithEmailAndPassword(auth, currentUser.email, currentPassword);

    // Actualizar contraseña
    await updateProfile(currentUser, { password: newPassword });

    console.log("Contraseña actualizada");
  } catch (error) {
    if (error.code === "auth/wrong-password") {
      throw new Error("La contraseña actual es incorrecta");
    }
    throw error;
  }
}

// Cancelar cambios
function cancelChanges() {
  if (
    confirm(
      "¿Estás seguro de que deseas cancelar los cambios? Se perderán todos los datos no guardados."
    )
  ) {
    populateFormFields();

    // Limpiar campos de contraseña
    const currentPasswordInput = document.getElementById("currentPassword");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    if (currentPasswordInput) currentPasswordInput.value = "";
    if (newPasswordInput) newPasswordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";

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
    if (alert) {
      alert.remove();
    }
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

// Funciones globales (para mantener compatibilidad)
window.saveProfile = saveProfile;
window.cancelChanges = cancelChanges;
window.toggleSidebar = toggleSidebar;
