// donation-upload-service.js
// Servicio para subir donaciones a Firebase con Cloudinary - VERSIÓN PRODUCCIÓN

export class DonationUploadService {
  constructor() {
    this.db = null;
    this.initialized = false;

    // Configuración de Cloudinary (misma que en register.js)
    this.CLOUDINARY_CONFIG = {
      cloudName: "dupkeaqnz",
      uploadPreset: "u5jbjfxu",
      apiKey: "572426943132833",
    };

    this.init();
  }

  async init() {
    try {
      // Importar configuración de Firebase desde firebase_config.js
      const { db } = await import("./firebase_config.js");

      // Obtener referencia a Firestore
      this.db = db;

      this.initialized = true;
    } catch (error) {
      throw error;
    }
  }

  // Esperar a que el servicio esté inicializado
  async waitForInitialization() {
    if (this.initialized) return;

    // Esperar hasta que esté inicializado o timeout después de 10 segundos
    const maxAttempts = 50;
    let attempts = 0;

    while (!this.initialized && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      attempts++;
    }

    if (!this.initialized) {
      throw new Error("Firebase services failed to initialize within timeout");
    }
  }

  // =============================================
  // FUNCIONES DE CLOUDINARY (igual que register.js)
  // =============================================

  /**
   * Sube una imagen a Cloudinary
   * @param {File} file - Archivo de imagen
   * @param {string} folder - Carpeta donde subir (opcional)
   * @returns {Promise<string>} URL de la imagen subida
   */
  async uploadImageToCloudinary(file, folder = "donaciones") {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", this.CLOUDINARY_CONFIG.uploadPreset);
      formData.append("cloud_name", this.CLOUDINARY_CONFIG.cloudName);

      // Agregar carpeta si se especifica
      if (folder) {
        formData.append("folder", folder);
      }

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CONFIG.cloudName}/image/upload`,
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

  // MÉTODO PRINCIPAL MEJORADO - MEJOR MANEJO DE ERRORES
  async uploadDonation(donationData, proofFile) {
    await this.waitForInitialization();

    let proofUrl = null;

    try {
      // VALIDAR DATOS CRÍTICOS ANTES DE PROCESAR
      this.validateDonationData(donationData);

      // Generar ID único de validación
      const validationId = this.generateValidationId();

      // Generar ID único para el donador
      const donorId = this.generateDonorId();

      // 1. Subir comprobante de pago a Cloudinary si existe
      if (proofFile) {
        proofUrl = await this.uploadPaymentProof(
          proofFile,
          donationData.donationId,
          validationId
        );
      }

      // 2. Guardar en colección 'donaciones'
      await this.saveDonationData(
        donationData,
        validationId,
        donorId,
        proofUrl
      );

      // 3. Guardar en colección 'validacion'
      await this.saveValidationData(validationId, proofUrl);

      // 4. Opcional: Crear entrada en tabla de actividad
      await this.createActivityLog(
        donationData.donationId,
        "donation_created",
        validationId
      );

      return {
        success: true,
        donationId: donationData.donationId,
        validationId: validationId,
        donorId: donorId,
        proofUrl: proofUrl,
      };
    } catch (error) {
      // En caso de error, intentar eliminar la imagen de Cloudinary
      if (proofUrl) {
        await this.deleteCloudinaryImage(proofUrl).catch(() => {});
      }

      throw error;
    }
  }

  // VALIDAR DATOS ANTES DE PROCESAR
  validateDonationData(donationData) {
    // Validar estructura básica
    if (!donationData) {
      throw new Error("No se recibieron datos de donación");
    }

    if (!donationData.donationId) {
      throw new Error("ID de donación faltante");
    }

    if (!donationData.amount || donationData.amount <= 0) {
      throw new Error("Monto de donación inválido");
    }

    // Validar datos del donador
    if (!donationData.donor) {
      throw new Error("Datos del donador faltantes");
    }

    if (!donationData.donor.type) {
      throw new Error("Tipo de donador faltante");
    }

    // Validar datos del recolector
    if (!donationData.collector) {
      throw new Error("Datos del recolector faltantes");
    }

    if (!donationData.collector.id) {
      throw new Error("ID del recolector faltante");
    }

    // Validar datos de pago
    if (!donationData.payment) {
      throw new Error("Datos de pago faltantes");
    }

    if (!donationData.payment.method) {
      throw new Error("Método de pago faltante");
    }
  }

  // Generar ID único de validación
  generateValidationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `VAL-${timestamp}-${random}`;
  }

  // Generar ID único de donador
  generateDonorId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `DON-${timestamp}-${random}`;
  }

  // Subir comprobante de pago a Cloudinary
  async uploadPaymentProof(file, donationId, validationId) {
    try {
      // Validar archivo igual que en register.js
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

      if (file.size > MAX_FILE_SIZE) {
        throw new Error("El archivo es muy grande (máximo 5MB)");
      }

      if (!file.type.startsWith("image/")) {
        throw new Error("Solo se permiten archivos de imagen");
      }

      // Subir a Cloudinary en carpeta específica
      const folderName = `donaciones/comprobantes/${validationId}`;
      const downloadURL = await this.uploadImageToCloudinary(file, folderName);

      return downloadURL;
    } catch (error) {
      throw new Error("Error al subir comprobante de pago: " + error.message);
    }
  }

  // GUARDAR DATOS DE DONACIÓN - COMPLETAMENTE CORREGIDO CON VALIDACIONES
  async saveDonationData(donationData, validationId, donorId, proofUrl) {
    try {
      // Importar funciones necesarias
      const { doc, setDoc } = await import("./firebase_config.js");

      // PREPARAR DATOS SEGÚN ESTRUCTURA ESPECÍFICA
      const donacionData = {
        // ID único del donador
        IDUsuarioDonador: donorId,

        // CAMPOS CONDICIONALES SEGÚN TIPO DE DONANTE
        ...(donationData.donor.type === "individual"
          ? {
              // CAMPOS PARA PERSONA NATURAL
              NombreUsuarioDonador: donationData.donor.firstName || "",
              ApellidoUsuarioDonador: donationData.donor.lastName || "",
              DNIUsuarioDonador: donationData.donor.dni || "",
              TelefonoUsuarioDonador: donationData.donor.phone || "",
              EmailUsuarioDonador: donationData.donor.email || "",
            }
          : {
              // CAMPOS PARA EMPRESA - TODOS COMPLETADOS
              RazonSocialUsuarioDonador: donationData.donor.companyName || "",
              "RUC-UsuarioDonador": donationData.donor.ruc || "",
              RepresentanteLegalUsuarioDonador:
                donationData.donor.representative || "",
              CargoUsuarioDonador: donationData.donor.position || "",
              EmailUsuarioDonador: donationData.donor.email || "",
              // CAMPO OPCIONAL PARA EMPRESAS (mensaje o teléfono)
              OpcionalUsuarioDonador:
                donationData.donor.message ||
                donationData.donor.phone ||
                donationData.donor.additionalInfo ||
                "",
            }),

        // Tipo de usuario
        Tipo_Usuario:
          donationData.donor.type === "individual"
            ? "PERSONA NATURAL"
            : "EMPRESA",

        // Monto de la donación
        monto: donationData.amount.toString(),

        // Fecha de la donación
        fechaDonacion: new Date().toISOString(),

        // ID de validación
        IDValidacion: validationId,

        // Estado de validación (string, no boolean)
        estadoValidacion: "pendiente",

        // Usuario que modificó el estado de validación (vacío por ahora)
        UsuarioEstadoValidacion: "",

        // CAMPOS DEL RECOLECTOR - TODOS CON VALIDACIONES
        idRecolector: donationData.collector.id || "",
        nombreRecolector:
          donationData.collector.name ||
          donationData.collector.fullName ||
          `${donationData.collector.firstName || ""} ${
            donationData.collector.lastName || ""
          }`.trim() ||
          "Sin nombre",
        emailRecolector: donationData.collector.email || "",
        facultadRecolector:
          donationData.collector.faculty ||
          donationData.collector.facultad ||
          donationData.collector.department ||
          "",

        // CAMPOS DE PAGO - CON VALIDACIONES EXTRA
        metodoPago:
          donationData.payment.method ||
          donationData.payment.paymentMethod ||
          donationData.paymentMethod ||
          "",

        // CAMPOS ADICIONALES DE PAGO (si están disponibles)
        banco: donationData.payment.bank || donationData.payment.bankName || "",
        numeroOperacion:
          donationData.payment.operationNumber ||
          donationData.payment.transactionId ||
          donationData.payment.reference ||
          "",

        // OBSERVACIONES O COMENTARIOS
        observaciones:
          donationData.comments ||
          donationData.observations ||
          donationData.notes ||
          donationData.donor.message ||
          "",
      };

      // VALIDACIONES FINALES ANTES DE GUARDAR
      // Verificar que campos críticos no estén vacíos
      if (
        !donacionData.nombreRecolector ||
        donacionData.nombreRecolector === "Sin nombre"
      ) {
        donacionData.nombreRecolector =
          donacionData.idRecolector || "Recolector desconocido";
      }

      if (!donacionData.metodoPago) {
        donacionData.metodoPago = "No especificado";
      }

      // Guardar en colección 'donaciones' usando el donationId como documento
      await setDoc(
        doc(this.db, "donaciones", donationData.donationId),
        donacionData
      );

      // También agregar a colección de estadísticas diarias
      await this.updateDailyStats(donationData);
    } catch (error) {
      throw new Error("Error al guardar datos de donación: " + error.message);
    }
  }

  // Guardar datos de validación en colección 'validacion' - NUEVA ESTRUCTURA
  async saveValidationData(validationId, proofUrl) {
    try {
      const { doc, setDoc } = await import("./firebase_config.js");

      const validacionData = {
        // URL de la imagen del comprobante (desde Cloudinary)
        Imagen_Comprobante: proofUrl || "",
        // Agregar timestamp para referencia
        fechaCreacion: new Date().toISOString(),
      };

      // Guardar en colección 'validacion' usando validationId como documento
      await setDoc(doc(this.db, "validacion", validationId), validacionData);
    } catch (error) {
      throw new Error("Error al guardar datos de validación: " + error.message);
    }
  }

  // Actualizar estadísticas diarias
  async updateDailyStats(donationData) {
    try {
      const { doc, getDoc, setDoc, updateDoc } = await import(
        "./firebase_config.js"
      );

      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const statsRef = doc(this.db, "daily_stats", today);

      const statsDoc = await getDoc(statsRef);

      if (!statsDoc.exists()) {
        // Crear nuevo documento de estadísticas
        await setDoc(statsRef, {
          date: today,
          totalDonations: 1,
          totalAmount: donationData.amount,
          donationsByType: {
            [donationData.donor.type]: 1,
          },
          donationsByMethod: {
            [donationData.payment.method || "no_especificado"]: 1,
          },
          collectorsInvolved: [donationData.collector.id],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Actualizar estadísticas existentes
        const currentStats = statsDoc.data();
        const collectorsSet = new Set(currentStats.collectorsInvolved || []);
        collectorsSet.add(donationData.collector.id);

        await updateDoc(statsRef, {
          totalDonations: (currentStats.totalDonations || 0) + 1,
          totalAmount: (currentStats.totalAmount || 0) + donationData.amount,
          [`donationsByType.${donationData.donor.type}`]:
            (currentStats.donationsByType?.[donationData.donor.type] || 0) + 1,
          [`donationsByMethod.${
            donationData.payment.method || "no_especificado"
          }`]:
            (currentStats.donationsByMethod?.[
              donationData.payment.method || "no_especificado"
            ] || 0) + 1,
          collectorsInvolved: Array.from(collectorsSet),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      // No lanzar error aquí para no interrumpir el proceso principal
    }
  }

  // Crear log de actividad
  async createActivityLog(donationId, action, validationId, details = {}) {
    try {
      const { collection, addDoc } = await import("./firebase_config.js");

      await addDoc(collection(this.db, "activity_logs"), {
        donationId,
        validationId,
        action,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } catch (error) {
      // No lanzar error para no interrumpir el proceso principal
    }
  }

  // MÉTODO AUXILIAR: Obtener datos completos del recolector
  async enrichCollectorData(collectorId) {
    try {
      const { doc, getDoc } = await import("./firebase_config.js");

      const collectorRef = doc(this.db, "usuarios", collectorId);
      const collectorDoc = await getDoc(collectorRef);

      if (collectorDoc.exists()) {
        const collectorData = collectorDoc.data();
        return {
          id: collectorId,
          name: `${collectorData.nombreUsuario || ""} ${
            collectorData.apellidoUsuario || ""
          }`.trim(),
          email: collectorData.emailUsuario || "",
          faculty: collectorData.facultadUsuario || "",
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // Método para obtener donación por ID
  async getDonation(donationId) {
    try {
      const { doc, getDoc } = await import("./firebase_config.js");

      const docRef = doc(this.db, "donaciones", donationId);
      const docSnap = await getDoc(docRef);

      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      throw error;
    }
  }

  // Método para obtener datos de validación por ID
  async getValidation(validationId) {
    try {
      const { doc, getDoc } = await import("./firebase_config.js");

      const docRef = doc(this.db, "validacion", validationId);
      const docSnap = await getDoc(docRef);

      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
      throw error;
    }
  }

  // Método para actualizar estado de validación
  async updateValidationStatus(
    donationId,
    validationId,
    isValidated,
    userId = ""
  ) {
    try {
      const { doc, updateDoc } = await import("./firebase_config.js");

      // Determinar el estado como string
      let estadoString = "pendiente";
      if (
        isValidated === true ||
        isValidated === "true" ||
        isValidated === "validado"
      ) {
        estadoString = "validado";
      } else if (
        isValidated === false ||
        isValidated === "false" ||
        isValidated === "rechazado"
      ) {
        estadoString = "rechazado";
      }

      // Actualizar en colección 'donaciones'
      await updateDoc(doc(this.db, "donaciones", donationId), {
        estadoValidacion: estadoString,
        UsuarioEstadoValidacion: userId,
        fechaValidacion: new Date().toISOString(),
      });

      // Crear log de actividad
      await this.createActivityLog(
        donationId,
        "validation_updated",
        validationId,
        { isValidated: estadoString, userId }
      );
    } catch (error) {
      throw error;
    }
  }

  // Método para obtener estadísticas
  async getStats(startDate, endDate) {
    try {
      const { collection, query, where, getDocs } = await import(
        "./firebase_config.js"
      );

      const q = query(
        collection(this.db, "daily_stats"),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }

  // Método para obtener donaciones pendientes de validación
  async getPendingValidations() {
    try {
      const { collection, query, where, orderBy, getDocs } = await import(
        "./firebase_config.js"
      );

      const q = query(
        collection(this.db, "donaciones"),
        where("estadoValidacion", "==", "pendiente"),
        orderBy("fechaDonacion", "desc")
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }

  // Método para verificar conexión
  async testConnection() {
    try {
      const { collection, addDoc } = await import("./firebase_config.js");

      await addDoc(collection(this.db, "_test"), {
        test: true,
        timestamp: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Eliminar imagen de Cloudinary (opcional, para casos de error)
  async deleteCloudinaryImage(imageUrl) {
    try {
      // Extraer public_id de la URL
      const urlParts = imageUrl.split("/");
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = publicIdWithExtension.split(".")[0];

      // Nota: Para eliminar imágenes de Cloudinary necesitas hacer una petición autenticada
      // Esto normalmente se hace desde el backend por seguridad
    } catch (error) {
      // Error silencioso
    }
  }
}
