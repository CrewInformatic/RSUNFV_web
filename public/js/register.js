// register.js - VERSIÓN ACTUALIZADA CON REDIRECCIÓN A VERIFICACIÓN
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
// CONFIGURACIÓN DE CLOUDINARY
// =============================================
const CLOUDINARY_CONFIG = {
  cloudName: "dupkeaqnz",
  uploadPreset: "u5jbjfxu",
  apiKey: "572426943132833",
};

// Referencias a elementos del DOM
const modal = document.getElementById("messageModal");
const modalIcon = document.getElementById("modalIcon");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalBtn = document.getElementById("modalBtn");

// =============================================
// FUNCIONES DE INTERFAZ DE USUARIO
// =============================================

// Función para mostrar modal
function showModal(title, message, icon, type = "error") {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalIcon.textContent = icon;

  modalBtn.className = `modal-btn ${type}`;
  modal.classList.add("show");
}

// Función para cerrar modal
window.closeModal = function () {
  modal.classList.remove("show");
};

// Función de loading para registro
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

// Función para cambiar entre pestañas
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

// Función para manejar selección de archivo y vista previa
window.handleFileSelect = function (input) {
  const file = input.files[0];
  const preview = document.getElementById("imagePreview");
  const previewImg = document.getElementById("previewImg");
  const previewName = document.getElementById("previewName");

  if (file) {
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
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

// Función para actualizar display de talla de polo
window.updatePoloTallaDisplay = function () {
  const select = document.getElementById("poloTallaID");
  console.log("Talla seleccionada:", select.value);
};

// Función para actualizar display de facultad
window.updateFacultadDisplay = function () {
  const select = document.getElementById("facultadID");
  console.log("Facultad seleccionada:", select.value);
};

// Función para actualizar display de escuela
window.updateEscuelaDisplay = function () {
  const select = document.getElementById("escuelaID");
  console.log("Escuela seleccionada:", select.value);
};

// =============================================
// FUNCIONES DE CLOUDINARY
// =============================================

// Función para subir imagen a Cloudinary
async function uploadImageToCloudinary(file) {
  try {
    console.log("📸 Iniciando subida de imagen a Cloudinary...");

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
      console.log(
        "✅ Imagen subida exitosamente a Cloudinary:",
        data.secure_url
      );
      return data.secure_url;
    } else {
      throw new Error("No se recibió URL de la imagen");
    }
  } catch (error) {
    console.error("❌ Error al subir imagen a Cloudinary:", error);
    throw error;
  }
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================

// Función para calcular edad desde fecha de nacimiento
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

// Función para obtener timestamp actual en formato string
function getCurrentTimestamp() {
  return new Date().toISOString();
}

// =============================================
// FUNCIONES DE FIRESTORE DATABASE
// =============================================

// Función para crear perfil del usuario en Firestore
async function createUserProfile(uid, userData) {
  try {
    console.log("🔥 INICIANDO CREACIÓN DE PERFIL EN FIRESTORE");
    console.log("📝 UID recibido:", uid);
    console.log("📝 Datos recibidos:", userData);

    // Validación básica del UID
    if (!uid || typeof uid !== "string" || uid.trim().length === 0) {
      console.error("❌ UID inválido:", uid);
      return false;
    }

    // Validación de la conexión a Firestore
    if (!db) {
      console.error(
        "❌ La referencia a la base de datos (db) no está disponible"
      );
      return false;
    }

    console.log("✅ Validaciones iniciales pasadas");

    // Crear referencia al documento con el UID
    const userDocRef = doc(db, "usuarios", uid);
    console.log("📄 Referencia al documento creada:", userDocRef.path);

    // Calcular edad desde fecha de nacimiento
    const edad = calculateAge(userData.fechaNacimiento);
    const currentTimestamp = getCurrentTimestamp();

    // Estructura del documento según especificaciones
    const userProfile = {
      // ID del usuario (UID de Firebase Auth)
      idUsuario: uid,

      // Información personal básica
      nombreUsuario: userData.nombreUsuario || "",
      apellidoUsuario: userData.apellidoUsuario || "",
      correo: userData.correo || "",
      fechaNacimiento: userData.fechaNacimiento || "",
      edad: edad,

      // Información académica
      codigoUsuario: userData.codigoUsuario || "",
      facultadID: userData.facultadID || "",
      escuelaID: userData.escuelaID || "",
      ciclo: userData.ciclo || "",
      poloTallaID: userData.poloTallaID || "",

      // Configuración de la cuenta
      esAdmin: false, // Boolean por defecto
      estadoActivo: "true", // String por defecto

      // Elementos adicionales
      medallasID: "", // String vacío por defecto
      fotoPerfilHash: userData.fotoPerfilHash || "", // URL de Cloudinary

      // Timestamps en formato string
      fechaRegistro: currentTimestamp,
      fechaModificacion: currentTimestamp,
      ultimoAcceso: currentTimestamp,
    };

    console.log("📋 DOCUMENTO A GUARDAR:", userProfile);

    // Guardar el documento en Firestore
    console.log("💾 Guardando documento en Firestore...");
    await setDoc(userDocRef, userProfile, { merge: false });

    console.log("✅ ¡DOCUMENTO GUARDADO EXITOSAMENTE!");

    // Verificación inmediata
    console.log("🔍 Verificando que el documento se guardó correctamente...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const savedData = docSnap.data();
      console.log("✅ ¡VERIFICACIÓN EXITOSA! Documento existe en Firestore");
      console.log("📋 Datos guardados:", savedData);
      console.log(
        "🎯 Total de campos guardados:",
        Object.keys(savedData).length
      );
      return true;
    } else {
      console.error("❌ ERROR: El documento no se encontró después de crearlo");
      return false;
    }
  } catch (error) {
    console.error("❌ ERROR CRÍTICO al crear perfil en Firestore:");
    console.error("❌ Nombre del error:", error.name);
    console.error("❌ Mensaje:", error.message);
    console.error("❌ Código:", error.code);

    // Manejo específico de errores de Firestore
    if (error.code) {
      switch (error.code) {
        case "permission-denied":
          console.error(
            "❌ Error de permisos: Verifica las reglas de seguridad de Firestore"
          );
          break;
        case "unavailable":
          console.error(
            "❌ Firestore no disponible: Problema de conexión a la red"
          );
          break;
        case "invalid-argument":
          console.error("❌ Argumentos inválidos:", userData);
          break;
        case "not-found":
          console.error("❌ Proyecto de Firestore no encontrado");
          break;
        default:
          console.error("❌ Error de Firestore no manejado:", error.code);
      }
    }

    return false;
  }
}

// Verificar si el código de estudiante ya existe
async function checkStudentCodeExists(codigo) {
  try {
    console.log("🔍 Verificando código de estudiante:", codigo);
    const usuariosRef = collection(db, "usuarios");
    const q = query(usuariosRef, where("codigoUsuario", "==", codigo));
    const querySnapshot = await getDocs(q);

    const exists = !querySnapshot.empty;
    console.log("🔍 ¿Código existe?", exists);

    return exists;
  } catch (error) {
    console.error("❌ Error al verificar código de estudiante:", error);
    return false;
  }
}

// =============================================
// FUNCIONES DE VERIFICACIÓN DE EMAIL
// =============================================

// Función para enviar email de verificación
async function sendVerificationEmail(user) {
  try {
    console.log("📧 Enviando email de verificación...");

    await sendEmailVerification(user, {
      url: window.location.origin + "/login.html", // URL de retorno después de verificar
      handleCodeInApp: false,
    });

    console.log("✅ Email de verificación enviado exitosamente");
    return true;
  } catch (error) {
    console.error("❌ Error al enviar email de verificación:", error);

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

// Función para redireccionar a página de verificación
// Función corregida para redireccionar a página de verificación
function redirectToVerificationPage(user, userName) {
  try {
    console.log("🔄 Preparando redirección a página de verificación...");

    // Guardar datos necesarios en localStorage para la página de verificación
    localStorage.setItem("verificationEmail", user.email);
    localStorage.setItem("verificationUserName", userName);
    localStorage.setItem("verificationUID", user.uid);
    localStorage.setItem("registrationCompleted", "true");

    console.log("💾 Datos guardados en localStorage para verificación");

    // SOLUCIÓN CORRECTA PARA ESTRUCTURA CON CARPETA PUBLIC:
    // En Firebase Hosting, los archivos de la carpeta 'public' se sirven desde la raíz
    // Así que emailVerification.html está directamente en el dominio raíz
    const verificationUrl = `/emailVerification.html?email=${encodeURIComponent(
      user.email
    )}&name=${encodeURIComponent(userName)}&uid=${encodeURIComponent(
      user.uid
    )}`;

    console.log("🔗 URL de verificación:", verificationUrl);
    console.log(
      "🔗 URL completa será:",
      window.location.origin + verificationUrl
    );

    // Mostrar mensaje de transición
    showModal(
      "Registro exitoso",
      "Tu cuenta ha sido creada. Serás redirigido para verificar tu email.",
      "✅",
      "success"
    );

    // Redireccionar después de 2 segundos
    setTimeout(() => {
      console.log("🚀 Redirigiendo a página de verificación...");
      console.log("🚀 URL final:", verificationUrl);

      // Usar ruta absoluta desde la raíz
      window.location.href = verificationUrl;
    }, 2000);
  } catch (error) {
    console.error("❌ Error en redirección:", error);
    showModal(
      "Error de redirección",
      "Hubo un problema al redireccionar. Por favor, verifica tu email manualmente.",
      "⚠️",
      "error"
    );
  }
}

// =============================================
// FUNCIÓN PRINCIPAL DE REGISTRO
// =============================================

// Función para manejar el registro completo
window.handleRegister = async function (event) {
  event.preventDefault();
  console.log("📝 Iniciando proceso de registro...");

  // Obtener todos los datos del formulario usando los IDs correctos del HTML
  const nombreUsuario =
    document.getElementById("nombreUsuario")?.value.trim() || "";
  const apellidoUsuario =
    document.getElementById("apellidoUsuario")?.value.trim() || "";
  const correo =
    document.getElementById("correo")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("password")?.value || "";
  const codigoUsuario =
    document.getElementById("codigoUsuario")?.value.trim() || "";
  const fechaNacimiento =
    document.getElementById("fechaNacimiento")?.value || "";
  const celular = document.getElementById("celular")?.value.trim() || "";
  const poloTallaID = document.getElementById("poloTallaID")?.value || "";
  const facultadID = document.getElementById("facultadID")?.value || "";
  const escuelaID = document.getElementById("escuelaID")?.value || "";
  const ciclo = document.getElementById("ciclo")?.value || "";
  const fotoPerfilFile = document.getElementById("fotoPerfilHash")?.files[0];

  console.log("📋 Datos del formulario recibidos:", {
    nombreUsuario,
    apellidoUsuario,
    correo,
    codigoUsuario,
    fechaNacimiento,
    celular,
    poloTallaID,
    facultadID,
    escuelaID,
    ciclo,
    fotoPerfilFile: fotoPerfilFile ? fotoPerfilFile.name : "No seleccionada",
  });

  // Validaciones completas
  if (nombreUsuario.length < 2) {
    showModal(
      "Error de validación",
      "El nombre debe tener al menos 2 caracteres",
      "📝",
      "error"
    );
    return;
  }

  if (apellidoUsuario.length < 2) {
    showModal(
      "Error de validación",
      "El apellido debe tener al menos 2 caracteres",
      "📝",
      "error"
    );
    return;
  }

  if (password.length < 6) {
    showModal(
      "Error de validación",
      "La contraseña debe tener al menos 6 caracteres",
      "🔒",
      "error"
    );
    return;
  }

  if (!codigoUsuario || codigoUsuario.length < 8) {
    showModal(
      "Error de validación",
      "El código de estudiante debe tener al menos 8 dígitos",
      "🎓",
      "error"
    );
    return;
  }

  if (!fechaNacimiento) {
    showModal(
      "Error de validación",
      "Debes seleccionar tu fecha de nacimiento",
      "📅",
      "error"
    );
    return;
  }

  // Validar edad calculada
  const edad = calculateAge(fechaNacimiento);
  if (edad < 16 || edad > 80) {
    showModal(
      "Error de validación",
      "La edad debe estar entre 16 y 80 años",
      "🎂",
      "error"
    );
    return;
  }

  if (!celular || !/^[0-9]{9}$/.test(celular)) {
    showModal(
      "Error de validación",
      "El número de celular debe tener 9 dígitos",
      "📱",
      "error"
    );
    return;
  }

  if (!poloTallaID) {
    showModal(
      "Error de validación",
      "Debes seleccionar la talla del polo",
      "👕",
      "error"
    );
    return;
  }

  if (!facultadID) {
    showModal(
      "Error de validación",
      "Debes seleccionar una facultad",
      "🏫",
      "error"
    );
    return;
  }

  if (!escuelaID) {
    showModal(
      "Error de validación",
      "Debes seleccionar una escuela",
      "🎓",
      "error"
    );
    return;
  }

  if (!ciclo) {
    showModal(
      "Error de validación",
      "Debes seleccionar tu ciclo académico",
      "📚",
      "error"
    );
    return;
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo)) {
    showModal(
      "Correo inválido",
      "Por favor, ingresa un correo electrónico válido.",
      "📧",
      "error"
    );
    return;
  }

  setRegisterLoading(true);

  try {
    console.log("🔍 Verificando si el código de estudiante ya existe...");

    // PASO 1: Verificar si el código de estudiante ya existe en Firestore
    const codeExists = await checkStudentCodeExists(codigoUsuario);
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
    let fotoPerfilHash = "";
    if (fotoPerfilFile) {
      console.log("📸 Subiendo imagen de perfil a Cloudinary...");
      try {
        fotoPerfilHash = await uploadImageToCloudinary(fotoPerfilFile);
        console.log("✅ Imagen subida exitosamente:", fotoPerfilHash);
      } catch (uploadError) {
        console.error("❌ Error al subir imagen:", uploadError);
        showModal(
          "Error de imagen",
          "No se pudo subir la imagen de perfil. El registro continuará sin foto.",
          "📸",
          "warning"
        );
      }
    }

    console.log("🔐 Creando usuario en Firebase Authentication...");

    // PASO 3: Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      correo,
      password
    );
    const user = userCredential.user;

    console.log(
      "✅ Usuario creado en Firebase Authentication con UID:",
      user.uid
    );

    // PASO 4: Actualizar el displayName
    await updateProfile(user, {
      displayName: `${nombreUsuario} ${apellidoUsuario}`,
    });

    console.log("📝 Preparando datos para Firestore...");

    // PASO 5: Preparar datos limpios para Firestore
    const userData = {
      nombreUsuario: nombreUsuario,
      apellidoUsuario: apellidoUsuario,
      correo: correo,
      codigoUsuario: codigoUsuario,
      fechaNacimiento: fechaNacimiento,
      celular: celular,
      poloTallaID: poloTallaID,
      facultadID: facultadID,
      escuelaID: escuelaID,
      ciclo: ciclo,
      fotoPerfilHash: fotoPerfilHash,
    };

    console.log("🚀 Creando perfil en Firestore con UID:", user.uid);

    // PASO 6: Crear documento en Firestore
    const profileCreated = await createUserProfile(user.uid, userData);

    if (!profileCreated) {
      console.error(
        "❌ FALLO CRÍTICO: No se pudo crear el perfil en Firestore"
      );

      // Eliminar usuario de Authentication para mantener consistencia
      try {
        await user.delete();
        console.log(
          "✅ Usuario eliminado de Authentication por fallo en Firestore"
        );
      } catch (deleteError) {
        console.error(
          "❌ Error al eliminar usuario de Authentication:",
          deleteError
        );
      }

      throw new Error("Error al crear el perfil del usuario en Firestore");
    }

    console.log("📧 Enviando email de verificación...");

    // PASO 7: Enviar email de verificación
    try {
      await sendVerificationEmail(user);
      console.log("✅ Email de verificación enviado exitosamente");
    } catch (emailError) {
      console.error("❌ Error al enviar email de verificación:", emailError);

      // Si falla el envío de email, eliminar usuario para mantener consistencia
      try {
        await user.delete();
        console.log("✅ Usuario eliminado por fallo en envío de email");
      } catch (deleteError) {
        console.error("❌ Error al eliminar usuario:", deleteError);
      }

      throw new Error(
        "No se pudo enviar el email de verificación: " + emailError.message
      );
    }

    console.log("🎉 ¡REGISTRO COMPLETADO EXITOSAMENTE!");
    setRegisterLoading(false);

    // PASO 8: Limpiar formulario
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
      "fotoPerfilHash",
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

    // PASO 9: Cerrar modal de registro si está abierto
    closeModal();

    // PASO 10: Redireccionar a página de verificación
    console.log("🔄 Redirigiendo a página de verificación...");
    redirectToVerificationPage(user, nombreUsuario);
  } catch (error) {
    console.error("❌ Error en registro:", error);
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

// Cerrar modal al hacer clic fuera de él
if (modal) {
  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });
}

// Inicialización cuando se carga la página
document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 Sistema de registro Firebase con Cloudinary inicializado");

  // Verificar si el usuario viene de una redirección de verificación fallida
  const registrationCompleted = localStorage.getItem("registrationCompleted");
  if (registrationCompleted === "true") {
    console.log(
      "🔄 Usuario regresó de verificación, limpiando localStorage..."
    );
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

  console.log("🎯 Inicialización de registro completada");
});

console.log(
  "📝 Sistema de registro con verificación de email cargado exitosamente"
);
