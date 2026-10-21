import "dotenv/config";

export type ServerConfig = {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
  developmentAuthUserId: string | null;
  googleClientIds: string[];
  corsOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    nodeEnv: env.NODE_ENV ?? "development",
    developmentAuthUserId: env.DEV_AUTH_USER_ID ?? null,
    googleClientIds: (env.GOOGLE_CLIENT_IDS ?? env.GOOGLE_CLIENT_ID ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    corsOrigins: (env.CORS_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}
