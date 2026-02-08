export function getEnv(name: string, options?: { required?: boolean }) {
  const value = process.env[name];
  if (!value && options?.required) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value ?? "";
}
