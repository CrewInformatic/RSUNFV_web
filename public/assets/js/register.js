// register.js
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  updateProfile,
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
} from "./firebase_config.js";

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

// =============================================
// FUNCIONES DE FIRESTORE DATABASE
// =============================================

// FUNCIÓN CORREGIDA: Crear perfil del usuario en Firestore
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

    // CREAR REFERENCIA AL DOCUMENTO con el UID
    const userDocRef = doc(db, "usuarios", uid);
    console.log("📄 Referencia al documento creada:", userDocRef.path);

    // ESTRUCTURA SIMPLIFICADA Y CORREGIDA DEL DOCUMENTO
    const userProfile = {
      // Información personal básica
      nombre: userData.nombre || "",
      apellido: userData.apellido || "",
      edad: Number(userData.edad) || 0,
      fechaNacimientoID: userData.fechaNacimiento || "",

      // Información académica
      codigoUsuario: userData.codigo_estudiante || "",
      facultad: userData.facultad || "",
      ciclo: userData.ciclo || "",
      escuela: userData.escuela || "",

      // Configuración de la cuenta
      esAdmin: false,
      estadoActivo: true,

      // Elementos adicionales (arrays vacíos iniciales)
      medallasID: [],
      fotoPerfil: "",
      fotoPerfilHash: "",

      // Timestamps con formato ISO
      fechaRegistro: new Date().toISOString(),
      ultimoAcceso: new Date().toISOString(),
    };

    console.log("📋 DOCUMENTO A GUARDAR:", userProfile);

    // GUARDAR EL DOCUMENTO EN FIRESTORE
    console.log("💾 Guardando documento en Firestore...");

    await setDoc(userDocRef, userProfile, { merge: false });

    console.log("✅ ¡DOCUMENTO GUARDADO EXITOSAMENTE!");

    // VERIFICACIÓN INMEDIATA
    console.log("🔍 Verificando que el documento se guardó correctamente...");

    // Esperar un momento antes de verificar
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
          console.error(
            "💡 Sugerencia: Las reglas deben permitir escritura para usuarios autenticados"
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
// FUNCIÓN PRINCIPAL DE REGISTRO
// =============================================

// FUNCIÓN MEJORADA: Manejar el REGISTRO COMPLETO
window.handleRegister = async function (event) {
  event.preventDefault();
  console.log("📝 Iniciando proceso de registro...");

  // Obtener todos los datos del formulario
  const nombre = document.getElementById("name")?.value.trim() || "";
  const apellido = document.getElementById("apellido")?.value.trim() || "";
  const correo =
    document.getElementById("email")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("password")?.value || "";
  const edad = parseInt(document.getElementById("edad")?.value) || 0;
  const codigo_estudiante =
    document.getElementById("codigo_estudiante")?.value.trim() || "";
  const facultad = document.getElementById("facultad")?.value || "";
  const ciclo = document.getElementById("ciclo")?.value || "";
  const escuela = document.getElementById("escuela")?.value || "";
  const fechaNacimiento =
    document.getElementById("fechaNacimiento")?.value || "";

  console.log("📋 Datos del formulario recibidos:", {
    nombre,
    apellido,
    correo,
    edad,
    codigo_estudiante,
    facultad,
    ciclo,
    escuela,
  });

  // Validaciones completas
  if (nombre.length < 2) {
    showModal(
      "Error de validación",
      "El nombre debe tener al menos 2 caracteres",
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

  if (!edad || edad < 16 || edad > 80) {
    showModal(
      "Error de validación",
      "La edad debe estar entre 16 y 80 años",
      "🎂",
      "error"
    );
    return;
  }

  if (!codigo_estudiante || codigo_estudiante.length < 8) {
    showModal(
      "Error de validación",
      "El código de estudiante debe tener al menos 8 dígitos",
      "🎓",
      "error"
    );
    return;
  }

  if (!facultad) {
    showModal(
      "Error de validación",
      "Debes seleccionar una facultad",
      "🏫",
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
    const codeExists = await checkStudentCodeExists(codigo_estudiante);
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

    console.log("🔐 Creando usuario en Firebase Authentication...");

    // PASO 2: Crear usuario en Firebase Authentication
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

    // PASO 3: Actualizar el displayName
    await updateProfile(user, {
      displayName: `${nombre} ${apellido}`,
    });

    console.log("📝 Preparando datos para Firestore...");

    // PASO 4: Preparar datos limpios para Firestore
    const userData = {
      nombre: nombre,
      apellido: apellido,
      edad: edad,
      codigo_estudiante: codigo_estudiante,
      facultad: facultad,
      ciclo: ciclo,
      escuela: escuela,
      fechaNacimiento: fechaNacimiento,
    };

    console.log("🚀 Creando perfil en Firestore con UID:", user.uid);

    // PASO 5: Crear documento en Firestore
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

    console.log("🎉 ¡REGISTRO COMPLETADO EXITOSAMENTE!");
    setRegisterLoading(false);

    // PASO 6: Mostrar mensaje de éxito
    showModal(
      "¡Registro exitoso!",
      `¡Bienvenido ${nombre}! Tu cuenta ha sido creada exitosamente.`,
      "✅",
      "success"
    );

    // PASO 7: Limpiar formulario
    const formFields = [
      "name",
      "apellido",
      "email",
      "password",
      "edad",
      "codigo_estudiante",
      "facultad",
      "ciclo",
      "escuela",
      "fechaNacimiento",
    ];
    formFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) field.value = "";
    });

    // PASO 8: Cambiar a pestaña de login
    setTimeout(() => {
      closeModal();
      if (typeof switchTab === "function") {
        switchTab("login");
      }
      const emailLogin = document.getElementById("email_login");
      if (emailLogin) emailLogin.value = correo;
    }, 3000);
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
  console.log("🚀 Sistema de registro Firebase inicializado");

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

console.log("📝 Sistema de registro cargado exitosamente");
