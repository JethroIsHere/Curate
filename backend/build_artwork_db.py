import sqlite3
import pandas as pd
import os

DB_PATH = 'artworks.db'
CSV_PATH = 'artwork_data.csv'

# Map your exact CSV names to the image filenames your frontend expects
IMAGE_MAP = {
    "The Swing": "The_Swing.jpg",
    "The Declaration of Love": "The_Declaration_of_Love.jpg",
    "The Meeting": "The_Meeting.jpg",
    "Mona Lisa": "Mona_Lisa.jpg",
    "The Creation of Adam": "The_Creation_of_Adam.jpg",
    "Lady with an Ermine": "The_Lady_with_an_Ermine.jpg",
    "The Burning Giraffe": "The_Burning_Giraffe.jpg",
    "The Persistence of Memory": "Persistence_of_Memory.jpg",
    "The Great War": "The_Great_War.jpg",
    "The Gleaners": "The_Gleaners.jpg",
    "The Stone Breakers": "The_Stone_Breakers.jpg",
    "Woman Cleaning Turnips": "Woman_Cleaning_Turnips.jpg",
    "The Raft of Medusa": "The_Raft_of_the_Medusa.jpg", 
    "Liberty Leading the People": "Liberty_Leading_the_People.jpg"
}

def build():
    # 1. Nuke the old DB
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("🗑️ Deleted old corrupted database.")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 2. Create the unified schema that app.py expects
    c.execute('''
        CREATE TABLE artworks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            artist TEXT,
            year TEXT,
            medium TEXT,
            movement TEXT,
            overview TEXT,
            context TEXT,
            docent_cta TEXT,
            website_links TEXT,
            image_filename TEXT
        )
    ''')

    # 3. Read your actual CSV
    df = pd.read_csv(CSV_PATH)
    inserted = 0

    for index, row in df.iterrows():
        title = str(row.get('Name', '')).strip()
        img_file = IMAGE_MAP.get(title, "unknown.jpg")
        
        c.execute('''
            INSERT INTO artworks (title, artist, year, medium, movement, overview, context, docent_cta, website_links, image_filename)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            title,
            str(row.get('Artist', '')),
            str(row.get('Date', '')),
            str(row.get('Medium', '')),
            str(row.get('Movement', '')),
            str(row.get('Overview', '')),
            str(row.get('Context', '')),
            str(row.get('Docent_CTA', '')),
            str(row.get('Website Name and Links', '')),
            img_file
        ))
        inserted += 1

    conn.commit()
    conn.close()
    print(f"✅ SUCCESS: Master DB built with {inserted} artworks!")

if __name__ == "__main__":
    build()