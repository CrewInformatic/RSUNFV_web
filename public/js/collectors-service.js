// collectors-service.js
import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "./firebase_config.js";

/**
 * Configuración específica para recolectores
 */
const COLLECTORS_CONFIG = {
  COLLECTION_NAME: "usuarios",
  ROLE_ID: "rol_004", // Mantener este valor
  DEFAULT_PHOTO:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='0.3em' font-family='Arial' font-size='30' fill='%236c757d'%3E👤%3C/text%3E%3C/svg%3E",
  SORT_FIELD: "nombreUsuario",
};

/**
 * Modelo de datos para un recolector
 */
class CollectorModel {
  constructor(userData) {
    this.id = userData.id;
    this.name = this.buildFullName(userData);
    this.email = userData.correo || "";
    this.photo = userData.fotoPerfil || COLLECTORS_CONFIG.DEFAULT_PHOTO;
    this.age = userData.edad || "";
    this.facultyId = userData.facultadID || "";
    this.registrationDate = userData.fechaRegistro || "";
    this.lastAccess = userData.ultimoAcceso || "";
    this.userId = userData.idUsuario || "";
    this.cellPhone = userData.celular || "";
    this.userCode = userData.codigoUsuario || "";
    this.firstName = userData.nombreUsuario || "";
    this.lastName = userData.apellidoUsuario || "";
    this.schoolId = userData.escuelaID || "";
    this.isActive = userData.estadoActivo || false;
    this.isAdmin = userData.esAdmin || false;
    this.birthDate = userData.fechaNacimiento || "";
    this.updateDate = userData.fechaActualizacion || "";
    this.modificationDate = userData.fechaModificacion || "";
    this.medalId = userData.medallasID || "";
    this.projectId = userData.poloTallaID || "";
    this.cycle = userData.ciclo || "";

    // CAMPOS DE PAGO - USANDO LOS NOMBRES EXACTOS DE FIREBASE
    this.yape = userData.Yape || "";
    this.banco = userData.banco || "";
    this.cuentaBancaria = userData.cuentaBancaria || "";
    this.apellidoUsuario = userData.apellidoUsuario || "";

    // INFORMACIÓN DE PAGO COMPLETA
    this.paymentInfo = this.extractPaymentInfo(userData);

    // Campos calculados para compatibilidad
    this.experience = this.calculateExperience();
    this.location = this.getLocationFromFaculty();
    this.rating = this.generateDefaultRating();
    this.donations = this.generateDefaultDonations();
    this.availablePaymentMethods = this.getAvailablePaymentMethods();
  }

  /**
   * Construye el nombre completo del recolector
   */
  buildFullName(userData) {
    const firstName = userData.nombreUsuario || "";
    const lastName = userData.apellidoUsuario || "";

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    }

    return "Usuario sin nombre";
  }

  /**
   * Extrae información de pago del usuario - MEJORADO
   */
  extractPaymentInfo(userData) {
    return {
      // Datos bancarios
      bankName: userData.banco || "",
      accountNumber: userData.cuentaBancaria || "",
      cciNumber: userData.cci || "",
      accountHolder: userData.apellidoUsuario || this.name,

      // Datos digitales - USANDO NOMBRES EXACTOS DE FIREBASE
      yapeNumber: userData.Yape || userData.celular || "",
      plinNumber: userData.plin || userData.celular || "",
      digitalName: userData.apellidoUsuario || this.name,
      qrCode: userData.codigoQR || "",

      // Información adicional
      cellPhone: userData.celular || "",
      email: userData.correo || "",
    };
  }

  /**
   * NUEVO: Determina qué métodos de pago están disponibles
   */
  getAvailablePaymentMethods() {
    const methods = [];

    // Verificar si tiene datos bancarios
    if (this.paymentInfo.bankName && this.paymentInfo.accountNumber) {
      methods.push({
        type: "bank",
        name: "Transferencia Bancaria",
        data: {
          bankName: this.paymentInfo.bankName,
          accountNumber: this.paymentInfo.accountNumber,
          cciNumber: this.paymentInfo.cciNumber,
          accountHolder: this.paymentInfo.accountHolder,
        },
      });
    }

    // Verificar si tiene Yape
    if (this.paymentInfo.yapeNumber) {
      methods.push({
        type: "yape",
        name: "Yape",
        data: {
          phoneNumber: this.paymentInfo.yapeNumber,
          holderName: this.paymentInfo.digitalName,
          qrCode: this.paymentInfo.qrCode,
        },
      });
    }

    // Verificar si tiene Plin
    if (this.paymentInfo.plinNumber) {
      methods.push({
        type: "plin",
        name: "Plin",
        data: {
          phoneNumber: this.paymentInfo.plinNumber,
          holderName: this.paymentInfo.digitalName,
        },
      });
    }

    // Si no tiene ningún método, agregar contacto directo
    if (methods.length === 0) {
      methods.push({
        type: "contact",
        name: "Contacto Directo",
        data: {
          phone: this.cellPhone,
          email: this.email,
          message: "Contacta al recolector para coordinar el pago",
        },
      });
    }

    return methods;
  }

  /**
   * Calcula la experiencia basada en la fecha de registro
   */
  calculateExperience() {
    if (!this.registrationDate) return "Nuevo";

    try {
      const registrationYear = new Date(this.registrationDate).getFullYear();
      const currentYear = new Date().getFullYear();
      const years = currentYear - registrationYear;

      return years > 0 ? `${years} ${years === 1 ? "año" : "años"}` : "Nuevo";
    } catch (error) {
      return "Nuevo";
    }
  }

  /**
   * Obtiene la ubicación basada en la facultad
   */
  getLocationFromFaculty() {
    const facultyLocationMap = {
      F001: "Facultad de Ingeniería",
      F002: "Facultad de Medicina",
      F003: "Facultad de Derecho",
      F004: "Facultad de Educación",
      F005: "Facultad de Economía",
      E001: "Escuela de Postgrado",
      E002: "Escuela de Arquitectura",
    };

    return facultyLocationMap[this.facultyId] || "Campus Central";
  }

  /**
   * Genera un rating por defecto basado en datos disponibles
   */
  generateDefaultRating() {
    // Rating basado en algunos factores aleatorios pero consistentes
    const baseRating = 4.2;
    const variation = (this.id.length % 8) / 10; // Variación consistente basada en el ID
    return (baseRating + variation).toFixed(1);
  }

  /**
   * Genera número de donaciones por defecto
   */
  generateDefaultDonations() {
    // Número consistente basado en el ID del usuario
    const seed = this.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Math.floor((seed % 150) + 20); // Entre 20 y 170 donaciones
  }

  /**
   * Convierte el modelo a formato para la UI - MEJORADO
   */
  toUIFormat() {
    return {
      // Datos básicos
      id: this.id,
      name: this.name,
      email: this.email,
      photo: this.photo,
      age: this.age,
      facultyId: this.facultyId,
      schoolId: this.schoolId,
      userId: this.userId,
      cellPhone: this.cellPhone,
      userCode: this.userCode,
      firstName: this.firstName,
      lastName: this.lastName,
      apellidoUsuario: this.apellidoUsuario,

      // Fechas
      registrationDate: this.registrationDate,
      lastAccess: this.lastAccess,
      birthDate: this.birthDate,
      updateDate: this.updateDate,
      modificationDate: this.modificationDate,

      // Estados
      isActive: this.isActive,
      isAdmin: this.isAdmin,

      // Campos adicionales
      medalId: this.medalId,
      projectId: this.projectId,
      cycle: this.cycle,

      // Campos de pago - NOMBRES EXACTOS DE FIREBASE
      Yape: this.yape,
      cuentaBancaria: this.cuentaBancaria,

      // Campos calculados para UI
      experience: this.experience,
      location: this.location,
      rating: parseFloat(this.rating),
      donations: this.donations,

      // INFORMACIÓN DE PAGO COMPLETA
      paymentInfo: this.paymentInfo,
      availablePaymentMethods: this.availablePaymentMethods,

      // DATOS COMPLETOS PARA EL CONTROLADOR
      fullData: {
        personal: {
          id: this.id,
          name: this.name,
          firstName: this.firstName,
          lastName: this.lastName,
          apellidoUsuario: this.apellidoUsuario,
          email: this.email,
          phone: this.cellPhone,
          faculty: this.location,
          userCode: this.userCode,
          userId: this.userId,
          age: this.age,
          cycle: this.cycle,
          birthDate: this.birthDate,
        },
        payment: this.paymentInfo,
        methods: this.availablePaymentMethods,
        stats: {
          rating: parseFloat(this.rating),
          donations: this.donations,
          experience: this.experience,
        },
        // TODOS LOS DATOS ORIGINALES DE FIREBASE
        raw: {
          facultadID: this.facultyId,
          escuelaID: this.schoolId,
          estadoActivo: this.isActive,
          esAdmin: this.isAdmin,
          fechaRegistro: this.registrationDate,
          fechaActualizacion: this.updateDate,
          fechaModificacion: this.modificationDate,
          fechaNacimiento: this.birthDate,
          ultimoAcceso: this.lastAccess,
          medallasID: this.medalId,
          poloTallaID: this.projectId,
          Yape: this.yape,
          cuentaBancaria: this.cuentaBancaria,
        },
      },
    };
  }

  /**
   * Valida si el recolector tiene datos mínimos requeridos
   */
  isValid() {
    return (
      this.id &&
      this.name &&
      this.name !== "Usuario sin nombre" &&
      this.email &&
      this.email.includes("@")
    );
  }

  /**
   * NUEVO: Verifica si el recolector tiene métodos de pago válidos
   */
  hasPaymentMethods() {
    return this.availablePaymentMethods.length > 0;
  }

  /**
   * NUEVO: Obtiene el método de pago preferido
   */
  getPreferredPaymentMethod() {
    if (this.availablePaymentMethods.length === 0) return null;

    // Prioridad: Yape > Plin > Banco > Contacto
    const priority = ["yape", "plin", "bank", "contact"];

    for (const type of priority) {
      const method = this.availablePaymentMethods.find((m) => m.type === type);
      if (method) return method;
    }

    return this.availablePaymentMethods[0];
  }
}

/**
 * Servicio para manejo de recolectores - MEJORADO
 */
class CollectorsService {
  /**
   * Obtiene todos los recolectores activos desde Firebase
   * @returns {Promise<Array>} Lista de recolectores formateados
   */
  static async getActiveCollectors() {
    try {
      console.log("Obteniendo recolectores activos...");

      const collectorsQuery = query(
        collection(db, COLLECTORS_CONFIG.COLLECTION_NAME),
        where("idRol", "==", COLLECTORS_CONFIG.ROLE_ID),
        where("estadoActivo", "==", true)
      );

      const querySnapshot = await getDocs(collectorsQuery);
      const collectors = [];

      querySnapshot.forEach((doc) => {
        const userData = {
          id: doc.id,
          ...doc.data(),
        };

        const collector = new CollectorModel(userData);

        if (collector.isValid()) {
          collectors.push(collector.toUIFormat());
        } else {
          console.warn("Recolector inválido encontrado:", userData);
        }
      });

      // Ordenar por nombre
      collectors.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`${collectors.length} recolectores obtenidos exitosamente`);
      console.log("Datos completos de recolectores:", collectors);

      return collectors;
    } catch (error) {
      console.error("Error obteniendo recolectores:", error);
      throw new CollectorsServiceError(
        "Error al cargar los recolectores",
        error
      );
    }
  }

  /**
   * Obtiene un recolector específico por ID - MEJORADO
   */
  static async getCollectorById(collectorId) {
    try {
      const collectorsQuery = query(
        collection(db, COLLECTORS_CONFIG.COLLECTION_NAME),
        where("idRol", "==", COLLECTORS_CONFIG.ROLE_ID),
        where("estadoActivo", "==", true)
      );

      const querySnapshot = await getDocs(collectorsQuery);
      let foundCollector = null;

      querySnapshot.forEach((doc) => {
        if (doc.id === collectorId) {
          const userData = {
            id: doc.id,
            ...doc.data(),
          };

          const collector = new CollectorModel(userData);
          if (collector.isValid()) {
            foundCollector = collector.toUIFormat();
          }
        }
      });

      if (foundCollector) {
        console.log(
          "Recolector encontrado con datos completos:",
          foundCollector
        );
      }

      return foundCollector;
    } catch (error) {
      console.error("Error obteniendo recolector por ID:", error);
      throw new CollectorsServiceError("Error al obtener el recolector", error);
    }
  }

  /**
   * NUEVO: Obtiene recolectores con métodos de pago disponibles
   */
  static async getCollectorsWithPaymentMethods() {
    try {
      const collectors = await this.getActiveCollectors();
      return collectors.filter((collector) => collector.hasPaymentMethods);
    } catch (error) {
      console.error(
        "Error obteniendo recolectores con métodos de pago:",
        error
      );
      throw new CollectorsServiceError("Error al obtener recolectores", error);
    }
  }

  /**
   * Filtra recolectores por facultad
   */
  static filterByFaculty(collectors, facultyId) {
    if (!facultyId) return collectors;
    return collectors.filter((collector) => collector.facultyId === facultyId);
  }

  /**
   * Ordena recolectores por criterio específico
   */
  static sortCollectors(collectors, criteria = "rating") {
    const sortFunctions = {
      rating: (a, b) => b.rating - a.rating,
      donations: (a, b) => b.donations - a.donations,
      name: (a, b) => a.name.localeCompare(b.name),
      paymentMethods: (a, b) =>
        b.availablePaymentMethods.length - a.availablePaymentMethods.length,
      age: (a, b) => {
        const ageA = parseInt(a.age) || 0;
        const ageB = parseInt(b.age) || 0;
        return ageA - ageB;
      },
      experience: (a, b) => {
        const getYears = (exp) => {
          const match = exp.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        return getYears(b.experience) - getYears(a.experience);
      },
    };

    const sortFn = sortFunctions[criteria] || sortFunctions.rating;
    return [...collectors].sort(sortFn);
  }

  /**
   * Obtiene recolectores con fallback a datos por defecto - MEJORADO
   */
  static async getCollectorsWithFallback() {
    try {
      const collectors = await this.getActiveCollectors();

      if (collectors.length === 0) {
        console.warn(
          "No se encontraron recolectores, usando datos por defecto"
        );
        return this.getDefaultCollectors();
      }

      return collectors;
    } catch (error) {
      console.error("Error obteniendo recolectores, usando fallback:", error);
      return this.getDefaultCollectors();
    }
  }
}

/**
 * Error personalizado para el servicio de recolectores
 */
class CollectorsServiceError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = "CollectorsServiceError";
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

// Exportaciones
export {
  CollectorsService,
  CollectorModel,
  CollectorsServiceError,
  COLLECTORS_CONFIG,
};
