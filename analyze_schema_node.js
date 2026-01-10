const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function analyzeSchema() {
    try {
        const schemaInfo = {
            enums: {},
            tables: {}
        };

        console.log("Starting full schema analysis...");

        // 1. Get all Enums
        const enumRes = await pool.query(`
            SELECT DISTINCT t.typname as enum_name, e.enumlabel as enum_value
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            ORDER BY t.typname, e.enumsortorder
        `);

        enumRes.rows.forEach(row => {
            if (!schemaInfo.enums[row.enum_name]) {
                schemaInfo.enums[row.enum_name] = [];
            }
            schemaInfo.enums[row.enum_name].push(row.enum_value);
        });

        // 2. Get all Tables and Columns
        const tableRes = await pool.query(`
            SELECT 
                table_schema, 
                table_name, 
                column_name, 
                data_type, 
                udt_name, 
                is_nullable, 
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        `);

        tableRes.rows.forEach(row => {
            const fullTableName = `${row.table_schema}.${row.table_name}`;
            if (!schemaInfo.tables[fullTableName]) {
                schemaInfo.tables[fullTableName] = {
                    columns: [],
                    foreign_keys: []
                };
            }
            schemaInfo.tables[fullTableName].columns.push({
                name: row.column_name,
                type: row.data_type,
                udt_name: row.udt_name,
                nullable: row.is_nullable === 'YES',
                default: row.column_default
            });
        });

        // 3. Get all Foreign Keys
        const fkRes = await pool.query(`
            SELECT
                tc.table_schema, 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
        `);

        fkRes.rows.forEach(row => {
            const fullTableName = `${row.table_schema}.${row.table_name}`;
            if (schemaInfo.tables[fullTableName]) {
                schemaInfo.tables[fullTableName].foreign_keys.push({
                    column: row.column_name,
                    references: `${row.foreign_table_schema}.${row.foreign_table_name}.${row.foreign_column_name}`
                });
            }
        });

        fs.writeFileSync('full_schema_analysis.json', JSON.stringify(schemaInfo, null, 2));
        console.log("Schema analysis complete. Saved to full_schema_analysis.json");

    } catch (err) {
        console.error("Error during schema analysis:", err);
    } finally {
        await pool.end();
    }
}

analyzeSchema();
