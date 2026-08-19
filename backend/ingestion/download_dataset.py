import os
import sys

# Add ingestion directory to sys.path if needed
sys.path.insert(0, os.path.dirname(__file__))

from fetch_real_datasets import verify_all_datasets

def main():
    print("Executing AgriTech Dataset Ingestion Manager...")
    verify_all_datasets()

if __name__ == "__main__":
    main()
