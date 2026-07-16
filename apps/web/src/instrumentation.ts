export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { initializeDatabase } = await import("./server/db/core");
  const database = initializeDatabase();
  database.sqlite.close();
}
