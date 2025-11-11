export const USE_API =
  (process.env.NODE_ENV === "development"
    ? import.meta.env.PUBLIC_USE_API
    : process.env.PUBLIC_USE_API) === "true";
