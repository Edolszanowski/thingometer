# Neon Database Access Configuration

## Current Setup

Your application is configured to use Neon PostgreSQL with the following:

### 1. Connection String Format

Your `DATABASE_URL` should be in this format:
```
postgresql://username:password@host/database?sslmode=require&channel_binding=require
```

**Required Parameters:**
- `sslmode=require` - Ensures secure SSL connection
- `channel_binding=require` - Additional security layer

### 2. What You Currently Have

✅ **Connection String** - Set in `.env.local` as `DATABASE_URL`
✅ **Drizzle ORM** - Configured with Neon HTTP adapter
✅ **Database Schema** - Tables created (judges, floats, scores)
✅ **Connection Working** - Test script confirms access

## What's Needed for Full Database Access

### 1. Neon Account Permissions

**Required:**
- ✅ Neon account (you have this)
- ✅ Project created (you have this)
- ✅ Database user with appropriate permissions

**Check Your Neon Dashboard:**
1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project
3. Go to **Settings** → **Users**
4. Verify your database user has:
   - `CREATE` permission (to create tables)
   - `INSERT` permission (to add data)
   - `UPDATE` permission (to modify data)
   - `SELECT` permission (to read data)
   - `DELETE` permission (to remove data)

### 2. Connection String Components

Your connection string contains:
```
postgresql://neondb_owner:npg_Wk6PTNO0CfnX@ep-small-field-a4kkxib9-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Breakdown:**
- `neondb_owner` - Database username (project owner)
- `npg_Wk6PTNO0CfnX` - Password
- `ep-small-field-a4kkxib9-pooler.us-east-1.aws.neon.tech` - Host (pooler endpoint)
- `neondb` - Database name
- `?sslmode=require&channel_binding=require` - Security parameters

### 3. For MCP Server Access (if using Neon MCP)

If you want to use the Neon MCP server in Cursor, you may need:

**Option A: API Key (Recommended)**
1. Go to Neon Dashboard → **Settings** → **API Keys**
2. Create a new API key
3. Add to your MCP configuration:

```json
{
  "mcpServers": {
    "Neon": {
      "url": "https://mcp.neon.tech/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**Option B: Connection String in MCP**
Some MCP servers may need the connection string directly. Check Neon MCP documentation.

### 4. Database User Permissions

Your current user (`neondb_owner`) should have full access by default. To verify:

**Run this SQL in Neon SQL Editor:**
```sql
-- Check current user permissions
SELECT current_user, current_database();

-- Check if you can create tables
SELECT has_database_privilege(current_user, current_database(), 'CREATE');

-- List all your permissions
SELECT 
    grantee, 
    table_schema, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = current_user;
```

### 5. Connection Pooling

Your connection string uses the **pooler** endpoint (`-pooler` in hostname), which is correct for serverless applications.

**Benefits:**
- Better connection management
- Automatic scaling
- Optimized for serverless functions

### 6. Environment Variables

**Required for Full Access:**
```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require&channel_binding=require
```

**Optional (for advanced features):**
```env
# If using Neon API directly
NEON_API_KEY=your_api_key_here

# For connection pooling settings
DATABASE_POOL_MIN=1
DATABASE_POOL_MAX=10
```

### 7. Network Access

**For Local Development:**
- ✅ No IP restrictions needed (connection string works)

**For Production (Vercel):**
- ✅ Neon allows connections from anywhere by default
- ✅ No firewall configuration needed

**If you need IP restrictions:**
1. Go to Neon Dashboard → **Settings** → **IP Allowlist**
2. Add Vercel IP ranges (usually not needed)

### 8. Schema Permissions

Your Drizzle schema creates tables with:
- Primary keys
- Foreign keys
- Unique constraints
- Generated columns (total)

**Verify schema access:**
```bash
npm run test:db
```

This will test:
- ✅ Connection
- ✅ Table access
- ✅ Insert operations
- ✅ Update operations
- ✅ Delete operations

## Troubleshooting Full Access Issues

### Issue: "Permission denied"
**Solution:** Check user permissions in Neon Dashboard

### Issue: "Connection timeout"
**Solution:** 
- Verify connection string is correct
- Check if database is paused (Neon free tier pauses after inactivity)
- Use pooler endpoint (you're already using it)

### Issue: "Cannot insert into generated column"
**Solution:** ✅ Already fixed - don't set `total` column manually

### Issue: "Table does not exist"
**Solution:** Run migrations:
```bash
npm run db:push
```

## Current Status

✅ **Connection:** Working
✅ **Read Access:** Working (tested)
✅ **Write Access:** Working (tested)
✅ **Schema:** Created and accessible
✅ **Permissions:** Full access confirmed

## Next Steps (if needed)

1. **For MCP Server:** Add API key to MCP config if needed
2. **For Production:** Use same connection string in Vercel
3. **For Monitoring:** Use Neon Dashboard to monitor queries
4. **For Backups:** Neon automatically backs up your database

## Security Best Practices

1. ✅ **Never commit** `.env.local` to git (already in `.gitignore`)
2. ✅ **Use SSL** (`sslmode=require` - already configured)
3. ✅ **Rotate passwords** periodically in Neon Dashboard
4. ✅ **Use environment variables** in production (Vercel)
5. ✅ **Limit API keys** to specific projects if using Neon API


