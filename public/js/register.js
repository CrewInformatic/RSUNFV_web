// register.js - VERSIÓN OPTIMIZADA CON VALIDACIÓN UNFV
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  updateProfile,
  collection,
  sendEmailVerification,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
} from "./firebase_config.js";

// =============================================
// CONFIGURACIÓN
// =============================================
const CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

// Configuración de validación
const VALIDATION_CONFIG = {
  EMAIL_DOMAIN: "@unfv.edu.pe",
  MIN_NAME_LENGTH: 2,
  MIN_PASSWORD_LENGTH: 6,
  MIN_STUDENT_CODE_LENGTH: 8,
  MIN_AGE: 16,
  MAX_AGE: 80,
  PHONE_LENGTH: 9,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
};

// Referencias DOM
const modal = document.getElementById("messageModal");
const modalIcon = document.getElementById("modalIcon");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalBtn = document.getElementById("modalBtn");

// =============================================
// FUNCIONES DE INTERFAZ DE USUARIO
// =============================================

/**
 * Muestra un modal con mensaje personalizado
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje a mostrar
 * @param {string} icon - Icono a mostrar
 * @param {string} type - Tipo de modal (error, success, warning)
 */
function showModal(title, message, icon, type = "error") {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalIcon.textContent = icon;
  modalBtn.className = `modal-btn ${type}`;
  modal.classList.add("show");
}

/**
 * Cierra el modal
 */
window.closeModal = function () {
  modal.classList.remove("show");
};

/**
 * Controla el estado de loading del botón de registro
 * @param {boolean} isLoading - Estado de loading
 */
function setRegisterLoading(isLoading) {
  const registerBtn = document.getElementById("submit");
  if (registerBtn) {
    if (isLoading) {
      registerBtn.innerHTML = '<span class="loading"></span>Registrando...';
      registerBtn.disabled = true;
    } else {
      registerBtn.innerHTML = "Crear Cuenta";
      registerBtn.disabled = false;
    }
  }
}

/**
 * Cambia entre pestañas del formulario
 * @param {string} tabName - Nombre de la pestaña
 */
window.switchTab = function (tabName) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".form-container")
    .forEach((form) => form.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(tabName + "-form").classList.add("active");
  closeModal();
};

/**
 * Maneja la selección de archivo y vista previa
 * @param {HTMLInputElement} input - Input de archivo
 */
window.handleFileSelect = function (input) {
  const file = input.files[0];
  const preview = document.getElementById("imagePreview");
  const previewImg = document.getElementById("previewImg");
  const previewName = document.getElementById("previewName");

  if (file) {
    // Validar tamaño
    if (file.size > VALIDATION_CONFIG.MAX_FILE_SIZE) {
      showModal(
        "Archivo muy grande",
        "La imagen no puede superar los 5MB",
        "📁",
        "error"
      );
      input.value = "";
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      showModal(
        "Formato inválido",
        "Solo se permiten archivos de imagen (JPG, PNG, etc.)",
        "🖼️",
        "error"
      );
      input.value = "";
      return;
    }

    // Mostrar vista previa
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      previewName.textContent = file.name;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = "none";
  }
};

// Funciones de actualización de displays
window.updatePoloTallaDisplay = function () {
  // Función mantenida por compatibilidad
};

window.updateFacultadDisplay = function () {
  // Función mantenida por compatibilidad
};

window.updateEscuelaDisplay = function () {
  // Función mantenida por compatibilidad
};

// =============================================
// FUNCIONES DE CLOUDINARY
// =============================================

/**
 * Sube una imagen a Cloudinary
 * @param {File} file - Archivo de imagen
 * @returns {Promise<string>} URL de la imagen subida
 */
async function uploadImageToCloudinary(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
    formData.append("cloud_name", CLOUDINARY_CONFIG.cloudName);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error("No se recibió URL de la imagen");
    }
  } catch (error) {
    throw error;
  }
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================

/**
 * Calcula la edad desde una fecha de nacimiento
 * @param {string} birthDate - Fecha de nacimiento en formato YYYY-MM-DD
 * @returns {number} Edad calculada
 */
function calculateAge(birthDate) {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Obtiene timestamp actual en formato ISO string
 * @returns {string} Timestamp actual
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Valida que el correo tenga el dominio UNFV
 * @param {string} email - Correo a validar
 * @returns {boolean} True si es válido, false si no
 */
function validateUnfvEmail(email) {
  const emailRegex = /^[^\s@]+@unfv\.edu\.pe$/;
  return emailRegex.test(email);
}

/**
 * Valida todos los campos del formulario
 * @param {Object} formData - Datos del formulario
 * @returns {Object} Resultado de validación con isValid y message
 */
function validateFormData(formData) {
  const {
    nombreUsuario,
    apellidoUsuario,
    correo,
    password,
    codigoUsuario,
    fechaNacimiento,
    celular,
    poloTallaID,
    facultadID,
    escuelaID,
    ciclo,
  } = formData;

  if (nombreUsuario.length < VALIDATION_CONFIG.MIN_NAME_LENGTH) {
    return {
      isValid: false,
      message: "El nombre debe tener al menos 2 caracteres",
      icon: "📝",
    };
  }

  if (apellidoUsuario.length < VALIDATION_CONFIG.MIN_NAME_LENGTH) {
    return {
      isValid: false,
      message: "El apellido debe tener al menos 2 caracteres",
      icon: "📝",
    };
  }

  if (!validateUnfvEmail(correo)) {
    return {
      isValid: false,
      message: "Solo se permiten correos institucionales @unfv.edu.pe",
      icon: "📧",
    };
  }

  if (password.length < VALIDATION_CONFIG.MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: "La contraseña debe tener al menos 6 caracteres",
      icon: "🔒",
    };
  }

  if (
    !codigoUsuario ||
    codigoUsuario.length < VALIDATION_CONFIG.MIN_STUDENT_CODE_LENGTH
  ) {
    return {
      isValid: false,
      message: "El código de estudiante debe tener al menos 8 dígitos",
      icon: "🎓",
    };
  }

  if (!fechaNacimiento) {
    return {
      isValid: false,
      message: "Debes seleccionar tu fecha de nacimiento",
      icon: "📅",
    };
  }

  const edad = calculateAge(fechaNacimiento);
  if (edad < VALIDATION_CONFIG.MIN_AGE || edad > VALIDATION_CONFIG.MAX_AGE) {
    return {
      isValid: false,
      message: "La edad debe estar entre 16 y 80 años",
      icon: "🎂",
    };
  }

  if (!celular || !/^[0-9]{9}$/.test(celular)) {
    return {
      isValid: false,
      message: "El número de celular debe tener 9 dígitos",
      icon: "📱",
    };
  }

  if (!poloTallaID) {
    return {
      isValid: false,
      message: "Debes seleccionar la talla del polo",
      icon: "👕",
    };
  }

  if (!facultadID) {
    return {
      isValid: false,
      message: "Debes seleccionar una facultad",
      icon: "🏫",
    };
  }

  if (!escuelaID) {
    return {
      isValid: false,
      message: "Debes seleccionar una escuela",
      icon: "🎓",
    };
  }

  if (!ciclo) {
    return {
      isValid: false,
      message: "Debes seleccionar tu ciclo académico",
      icon: "📚",
    };
  }

  return { isValid: true };
}

// =============================================
// FUNCIONES DE FIRESTORE DATABASE
// =============================================

/**
 * Crea el perfil del usuario en Firestore
 * @param {string} uid - UID del usuario
 * @param {Object} userData - Datos del usuario
 * @returns {Promise<boolean>} True si se creó exitosamente
 */
async function createUserProfile(uid, userData) {
  try {
    // Validación básica del UID
    if (!uid || typeof uid !== "string" || uid.trim().length === 0) {
      return false;
    }

    // Validación de la conexión a Firestore
    if (!db) {
      return false;
    }

    // Crear referencia al documento
    const userDocRef = doc(db, "usuarios", uid);

    // Calcular edad y timestamp
    const edad = calculateAge(userData.fechaNacimiento);
    const currentTimestamp = getCurrentTimestamp();

    // Estructura del documento
    const userProfile = {
      // ID del usuario
      idUsuario: uid,

      // Información personal básica
      nombreUsuario: userData.nombreUsuario || "",
      apellidoUsuario: userData.apellidoUsuario || "",
      correo: userData.correo || "",
      fechaNacimiento: userData.fechaNacimiento || "",
      edad: edad,
      celular: userData.celular || "", // ← AGREGAR ESTA LÍNEA

      // Información académica
      codigoUsuario: userData.codigoUsuario || "",
      facultadID: userData.facultadID || "",
      escuelaID: userData.escuelaID || "",
      ciclo: userData.ciclo || "",
      poloTallaID: userData.poloTallaID || "",

      // Configuración de la cuenta
      esAdmin: false,
      estadoActivo: true,

      // Elementos adicionales
      medallasID: "",
      fotoPerfil: userData.fotoPerfil || "",

      // Timestamps
      fechaRegistro: currentTimestamp,
      fechaModificacion: currentTimestamp,
      ultimoAcceso: currentTimestamp,
    };

    // Guardar el documento
    await setDoc(userDocRef, userProfile, { merge: false });

    // Verificación
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const docSnap = await getDoc(userDocRef);

    return docSnap.exists();
  } catch (error) {
    // Manejo específico de errores de Firestore
    if (error.code) {
      switch (error.code) {
        case "permission-denied":
          console.error(
            "Error de permisos: Verifica las reglas de seguridad de Firestore"
          );
          break;
        case "unavailable":
          console.error(
            "Firestore no disponible: Problema de conexión a la red"
          );
          break;
        case "invalid-argument":
          console.error("Argumentos inválidos:", userData);
          break;
        case "not-found":
          console.error("Proyecto de Firestore no encontrado");
          break;
        default:
          console.error("Error de Firestore no manejado:", error.code);
      }
    }

    return false;
  }
}

/**
 * Verifica si un código de estudiante ya existe
 * @param {string} codigo - Código a verificar
 * @returns {Promise<boolean>} True si existe, false si no
 */
async function checkStudentCodeExists(codigo) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("codigoUsuario", "==", codigo));
    const querySnapshot = await getDocs(q);

    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error al verificar código de estudiante:", error);
    return false;
  }
}

// =============================================
// FUNCIONES DE VERIFICACIÓN DE EMAIL
// =============================================

/**
 * Envía email de verificación al usuario
 * @param {Object} user - Usuario de Firebase Auth
 * @returns {Promise<boolean>} True si se envió exitosamente
 */
async function sendVerificationEmail(user) {
  try {
    await sendEmailVerification(user, {
      url: window.location.origin + "/login.html",
      handleCodeInApp: false,
    });

    return true;
  } catch (error) {
    switch (error.code) {
      case "auth/too-many-requests":
        throw new Error(
          "Demasiados intentos. Espera un momento antes de intentar nuevamente."
        );
      case "auth/network-request-failed":
        throw new Error("Error de conexión. Verifica tu conexión a internet.");
      default:
        throw new Error(
          "Error al enviar email de verificación: " + error.message
        );
    }
  }
}

/**
 * Redirecciona a la página de verificación de email
 * @param {Object} user - Usuario de Firebase Auth
 * @param {string} userName - Nombre del usuario
 */
function redirectToVerificationPage(user, userName) {
  try {
    // Guardar datos para la página de verificación
    localStorage.setItem("verificationEmail", user.email);
    localStorage.setItem("verificationUserName", userName);
    localStorage.setItem("verificationUID", user.uid);
    localStorage.setItem("registrationCompleted", "true");

    const userData = {
      email: user.email,
      name: userName,
      uid: user.uid,
    };
    sessionStorage.setItem("verificationData", JSON.stringify(userData));

    const verificationUrl = `/emailVerification.html`;

    // Mostrar mensaje de transición
    showModal(
      "Registro exitoso",
      "Tu cuenta ha sido creada. Serás redirigido para verificar tu email.",
      "✅",
      "success"
    );

    // Redireccionar después de 2 segundos
    setTimeout(() => {
      window.location.href = verificationUrl;
    }, 4000);
  } catch (error) {
    console.error("Error en redirección:", error);
    showModal(
      "Error de redirección",
      "Hubo un problema al redireccionar. Por favor, verifica tu email manualmente.",
      "⚠️",
      "error"
    );
  }
}

/**
 * Limpia los campos del formulario
 */
function clearFormFields() {
  const formFields = [
    "nombreUsuario",
    "apellidoUsuario",
    "correo",
    "password",
    "codigoUsuario",
    "fechaNacimiento",
    "celular",
    "poloTallaID",
    "facultadID",
    "escuelaID",
    "ciclo",
    "fotoPerfil",
  ];

  formFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      if (field.type === "file") {
        field.value = "";
        const preview = document.getElementById("imagePreview");
        if (preview) preview.style.display = "none";
      } else {
        field.value = "";
      }
    }
  });
}

// =============================================
// FUNCIÓN PRINCIPAL DE REGISTRO
// =============================================

/**
 * Maneja el proceso completo de registro
 * @param {Event} event - Evento del formulario
 */
window.handleRegister = async function (event) {
  event.preventDefault();

  // Obtener datos del formulario
  const formData = {
    nombreUsuario: document.getElementById("nombreUsuario")?.value.trim() || "",
    apellidoUsuario:
      document.getElementById("apellidoUsuario")?.value.trim() || "",
    correo: document.getElementById("correo")?.value.trim().toLowerCase() || "",
    password: document.getElementById("password")?.value || "",
    codigoUsuario: document.getElementById("codigoUsuario")?.value.trim() || "",
    fechaNacimiento: document.getElementById("fechaNacimiento")?.value || "",
    celular: document.getElementById("celular")?.value.trim() || "", // ← YA ESTÁ AQUÍ
    poloTallaID: document.getElementById("poloTallaID")?.value || "",
    facultadID: document.getElementById("facultadID")?.value || "",
    escuelaID: document.getElementById("escuelaID")?.value || "",
    ciclo: document.getElementById("ciclo")?.value || "",
  };

  const fotoPerfilFile = document.getElementById("fotoPerfil")?.files[0];

  // Validar datos del formulario
  const validation = validateFormData(formData);
  if (!validation.isValid) {
    showModal(
      "Error de validación",
      validation.message,
      validation.icon,
      "error"
    );
    return;
  }

  setRegisterLoading(true);

  try {
    // PASO 1: Verificar código de estudiante único
    const codeExists = await checkStudentCodeExists(formData.codigoUsuario);
    if (codeExists) {
      setRegisterLoading(false);
      showModal(
        "Código duplicado",
        "Ya existe un usuario con este código de estudiante.",
        "⚠️",
        "error"
      );
      return;
    }

    // PASO 2: Subir imagen a Cloudinary si existe
    let fotoPerfil = "";
    if (fotoPerfilFile) {
      try {
        fotoPerfil = await uploadImageToCloudinary(fotoPerfilFile);
      } catch (uploadError) {
        showModal(
          "Error de imagen",
          "No se pudo subir la imagen de perfil. El registro continuará sin foto.",
          "📸",
          "warning"
        );
      }
    }

    // PASO 3: Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.correo,
      formData.password
    );
    const user = userCredential.user;

    // PASO 4: Actualizar displayName
    await updateProfile(user, {
      displayName: `${formData.nombreUsuario} ${formData.apellidoUsuario}`,
    });

    // PASO 5: Crear perfil en Firestore
    const userData = { ...formData, fotoPerfil };
    const profileCreated = await createUserProfile(user.uid, userData);

    if (!profileCreated) {
      // Eliminar usuario de Authentication si falla Firestore
      try {
        await user.delete();
      } catch (deleteError) {
        console.error(
          "Error al eliminar usuario de Authentication:",
          deleteError
        );
      }
      throw new Error("Error al crear el perfil del usuario en Firestore");
    }

    // PASO 6: Enviar email de verificación
    try {
      await sendVerificationEmail(user);
    } catch (emailError) {
      // Eliminar usuario si falla el envío de email
      try {
        await user.delete();
      } catch (deleteError) {
        console.error("Error al eliminar usuario:", deleteError);
      }
      throw new Error(
        "No se pudo enviar el email de verificación: " + emailError.message
      );
    }

    setRegisterLoading(false);

    // PASO 7: Limpiar formulario
    clearFormFields();
    closeModal();

    // PASO 8: Redireccionar a verificación
    redirectToVerificationPage(user, formData.nombreUsuario);
  } catch (error) {
    setRegisterLoading(false);

    let errorMessage =
      "Hubo un problema al registrar tu cuenta. Intenta nuevamente.";

    // Manejar errores específicos de Firebase
    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "Ya existe una cuenta con este correo electrónico.";
        break;
      case "auth/weak-password":
        errorMessage =
          "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
        break;
      case "auth/invalid-email":
        errorMessage = "El correo electrónico no es válido.";
        break;
      case "auth/network-request-failed":
        errorMessage = "Error de conexión. Verifica tu conexión a internet.";
        break;
      default:
        errorMessage = error.message || errorMessage;
    }

    showModal("Error de registro", errorMessage, "⚠️", "error");
  }
};

// =============================================
// INICIALIZACIÓN
// =============================================

// Event listener para cerrar modal
if (modal) {
  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });
}

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", function () {
  // Limpiar datos de verificación si el usuario regresó
  const registrationCompleted = localStorage.getItem("registrationCompleted");
  if (registrationCompleted === "true") {
    localStorage.removeItem("registrationCompleted");
    localStorage.removeItem("verificationEmail");
    localStorage.removeItem("verificationUserName");
    localStorage.removeItem("verificationUID");
  }

  // Agregar efectos a los inputs
  document.querySelectorAll(".form-input").forEach((input) => {
    input.addEventListener("focus", function () {
      this.parentNode.style.transform = "scale(1.02)";
      this.parentNode.style.transition = "transform 0.2s ease";
    });

    input.addEventListener("blur", function () {
      this.parentNode.style.transform = "scale(1)";
    });
  });
});
