import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
AWS_SES_SENDER_EMAIL = os.getenv("AWS_SES_SENDER_EMAIL")
AWS_SES_RECIPIENT_EMAIL = os.getenv("AWS_SES_RECIPIENT_EMAIL", AWS_SES_SENDER_EMAIL)

def send_alert_email(subject: str, body_text: str):
    """
    Sends an alert email via AWS SES. 
    If AWS credentials or sender email are not set, it prints the alert mock locally.
    """
    print(f"\n[ALERT NOTIFICATION TRACE] {subject}")
    print(f"Details:\n{body_text}\n")

    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY or not AWS_SES_SENDER_EMAIL:
        print("AWS SES credentials or sender email not fully configured in .env.")
        print("Skipping AWS SES email dispatch (Mock alert logged successfully above).")
        return False

    # Create SES client
    try:
        ses_client = boto3.client(
            'ses',
            region_name=AWS_DEFAULT_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        
        # Send Email
        response = ses_client.send_email(
            Destination={
                'ToAddresses': [AWS_SES_RECIPIENT_EMAIL],
            },
            Message={
                'Body': {
                    'Text': {
                        'Charset': 'UTF-8',
                        'Data': body_text,
                    },
                },
                'Subject': {
                    'Charset': 'UTF-8',
                    'Data': subject,
                },
            },
            Source=AWS_SES_SENDER_EMAIL,
        )
        print(f"Alert email sent successfully! Message ID: {response['MessageId']}")
        return True
        
    except ClientError as e:
        print(f"Failed to send email alert via AWS SES: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"Unexpected error while sending alert email: {e}")
        return False

if __name__ == "__main__":
    # Test Alert
    send_alert_email(
        subject="[Test Alert] Retail Ops Intelligence",
        body_text="This is a test notification to verify the alert service setup."
    )
