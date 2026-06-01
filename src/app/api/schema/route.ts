import { NextResponse } from 'next/server';
import sql from 'mssql';

export async function POST(request: Request) {
  try {
    const { server, database, user, password, api } = await request.json();

    // Configuration for mssql
    const sqlConfig = {
      user: user,
      password: password,
      database: database,
      server: server,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      },
      options: {
        encrypt: false, // For local dev, usually false
        trustServerCertificate: true // Trust local certificates
      }
    };

    // Connect
    await sql.connect(sqlConfig);

    // Using the user's EXEC DW_API wrapper for tables
    const tablesResult = await sql.query(`
      EXEC DW_API '${api}', '
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = ''BASE TABLE''
        ORDER BY TABLE_NAME
      '
    `);
    const tables = tablesResult.recordset.map(t => ({
      schema: t.TABLE_SCHEMA,
      name: t.TABLE_NAME
    }));

    // Columns
    const colsResult = await sql.query(`
      EXEC DW_API '${api}', '
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS
      '
    `);
    const columns: Record<string, {name: string, type: string}[]> = {};
    colsResult.recordset.forEach(c => {
      if (!columns[c.TABLE_NAME]) columns[c.TABLE_NAME] = [];
      columns[c.TABLE_NAME].push({ name: c.COLUMN_NAME, type: c.DATA_TYPE });
    });

    // Primary Keys
    const pksResult = await sql.query(`
      EXEC DW_API '${api}', '
        SELECT ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
            ON tc.CONSTRAINT_TYPE = ''PRIMARY KEY'' 
            AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      '
    `);
    const pks: Record<string, string[]> = {};
    pksResult.recordset.forEach(p => {
      if (!pks[p.TABLE_NAME]) pks[p.TABLE_NAME] = [];
      pks[p.TABLE_NAME].push(p.COLUMN_NAME);
    });

    // Foreign Keys
    const fksResult = await sql.query(`
      EXEC DW_API '${api}', '
        SELECT 
            OBJECT_NAME(f.parent_object_id) AS TableName,
            COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
            OBJECT_NAME (f.referenced_object_id) AS ReferenceTableName,
            COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS ReferenceColumnName
        FROM sys.foreign_keys AS f
        INNER JOIN sys.foreign_key_columns AS fc 
           ON f.object_id = fc.constraint_object_id
      '
    `);
    const fks = fksResult.recordset.map(f => ({
      table: f.TableName,
      column: f.ColumnName,
      ref_table: f.ReferenceTableName,
      ref_column: f.ReferenceColumnName
    }));

    return NextResponse.json({
      status: 'success',
      tables,
      columns,
      primary_keys: pks,
      foreign_keys: fks
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ status: 'error', message: error.message || String(error) }, { status: 400 });
  } finally {
    // Close connection pool if open
    sql.close();
  }
}
