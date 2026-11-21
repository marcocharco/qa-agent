import pg from "pg";

let pool: pg.Pool | undefined;
export const db = () => (pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL }));
export const closeDb = async () => {
  await pool?.end();
  pool = undefined;
};
