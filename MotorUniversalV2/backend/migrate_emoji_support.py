"""
Migration: Change support_messages.content and support_conversation_satisfaction.comment
from varchar(max) to nvarchar(max) to support Unicode characters (emojis).
"""
import pymssql

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'
)
cursor = conn.cursor()

# Check current column types
cursor.execute("""
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('support_messages', 'support_conversation_satisfaction')
AND COLUMN_NAME IN ('content', 'comment')
""")
print('BEFORE:')
for row in cursor.fetchall():
    print(f'  {row[0]}.{row[1]}: {row[2]}({row[3]})')

# Alter support_messages.content to nvarchar(max)
cursor.execute('ALTER TABLE support_messages ALTER COLUMN content NVARCHAR(MAX) NULL')
print('Altered support_messages.content -> nvarchar(max)')

# Alter support_conversation_satisfaction.comment to nvarchar(max)
cursor.execute('ALTER TABLE support_conversation_satisfaction ALTER COLUMN comment NVARCHAR(MAX) NULL')
print('Altered support_conversation_satisfaction.comment -> nvarchar(max)')

conn.commit()

# Verify
cursor.execute("""
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('support_messages', 'support_conversation_satisfaction')
AND COLUMN_NAME IN ('content', 'comment')
""")
print('AFTER:')
for row in cursor.fetchall():
    print(f'  {row[0]}.{row[1]}: {row[2]}({row[3]})')

conn.close()
print('Done!')
