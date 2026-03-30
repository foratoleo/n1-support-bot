#!/usr/bin/env python3
"""
Seed knowledge base from kb_data markdown files.

Reads all .md files from kb_data/ directory, extracts frontmatter
and content, and inserts them into rag.kb_documents table.
"""

import asyncio
import os
import re
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database.connection import DatabasePool
from src.database.repositories import KBDocumentRepository
from src.utils.logger import setup_logger

logger = setup_logger(__name__)

# Area mapping based on folder/file patterns
AREA_MAPPING = {
    'overview': 'foundation',
    'terms': 'foundation',
    'schema': 'foundation',
    'structure': 'foundation',
    'auth-flows': 'foundation',
    'context-system': 'foundation',
    'state-patterns': 'foundation',
    'edge-functions': 'document-generation',
    'templates': 'document-generation',
    'tracking': 'document-generation',
    'endpoints': 'document-generation',
    'functions': 'document-generation',
    'views': 'document-generation',
    'gen-docs': 'document-generation',
    'components': 'frontend',
    'routes': 'frontend',
    'themes': 'frontend',
    'members': 'frontend',
    'flows': 'frontend',
    'permissions': 'frontend',
    'roles': 'frontend',
    'projects': 'planning',
    'tasks': 'planning',
    'sprints': 'planning',
    'transcripts': 'planning',
    'validation': 'support',
    'guides': 'support',
    'bot': 'support',
}


def extract_frontmatter(content: str) -> tuple[dict, str]:
    """Extract YAML frontmatter from markdown content."""
    match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
    if match:
        frontmatter_text = match.group(1)
        body = match.group(2)
        # Simple frontmatter parsing
        fm = {}
        for line in frontmatter_text.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                fm[key.strip()] = value.strip()
        return fm, body
    return {}, content


def extract_title(content: str) -> str:
    """Extract title from markdown content (first # heading)."""
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1)
    return "Untitled"


async def read_kb_files(kb_dir: Path, repo: KBDocumentRepository) -> list[dict]:
    """Read all markdown files and extract metadata."""
    documents = []

    for md_file in kb_dir.glob('*.md'):
        if md_file.name == 'INDEX.md':
            continue

        try:
            content = md_file.read_text(encoding='utf-8')
            fm, body = extract_frontmatter(content)

            # Determine area from filename
            stem = md_file.stem
            area = AREA_MAPPING.get(stem, 'foundation')

            # Skip if already exists
            existing = await repo.get_by_file_path(str(md_file))
            if existing:
                logger.info(f"Skipping {md_file.name} - already exists")
                continue

            title = fm.get('name', extract_title(body)).replace('-', ' ').title()

            documents.append({
                'area': fm.get('area', area),
                'title': title,
                'content': body.strip(),
                'file_path': str(md_file),
            })

            logger.info(f"Prepared: {md_file.name} -> area={area}")

        except Exception as e:
            logger.error(f"Error reading {md_file}: {e}")

    return documents


async def seed_kb() -> None:
    """Main seed function."""
    kb_dir = Path(__file__).parent.parent / 'kb_data'

    if not kb_dir.exists():
        logger.error(f"kb_data directory not found at {kb_dir}")
        return

    logger.info(f"Reading KB files from {kb_dir}")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL environment variable is not set")
        return

    pool = DatabasePool(database_url)
    await pool.initialize()

    async with pool.acquire() as session:
        repo = KBDocumentRepository(session)

        docs = await read_kb_files(kb_dir, repo)
        logger.info(f"Found {len(docs)} documents to insert")

        for doc in docs:
            try:
                await repo.create(
                    area=doc['area'],
                    title=doc['title'],
                    content=doc['content'],
                    file_path=doc['file_path']
                )
                logger.info(f"Inserted: {doc['title']}")
            except Exception as e:
                logger.error(f"Error inserting {doc['title']}: {e}")

    await pool.close()
    logger.info("Seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_kb())
