// admin-register.js - REGISTRO DE ADMINISTRADORES
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
// CONFIGURACIÓN ESPECÍFICA PARA ADMINS
// =============================================
const ADMIN_VALIDATION_CONFIG = {
  ALLOW_ALL_EMAILS: true,
  MIN_NAME_LENGTH: 2,
  MIN_PASSWORD_LENGTH: 8,
  MIN_AGE: 18,
  MAX_AGE: 80,
  PHONE_LENGTH: 9,
  PASSWORD_SUFFIX: "ADMIN*",
};

// =============================================
// FUNCIONES DE INTERFAZ DE USUARIO
// =============================================

/**
 * Muestra notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación (success, error, warning)
 */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white bg-${
    type === "success" ? "success" : type === "error" ? "danger" : "warning"
  } border-0`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="fas ${
          type === "success"
            ? "fa-check-circle"
            : type === "error"
            ? "fa-exclamation-circle"
            : "fa-exclamation-triangle"
        } me-2"></i>
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container position-fixed top-0 end-0 p-3";
    toastContainer.style.zIndex = "9999";
    document.body.appendChild(toastContainer);
  }

  toastContainer.appendChild(toast);

  const bsToast = new bootstrap.Toast(toast, {
    autohide: true,
    delay: 5000,
  });
  bsToast.show();

  toast.addEventListener("hidden.bs.toast", () => {
    toast.remove();
  });
}

/**
 * Controla el estado de loading del botón de agregar admin
 * @param {boolean} isLoading - Estado de loading
 */
function setAddAdminLoading(isLoading) {
  const submitBtn = document.querySelector("#addUserModal .btn-primary");
  const cancelBtn = document.querySelector("#addUserModal .btn-secondary");

  if (submitBtn && cancelBtn) {
    if (isLoading) {
      submitBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span>Registrando...';
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
    } else {
      submitBtn.innerHTML =
        '<i class="fas fa-user-plus me-2"></i>Agregar Administrador';
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }
}

/**
 * Genera contraseña automática para admin
 * @param {string} nombreUsuario - Nombre del usuario
 * @returns {string} Contraseña generada
 */
function generateAdminPassword(nombreUsuario) {
  const cleanName = nombreUsuario.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
  return cleanName + ADMIN_VALIDATION_CONFIG.PASSWORD_SUFFIX;
}

/**
 * Actualiza el campo de contraseña cuando cambia el nombre
 */
function updatePasswordField() {
  const nombreInput = document.getElementById("userName");
  const passwordInput = document.getElementById("userPassword");
  const passwordDisplay = document.getElementById("passwordDisplay");
  const passwordContainer = document.getElementById("passwordDisplayContainer");

  if (nombreInput && passwordInput) {
    const nombre = nombreInput.value.trim();
    if (nombre) {
      const generatedPassword = generateAdminPassword(nombre);
      passwordInput.value = generatedPassword;

      if (passwordDisplay) {
        passwordDisplay.textContent = generatedPassword;
        passwordContainer.style.display = "block";
      }
    } else {
      passwordInput.value = "";
      passwordContainer.style.display = "none";
    }
  }
}

/**
 * Toggle para mostrar/ocultar contraseña
 */
function togglePasswordVisibility() {
  const passwordInput = document.getElementById("userPassword");
  const toggleIcon = document.getElementById("passwordToggleIcon");

  if (passwordInput && toggleIcon) {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleIcon.className = "fas fa-eye-slash";
    } else {
      passwordInput.type = "password";
      toggleIcon.className = "fas fa-eye";
    }
  }
}

// =============================================
// FUNCIONES DE VALIDACIÓN
// =============================================

/**
 * Valida el formato del correo electrónico (genérico)
 * @param {string} email - Correo a validar
 * @returns {boolean} True si es válido, false si no
 */
function validateEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calcula la edad desde una fecha de nacimiento
 * @param {string} birthDate - Fecha de nacimiento en formato YYYY-MM-DD
 * @returns {number} Edad calculada
 */
function calculateAge(birthDate) {
  if (!birthDate) return null;

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
 * Valida todos los campos del formulario de admin
 * @param {Object} formData - Datos del formulario
 * @returns {Object} Resultado de validación con isValid y message
 */
function validateAdminFormData(formData) {
  const {
    nombreUsuario,
    apellidoUsuario,
    correo,
    password,
    fechaNacimiento,
    telefono,
    escuelaID,
    facultadID,
  } = formData;

  if (
    !nombreUsuario ||
    nombreUsuario.length < ADMIN_VALIDATION_CONFIG.MIN_NAME_LENGTH
  ) {
    return {
      isValid: false,
      message: "El nombre debe tener al menos 2 caracteres",
    };
  }

  if (
    !apellidoUsuario ||
    apellidoUsuario.length < ADMIN_VALIDATION_CONFIG.MIN_NAME_LENGTH
  ) {
    return {
      isValid: false,
      message: "El apellido debe tener al menos 2 caracteres",
    };
  }

  if (!validateEmailFormat(correo)) {
    return {
      isValid: false,
      message: "Por favor ingresa un correo electrónico válido",
    };
  }

  if (
    !password ||
    password.length < ADMIN_VALIDATION_CONFIG.MIN_PASSWORD_LENGTH
  ) {
    return {
      isValid: false,
      message: "La contraseña debe tener al menos 8 caracteres",
    };
  }

  if (!escuelaID) {
    return {
      isValid: false,
      message: "Debes seleccionar una escuela",
    };
  }

  if (!facultadID) {
    return {
      isValid: false,
      message: "Debes seleccionar una facultad",
    };
  }

  if (fechaNacimiento) {
    const edad = calculateAge(fechaNacimiento);
    if (
      edad < ADMIN_VALIDATION_CONFIG.MIN_AGE ||
      edad > ADMIN_VALIDATION_CONFIG.MAX_AGE
    ) {
      return {
        isValid: false,
        message: "La edad debe estar entre 18 y 80 años",
      };
    }
  }

  if (telefono && !/^[0-9]{9}$/.test(telefono)) {
    return {
      isValid: false,
      message: "El número de teléfono debe tener 9 dígitos",
    };
  }

  return { isValid: true };
}

// =============================================
// FUNCIONES DE FIRESTORE DATABASE
// =============================================

/**
 * Verifica si un email ya existe en la base de datos
 * @param {string} email - Email a verificar
 * @returns {Promise<boolean>} True si existe, false si no
 */
async function checkEmailExists(email) {
  try {
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("correo", "==", email));
    const querySnapshot = await getDocs(q);

    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error al verificar email:", error);
    return false;
  }
}

/**
 * Crea el perfil del administrador en Firestore
 * @param {string} uid - UID del usuario
 * @param {Object} userData - Datos del usuario
 * @returns {Promise<boolean>} True si se creó exitosamente
 */
async function createAdminProfile(uid, userData) {
  try {
    if (!uid || !db) {
      return false;
    }

    const userDocRef = doc(db, "usuarios", uid);
    const currentTimestamp = new Date().toISOString();

    const edad = userData.fechaNacimiento
      ? calculateAge(userData.fechaNacimiento)
      : null;

    const adminProfile = {
      idUsuario: uid,
      nombreUsuario: userData.nombreUsuario || "",
      apellidoUsuario: userData.apellidoUsuario || "",
      correo: userData.correo || "",
      fechaNacimiento: userData.fechaNacimiento || "",
      edad: edad,
      celular: userData.telefono || "",
      codigoUsuario: "",
      facultadID: userData.facultadID || "",
      escuelaID: userData.escuelaID || "",
      ciclo: "",
      poloTallaID: "",
      esAdmin: true,
      estadoActivo: true,
      medallasID: "",
      fotoPerfil: "",
      fechaRegistro: currentTimestamp,
      fechaModificacion: currentTimestamp,
      ultimoAcceso: currentTimestamp,
      tipoUsuario: "administrador",
      creadoPor: auth.currentUser?.uid || "sistema",
      fechaCreacionAdmin: currentTimestamp,
    };

    await setDoc(userDocRef, adminProfile, { merge: false });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const docSnap = await getDoc(userDocRef);

    return docSnap.exists();
  } catch (error) {
    console.error("Error crítico al crear perfil de admin:", error);
    return false;
  }
}

// =============================================
// FUNCIONES DE VERIFICACIÓN DE EMAIL
// =============================================

/**
 * Envía email de verificación al administrador
 * @param {Object} user - Usuario de Firebase Auth
 * @returns {Promise<boolean>} True si se envió exitosamente
 */
async function sendAdminVerificationEmail(user) {
  try {
    await sendEmailVerification(user, {
      url: window.location.origin + "/admin/login.html",
      handleCodeInApp: false,
    });

    return true;
  } catch (error) {
    throw error;
  }
}

// =============================================
// FUNCIÓN PRINCIPAL DE REGISTRO DE ADMIN
// =============================================

/**
 * Maneja el proceso completo de registro de administrador
 * @param {Event} event - Evento del formulario
 */
async function handleAdminRegister(event) {
  event.preventDefault();

  const formData = {
    nombreUsuario: document.getElementById("userName")?.value.trim() || "",
    apellidoUsuario:
      document.getElementById("userLastName")?.value.trim() || "",
    correo:
      document.getElementById("userEmail")?.value.trim().toLowerCase() || "",
    password: document.getElementById("userPassword")?.value || "",
    fechaNacimiento: document.getElementById("userBirthDate")?.value || "",
    telefono: document.getElementById("userPhone")?.value.trim() || "",
    escuelaID: document.getElementById("userSchool")?.value || "",
    facultadID: document.getElementById("userFaculty")?.value || "",
    esAdmin: document.getElementById("isAdmin")?.checked || false,
  };

  const validation = validateAdminFormData(formData);
  if (!validation.isValid) {
    showToast(validation.message, "error");
    return;
  }

  setAddAdminLoading(true);

  try {
    const emailExists = await checkEmailExists(formData.correo);
    if (emailExists) {
      setAddAdminLoading(false);
      showToast("Ya existe un usuario con este correo electrónico.", "error");
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.correo,
      formData.password
    );
    const user = userCredential.user;

    await updateProfile(user, {
      displayName: `${formData.nombreUsuario} ${formData.apellidoUsuario}`,
    });

    const profileCreated = await createAdminProfile(user.uid, formData);

    if (!profileCreated) {
      try {
        await user.delete();
      } catch (deleteError) {
        // Error silencioso en producción
      }
      throw new Error(
        "Error al crear el perfil del administrador en Firestore"
      );
    }

    try {
      await sendAdminVerificationEmail(user);
    } catch (emailError) {
      // Email error no es crítico, continúa el proceso
    }

    setAddAdminLoading(false);

    showToast(
      `Administrador ${formData.nombreUsuario} ${formData.apellidoUsuario} creado exitosamente. Se ha enviado un email de verificación a ${formData.correo}.`,
      "success"
    );

    const adminRegisteredEvent = new CustomEvent("adminRegistered", {
      detail: {
        adminData: formData,
        uid: user.uid,
      },
    });
    document.dispatchEvent(adminRegisteredEvent);

    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addUserModal")
    );
    if (modal) {
      modal.hide();
    }
    clearAdminForm();

    if (typeof window.loadUsersTable === "function") {
      window.loadUsersTable();
    }
  } catch (error) {
    setAddAdminLoading(false);

    let errorMessage =
      "Hubo un problema al registrar el administrador. Intenta nuevamente.";

    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "Ya existe una cuenta con este correo electrónico.";
        break;
      case "auth/weak-password":
        errorMessage =
          "La contraseña es muy débil. Debe tener al menos 8 caracteres.";
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

    showToast(errorMessage, "error");
  }
}

/**
 * Limpia los campos del formulario de admin
 */
function clearAdminForm() {
  const formFields = [
    "userName",
    "userLastName",
    "userEmail",
    "userPassword",
    "userBirthDate",
    "userPhone",
    "userSchool",
    "userFaculty",
    "isAdmin",
  ];

  formFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      if (field.type === "checkbox") {
        field.checked = false;
      } else {
        field.value = "";
      }
    }
  });

  const passwordContainer = document.getElementById("passwordDisplayContainer");
  if (passwordContainer) {
    passwordContainer.style.display = "none";
  }
}

// =============================================
// CARGA DE DATOS DINÁMICOS
// =============================================

/**
 * Carga las escuelas en el select
 */
async function loadSchools() {
  try {
    const escuelasRef = collection(db, "escuela");
    const snapshot = await getDocs(escuelasRef);

    const schoolSelect = document.getElementById("userSchool");
    if (schoolSelect) {
      schoolSelect.innerHTML = '<option value="">Seleccionar Escuela</option>';

      snapshot.forEach((doc) => {
        const escuela = doc.data();
        const option = document.createElement("option");
        option.value = escuela.idEscuela || doc.id;
        option.textContent = escuela.nombreEscuela || "Sin nombre";
        schoolSelect.appendChild(option);
      });
    }
  } catch (error) {
    // Error silencioso en producción
  }
}

/**
 * Carga las facultades en el select
 */
async function loadFaculties() {
  try {
    const facultadesRef = collection(db, "facultad");
    const snapshot = await getDocs(facultadesRef);

    const facultySelect = document.getElementById("userFaculty");
    if (facultySelect) {
      facultySelect.innerHTML =
        '<option value="">Seleccionar Facultad</option>';

      snapshot.forEach((doc) => {
        const facultad = doc.data();
        const option = document.createElement("option");
        option.value = facultad.idFacultad || doc.id;
        option.textContent = facultad.nombreFacultad || "Sin nombre";
        facultySelect.appendChild(option);
      });
    }
  } catch (error) {
    // Error silencioso en producción
  }
}

// =============================================
// INICIALIZACIÓN Y EVENT LISTENERS
// =============================================

document.addEventListener("DOMContentLoaded", function () {
  const addUserModal = document.getElementById("addUserModal");
  if (addUserModal) {
    loadSchools();
    loadFaculties();

    const userName = document.getElementById("userName");
    const addUserForm = document.getElementById("addUserForm");
    const togglePasswordBtn = document.getElementById("togglePasswordBtn");

    if (userName) {
      userName.addEventListener("input", updatePasswordField);
    }

    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener("click", togglePasswordVisibility);
    }

    if (addUserForm) {
      addUserForm.addEventListener("submit", handleAdminRegister);
    }

    addUserModal.addEventListener("show.bs.modal", function () {
      clearAdminForm();
      loadSchools();
      loadFaculties();
    });
  }
});

// Exportar funciones para uso global
window.handleAdminRegister = handleAdminRegister;
window.clearAdminForm = clearAdminForm;
window.loadSchools = loadSchools;
window.loadFaculties = loadFaculties;
