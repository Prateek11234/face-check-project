import sqlite3

def execute_sql_query(database_path, sql_query):
    """Executes an SQL query and returns the results."""
    try:
        connection = sqlite3.connect(database_path)
        cursor = connection.cursor()
        cursor.execute(sql_query)
        results = cursor.fetchall()
        connection.close()
        return results
    except sqlite3.Error as e:
        print(f"An error occurred: {e}")
        return None

# Example usage:
database_file = r"C:\Users\Amity\PycharmProjects\face_check\Final\registration_project\db.sqlite3"  # Replace with your database file path
query = "SELECT * FROM registration_app_student;"


results = execute_sql_query(database_file, query)

if results:
    for row in results:
        print(row) # or print each column in a formatted way.