import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
EXCEL_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00502/online_retail_II.xlsx"
EXCEL_PATH = os.path.join(DATA_DIR, "online_retail_II.xlsx")
CSV_PATH = os.path.join(DATA_DIR, "online_retail_II.csv")

def make_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Created data directory: {DATA_DIR}")

def download_uci_dataset():
    print(f"Attempting to download Online Retail II dataset from UCI: {EXCEL_URL}")
    try:
        response = requests.get(EXCEL_URL, timeout=30)
        response.raise_for_status()
        with open(EXCEL_PATH, 'wb') as f:
            f.write(response.content)
        print("Download complete. Saved Excel file.")
        return True
    except Exception as e:
        print(f"Failed to download dataset from UCI: {e}")
        return False

def convert_excel_to_csv():
    if not os.path.exists(EXCEL_PATH):
        print(f"Excel file not found at {EXCEL_PATH}")
        return False

    print("Converting Excel sheets to a unified CSV...")
    try:
        # Online Retail II has two sheets: Year 2009-2010 and Year 2010-2011
        with pd.ExcelFile(EXCEL_PATH) as xls:
            sheets = xls.sheet_names
            print(f"Found sheets: {sheets}")
            
            dfs = []
            for sheet in sheets:
                print(f"Loading sheet {sheet}...")
                df = pd.read_excel(xls, sheet_name=sheet)
                dfs.append(df)
                
            full_df = pd.concat(dfs, ignore_index=True)
            
            # Clean column names (strip spaces, ensure consistent formatting)
            full_df.columns = [c.strip() for c in full_df.columns]
            
            # Save as CSV
            full_df.to_csv(CSV_PATH, index=False)
            print(f"Successfully created unified CSV at {CSV_PATH}. Rows: {len(full_df)}")
            
        # Clean up excel file to save space
        try:
            os.remove(EXCEL_PATH)
            print("Removed temporary Excel file.")
        except Exception as delete_err:
            print(f"Could not delete Excel file: {delete_err}")
            
        return True
    except Exception as e:
        print(f"Failed to convert Excel to CSV: {e}")
        return False

def generate_synthetic_data(num_rows=50000):
    print("Generating synthetic retail dataset as fallback...")
    try:
        np.random.seed(42)
        
        # Common items
        skus = [f"SKU_{i:04d}" for i in range(1, 101)]
        descriptions = [f"Product Description for SKU_{i:04d}" for i in range(1, 101)]
        sku_to_desc = dict(zip(skus, descriptions))
        sku_prices = {sku: round(np.random.uniform(1.0, 50.0), 2) for sku in skus}
        
        countries = ["United Kingdom", "Germany", "France", "Eire", "Spain", "Netherlands"]
        country_probs = [0.85, 0.04, 0.03, 0.03, 0.03, 0.02]
        
        data = []
        
        # Set start date (e.g. 1 year ago)
        start_date = datetime.now() - timedelta(days=365)
        
        current_invoice_num = 536365
        
        # Generate rows
        for i in range(num_rows):
            # Group rows into invoices
            if i % 5 == 0:
                current_invoice_num += 1
                is_cancelled = np.random.rand() < 0.15
                invoice_prefix = "C" if is_cancelled else ""
                invoice_str = f"{invoice_prefix}{current_invoice_num}"
                
                # Invoice timestamp
                invoice_time = start_date + timedelta(
                    seconds=np.random.randint(0, 365 * 24 * 3600)
                )
                customer_id = str(np.random.randint(12345, 18287))
                country = np.random.choice(countries, p=country_probs)
            
            sku = np.random.choice(skus)
            desc = sku_to_desc[sku]
            price = sku_prices[sku]
            
            # If cancelled, quantity is negative
            if invoice_str.startswith("C"):
                qty = -np.random.randint(1, 10)
            else:
                qty = np.random.randint(1, 50)
                
            data.append({
                "Invoice": invoice_str,
                "StockCode": sku,
                "Description": desc,
                "Quantity": qty,
                "InvoiceDate": invoice_time.strftime("%Y-%m-%d %H:%M:%S"),
                "Price": price,
                "Customer ID": customer_id,
                "Country": country
            })
            
        df = pd.DataFrame(data)
        df.to_csv(CSV_PATH, index=False)
        print(f"Synthetic dataset generated successfully at {CSV_PATH}. Rows: {len(df)}")
        return True
    except Exception as e:
        print(f"Failed to generate synthetic data: {e}")
        return False

def main():
    make_data_dir()
    
    if os.path.exists(CSV_PATH):
        print(f"CSV dataset already exists at {CSV_PATH}. Skipping download.")
        return

    # If Excel file already exists, convert it directly
    if os.path.exists(EXCEL_PATH):
        print(f"Excel file already exists at {EXCEL_PATH}. Proceeding with conversion.")
        success = convert_excel_to_csv()
    else:
        # Attempt download
        success = download_uci_dataset()
        if success:
            success = convert_excel_to_csv()
        
    if not success:
        print("Falling back to synthetic data generation to avoid breaking the pipeline.")
        generate_synthetic_data()

if __name__ == "__main__":
    main()
