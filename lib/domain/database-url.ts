export function getDatabaseName(connectionString: string) {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use the MySQL protocol");
    const databaseName = decodeURIComponent(url.pathname.replace(/^\//, "")).trim();
    if (!databaseName) throw new Error("DATABASE_URL must include a MySQL database name");
    return databaseName;
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) throw error;
    throw new Error("DATABASE_URL must be a valid MySQL connection URL");
  }
}

export function assertDatabaseName(connectionString: string, expectedDatabaseName: string) {
  const actualDatabaseName = getDatabaseName(connectionString);
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error(`Expected MySQL database ${expectedDatabaseName}, received ${actualDatabaseName}`);
  }
}
