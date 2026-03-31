#!/usr/bin/env python3
"""
Seed Knowledge Base Script
Reads markdown documentation files from docs/ folder and inserts them into rag.kb_documents
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path

# Database connection parameters
DB_CONFIG = {
    "host": "158.220.119.50",
    "port": 5432,
    "database": "n1_support",
    "user": "postgres",
    "password": "postgres",
    "schema": "rag",
}

# Category mapping: docs folder -> area (database)
CATEGORY_MAP = {
    "05-authentication": "login_auth",
    "18-user-flows": "login_auth",
    "08-document-generation": "document_generation",
    "09-prompt-templates": "document_generation",
    "10-ai-tracking": "document_generation",
    "24-generated-documents": "document_generation",
    "20-projects": "task_sprint",
    "21-tasks": "task_sprint",
    "22-sprints": "task_sprint",
    "01-project-overview": "general",
    "02-folder-structure": "general",
    "03-glossary": "general",
    "04-database-schema": "general",
    "06-project-context": "general",
    "07-state-management": "general",
    "11-api-endpoints": "general",
    "12-supabase-functions": "general",
    "13-database-views": "general",
    "14-component-organization": "general",
    "15-routing-system": "general",
    "16-ui-theming": "general",
    "17-team-members": "general",
    "19-permissions": "general",
    "23-meeting-transcripts": "general",
}


def get_docs_folder():
    """Get the docs folder path"""
    # Go up from supabase/ folder to project root
    current = Path(__file__).parent
    return current.parent / "docs"


def read_markdown_files(docs_folder: Path) -> list[tuple]:
    """Read all markdown files and return list of (area, title, content, file_path) tuples"""
    documents = []

    for folder_name, area in CATEGORY_MAP.items():
        folder_path = docs_folder / folder_name

        if not folder_path.exists():
            print(f"Warning: Folder not found: {folder_path}")
            continue

        # Find markdown files in the folder
        for md_file in folder_path.glob("*.md"):
            try:
                content = md_file.read_text(encoding="utf-8")

                # Extract title from first H1 or use filename
                title = md_file.stem  # Default to filename without extension
                for line in content.split("\n"):
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break

                file_path = f"docs/{folder_name}/{md_file.name}"

                documents.append((area, title, content, file_path))
                print(f"  - {area}: {title} ({file_path})")

            except Exception as e:
                print(f"Error reading {md_file}: {e}")

    return documents


def create_seed_sql(documents: list[tuple], output_path: Path) -> None:
    """Create the seed SQL file"""
    sql_lines = [
        "-- Seed Knowledge Base",
        "-- Auto-generated from docs/ folder",
        "-- Run this script to populate rag.kb_documents",
        "",
        f"SET search_path TO {DB_CONFIG['schema']};",
        "",
        "-- Clear existing documents",
        "DELETE FROM kb_documents;",
        "",
        "-- Insert knowledge base documents",
        "INSERT INTO kb_documents (area, title, content, file_path) VALUES",
    ]

    values = []
    for i, (area, title, content, file_path) in enumerate(documents):
        # Escape single quotes in content and title
        escaped_title = title.replace("'", "''")
        escaped_content = content.replace("'", "''")
        escaped_path = file_path.replace("'", "''")

        values.append(
            f"    ('{area}', '{escaped_title}', '{escaped_content}', '{escaped_path}')"
        )

    sql_lines.append(",\n".join(values))
    sql_lines.append(";")
    sql_lines.append("")
    sql_lines.append("-- Verify insertion:")
    sql_lines.append("SELECT area, COUNT(*) FROM kb_documents GROUP BY area;")

    output_path.write_text("\n".join(sql_lines), encoding="utf-8")
    print(f"\nGenerated SQL file: {output_path}")


def seed_database(documents: list[tuple]) -> None:
    """Insert documents into the database"""
    print("\nConnecting to database...")

    try:
        conn = psycopg2.connect(
            host=DB_CONFIG["host"],
            port=DB_CONFIG["port"],
            database=DB_CONFIG["database"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
        )
        conn.autocommit = True
        cursor = conn.cursor()

        # Ensure schema exists
        cursor.execute(f"SET search_path TO {DB_CONFIG['schema']};")

        # Clear existing documents
        cursor.execute("DELETE FROM kb_documents;")
        print("Cleared existing documents")

        # Insert documents
        for area, title, content, file_path in documents:
            cursor.execute(
                "INSERT INTO kb_documents (area, title, content, file_path) VALUES (%s, %s, %s, %s)",
                (area, title, content, file_path),
            )

        print(f"\nInserted {len(documents)} documents")

        # Verify
        cursor.execute("SELECT area, COUNT(*) FROM kb_documents GROUP BY area;")
        results = cursor.fetchall()

        print("\nDocuments by area:")
        for area, count in results:
            print(f"  {area}: {count}")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Database error: {e}")
        print("\nFalling back to SQL file generation only...")
        return False

    return True


def main():
    docs_folder = get_docs_folder()
    project_root = docs_folder.parent

    print(f"Reading documentation from: {docs_folder}")
    print("\nMapping:")
    for folder, area in CATEGORY_MAP.items():
        print(f"  docs/{folder}/ -> {area}")

    print("\n" + "=" * 50)
    print("Reading markdown files...")
    documents = read_markdown_files(docs_folder)

    print(f"\nFound {len(documents)} documents")

    # Generate SQL file
    sql_path = project_root / "supabase" / "seed_kb.sql"
    create_seed_sql(documents, sql_path)

    # Try to seed database
    print("\n" + "=" * 50)
    seed_database(documents)

    print("\nDone!")


if __name__ == "__main__":
    main()
