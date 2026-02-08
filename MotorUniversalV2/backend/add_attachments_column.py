#!/usr/bin/env python
"""Add attachments column to balance_requests table in Azure SQL"""

from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.environ.get('DATABASE_URL', 
    'mssql+pymssql://evaluaasi_admin:EvalAasi2024_newpwd!@evaluaasi-motorv2-sql.database.windows.net:1433/evaluaasi?charset=utf8')

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE balance_requests ADD attachments NVARCHAR(MAX) NULL'))
        conn.commit()
        print('Column attachments added successfully')
    except Exception as e:
        if '2705' in str(e) or 'Column names in each table must be unique' in str(e):
            print('Column already exists')
        else:
            print(f'Error: {e}')
