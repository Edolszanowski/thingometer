import postgres from "postgres"

const regions = [
  "aws-0-us-east-1",
  "aws-0-us-east-2", 
  "aws-0-us-west-1",
  "aws-0-us-west-2",
  "aws-0-eu-west-1",
  "aws-0-eu-central-1",
  "aws-0-ap-southeast-1",
]

const projectRef = "vctvjltbzqkwowjspzdq"
const password = "MERRYXMAS2025!"

async function tryRegion(region: string) {
  const url = `postgresql://postgres.${projectRef}:${password}@${region}.pooler.supabase.com:6543/postgres`
  console.log(`Trying ${region}...`)
  
  const sql = postgres(url, { 
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
  })
  
  try {
    await sql`SELECT 1`
    console.log(`✅ SUCCESS: ${region}`)
    console.log(`Connection string: ${url.replace(password, "[PASSWORD]")}`)
    await sql.end()
    return true
  } catch (e: any) {
    console.log(`❌ ${region}: ${e.message.substring(0, 50)}`)
    try { await sql.end() } catch {}
    return false
  }
}

async function main() {
  console.log("Testing Supabase pooler regions...\n")
  
  for (const region of regions) {
    const success = await tryRegion(region)
    if (success) {
      process.exit(0)
    }
  }
  
  console.log("\nNo working region found. Please get pooler URL from Supabase Dashboard.")
}

main()

