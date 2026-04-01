import knex, { type Knex } from "knex";
import { resolveDatabaseConnection } from "@/lib/db-config";

declare global {
  // eslint-disable-next-line no-var
  var __pangDbKnex__: Promise<Knex> | undefined;
}

export async function getDb(): Promise<Knex> {
  if (!global.__pangDbKnex__) {
    global.__pangDbKnex__ = createDb();
  }

  return global.__pangDbKnex__;
}

async function createDb(): Promise<Knex> {
  const { config } = await resolveDatabaseConnection();

  return knex({
    client: "pg",
    connection: config,
    pool: {
      min: 0,
      max: 4,
      idleTimeoutMillis: 30_000,
    },
  });
}
