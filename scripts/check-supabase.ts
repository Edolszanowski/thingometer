import postgres from "postgres"

// Direct Supabase connection
const sql = postgres("postgresql://postgres:MERRYXMAS2025!@db.vctvjltbzqkwowjspzdq.supabase.co:5432/postgres", { 
  max: 1,
  connect_timeout: 30,
  idle_timeout: 20,
})

async function check() {
  try {
    console.log("Connecting to Supabase...")
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    console.log("Tables found:", tables.length ? tables.map((t: any) => t.table_name).join(", ") : "NONE")
  } catch (e: any) {
    console.error("Error:", e.message)
  } finally {
    await sql.end()
  }
}

check()

