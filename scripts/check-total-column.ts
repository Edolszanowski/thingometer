import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

config({ path: resolve(process.cwd(), ".env.local") })

const sql = neon(process.env.DATABASE_URL!)

async function checkTotalColumn() {
  try {
    const result = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_generated,
        generation_expression,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'scores' AND column_name = 'total'
    `
    console.log("Total column info:", JSON.stringify(result, null, 2))
  } catch (error) {
    console.error("Error:", error)
  }
}

checkTotalColumn()

