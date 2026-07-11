import pandas as pd
import pandera as pa
from pandera import Column, Check, DataFrameSchema

# Define the Pandera Schema for Raw Retail Events
raw_event_schema = DataFrameSchema(
    columns={
        "invoice_no": Column(str, coerce=True, nullable=False),
        "stock_code": Column(str, coerce=True, nullable=False),
        "description": Column(str, coerce=True, nullable=True),
        "quantity": Column(int, coerce=True, nullable=False),
        "invoice_date": Column("datetime64[ns]", coerce=True, nullable=False),
        "unit_price": Column(float, checks=Check.greater_than_or_equal_to(0.0), coerce=True, nullable=True),
        "customer_id": Column(str, coerce=True, nullable=True),
        "country": Column(str, coerce=True, nullable=True),
    },
    checks=[
        # Dataframe level check: If quantity is negative, the invoice number must start with 'C'
        pa.Check(
            lambda df: df[df["quantity"] < 0]["invoice_no"].str.startswith("C").all(),
            name="cancellation_invoice_check",
            error="Negative quantities (returns/cancellations) must have an invoice number starting with 'C'."
        )
    ]
)

def validate_events_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Validates a pandas DataFrame containing retail events against the raw_event_schema.
    
    Args:
        df: The DataFrame to validate.
        
    Returns:
        The validated and coerced DataFrame.
        
    Raises:
        pandera.errors.SchemaError: If any validation checks fail.
    """
    print(f"Validating dataset slice with Pandera... Rows: {len(df)}")
    
    # 1. Clean date field: convert to datetime so Pandera can validate as pd.Timestamp
    if not pd.api.types.is_datetime64_any_dtype(df["invoice_date"]):
        df["invoice_date"] = pd.to_datetime(df["invoice_date"])
        
    # 2. Convert Customer ID to string (handling float conversion issues for NaN/Null)
    if "customer_id" in df.columns:
        # Convert e.g., 12345.0 float representations to "12345" string
        df["customer_id"] = df["customer_id"].apply(
            lambda val: str(int(float(val))) if pd.notna(val) and str(val).replace('.', '', 1).isdigit() else (str(val) if pd.notna(val) else None)
        )
        
    # 3. Validate
    try:
        validated_df = raw_event_schema.validate(df)
        print("Data validation passed successfully!")
        return validated_df
    except pa.errors.SchemaErrors as err:
        print("Data validation failed with the following errors:")
        print(err)
        raise err
    except Exception as e:
        print(f"Unexpected error during validation: {e}")
        raise e

# Direct test code
if __name__ == "__main__":
    print("Testing Pandera Validation on dummy data...")
    
    # Create valid dummy data
    valid_data = pd.DataFrame({
        "invoice_no": ["536365", "C536370"],
        "stock_code": ["85123A", "22423"],
        "description": ["WHITE HANGING HEART T-LIGHT HOLDER", "REGENCY CAKESTAND 3 TIER"],
        "quantity": [6, -1],
        "invoice_date": ["2009-12-01 07:45:00", "2009-12-01 07:50:00"],
        "unit_price": [2.55, 12.75],
        "customer_id": ["17850", "12583"],
        "country": ["United Kingdom", "France"]
    })
    
    # Validate valid data
    validate_events_df(valid_data)
    
    # Create invalid dummy data (negative price)
    invalid_data = pd.DataFrame({
        "invoice_no": ["536365"],
        "stock_code": ["85123A"],
        "description": ["WHITE HANGING HEART T-LIGHT HOLDER"],
        "quantity": [6],
        "invoice_date": ["2009-12-01 07:45:00"],
        "unit_price": [-2.55], # Invalid negative price
        "customer_id": ["17850"],
        "country": ["United Kingdom"]
    })
    
    try:
        validate_events_df(invalid_data)
    except Exception as e:
        print(f"Validation caught invalid data as expected: {e}")
