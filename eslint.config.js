// eslint.config.js
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // aquí puedes personalizar tus reglas
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
];
