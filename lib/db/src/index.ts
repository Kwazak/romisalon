import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { PgBoolean } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

PgBoolean.prototype.mapFromDriverValue = (value: unknown): boolean => {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
};

const COLUMN_DEFAULTS: Record<string, string> = {
  created_at: "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
  is_active: "1",
  manual_level: "0",
  min_spending: "0",
  discount_percent: "0",
  sort_order: "0",
  total_spending: "0",
  points: "0",
  discount_amount: "0",
  phone: "''",
  description: "''",
  role: "'MEMBER'",
  badge_color: "'#C9A66B'",
  benefits: "'{}'",
  category: "'Perawatan'",
  deleted_at: "NULL",
  image_url: "NULL",
  payment_ref: "NULL",
  paid_at: "NULL",
  read_at: "NULL",
};

function replaceInsertDefaults(sqlText: string): string {
  const match = sqlText.match(/^(\s*insert\s+into\s+"[^"]+"\s*\(([^)]+)\)\s*values\s*)([\s\S]+)$/i);
  if (!match) return sqlText;

  const prefix = match[1]!;
  const columns = match[2]!.split(",").map((col) => col.trim().replace(/^"|"$/g, ""));
  const rest = match[3]!;

  const replacedRest = rest.replace(/\(([^()]+)\)/g, (tupleMatch, inner: string) => {
    const tokens = inner.split(",").map((token) => token.trim());
    if (tokens.length !== columns.length) return tupleMatch;
    const mapped = tokens.map((token, index) => {
      if (token.toLowerCase() === "default") {
        const colName = columns[index] ?? "";
        return COLUMN_DEFAULTS[colName] ?? "NULL";
      }
      return token;
    });
    return `(${mapped.join(", ")})`;
  });

  return `${prefix}${replacedRest}`;
}

function createSqlitePgClient(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA foreign_keys = ON;");

  return {
    async query(
      configOrText: string | { text: string; rowMode?: string },
      rawParams: unknown[] = [],
    ): Promise<{ rows: unknown[] }> {
      const text = typeof configOrText === "string" ? configOrText : configOrText.text;
      const isArrayMode =
        typeof configOrText === "object" &&
        configOrText !== null &&
        configOrText.rowMode === "array";

      const trimmed = text.trim();
      const lower = trimmed.toLowerCase();

      if (lower.startsWith("select pg_advisory_xact_lock")) {
        return { rows: [] };
      }

      if (
        lower === "begin" ||
        lower.startsWith("begin ") ||
        lower === "commit" ||
        lower === "rollback" ||
        lower.startsWith("savepoint ") ||
        lower.startsWith("release savepoint ") ||
        lower.startsWith("rollback to savepoint ")
      ) {
        sqlite.exec(trimmed);
        return { rows: [] };
      }

      if (
        lower.startsWith("create table") ||
        lower.startsWith("create index") ||
        lower.startsWith("create unique index")
      ) {
        const sqliteDdl = trimmed
          .replace(/\btimestamptz\b/gi, "text")
          .replace(/\btext\[\]/gi, "text")
          .replace(
            /DEFAULT\s+now\(\)/gi,
            "DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
          )
          .replace(/DEFAULT\s+true\b/gi, "DEFAULT 1")
          .replace(/DEFAULT\s+false\b/gi, "DEFAULT 0");
        sqlite.exec(sqliteDdl);
        return { rows: [] };
      }

      const boundParams: Array<string | number | bigint | Uint8Array | null> = [];
      const sqliteSql = replaceInsertDefaults(trimmed)
        .replace(/\bilike\b/gi, "LIKE")
        .replace(/\$(\d+)/g, (_match, indexStr: string) => {
          const idx = Number(indexStr) - 1;
          const val = rawParams[idx];
          if (val === undefined || val === null) {
            boundParams.push(null);
          } else if (typeof val === "boolean") {
            boundParams.push(val ? 1 : 0);
          } else if (val instanceof Date) {
            boundParams.push(val.toISOString());
          } else if (
            typeof val === "number" ||
            typeof val === "bigint" ||
            typeof val === "string"
          ) {
            boundParams.push(val);
          } else {
            boundParams.push(JSON.stringify(val));
          }
          return "?";
        });

      const stmt = sqlite.prepare(sqliteSql);
      const hasReturningOrSelect =
        /^\s*select\b/i.test(sqliteSql) || /\breturning\b/i.test(sqliteSql);

      if (!hasReturningOrSelect) {
        stmt.run(...boundParams);
        return { rows: [] };
      }

      if (isArrayMode) {
        (stmt as unknown as { setReturnArrays(enabled: boolean): void }).setReturnArrays(true);
        const arrayRows = stmt.all(...boundParams) as unknown as unknown[][];
        return {
          rows: arrayRows,
        };
      }

      const objectRows = stmt.all(...boundParams) as Array<Record<string, unknown>>;
      return {
        rows: objectRows,
      };
    },
  };
}

function createDatabase(): { pool: pg.Pool | null; db: NodePgDatabase<typeof schema> } {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString && !connectionString.startsWith("sqlite:")) {
    const pgPool = new Pool({ connectionString });
    return {
      pool: pgPool,
      db: drizzle(pgPool, { schema }),
    };
  }

  const sqlitePath = connectionString?.startsWith("sqlite://")
    ? connectionString.slice("sqlite://".length)
    : ":memory:";
  const sqliteClient = createSqlitePgClient(sqlitePath);

  return {
    pool: null,
    db: drizzle(sqliteClient as unknown as pg.Client, { schema }),
  };
}

const instance = createDatabase();

export const pool = instance.pool;
export const db = instance.db;

export * from "./schema";
