import "dotenv/config";

export type ServerConfig = {
  port: number;
  databaseUrl: string;
  nodeEnv: string;
  developmentAuthUserId: string | null;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    nodeEnv: env.NODE_ENV ?? "development",
    developmentAuthUserId: env.DEV_AUTH_USER_ID ?? null,
  };
}
