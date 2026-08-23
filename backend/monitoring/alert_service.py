import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path, override=True)
else:
    load_dotenv(override=True)

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ALERT_SENDER_EMAIL = os.getenv("ALERT_SENDER_EMAIL", SMTP_USERNAME)
ALERT_RECIPIENT_EMAIL = os.getenv("ALERT_RECIPIENT_EMAIL", ALERT_SENDER_EMAIL)

def send_alert_email(subject: str, body_text: str):
    """
    Sends an alert email via standard Python SMTP (smtplib).
    If SMTP credentials are not configured in .env, prints the alert trace locally.
    """
    print(f"\n[ALERT NOTIFICATION TRACE] {subject}")
    print(f"Details:\n{body_text}\n")

    if not SMTP_SERVER or not SMTP_USERNAME or not SMTP_PASSWORD:
        print("SMTP credentials (SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD) not set in .env.")
        print("Skipping SMTP email dispatch (Local alert trace logged successfully above).")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = ALERT_SENDER_EMAIL
        msg['To'] = ALERT_RECIPIENT_EMAIL
        msg['Subject'] = subject
        msg.attach(MIMEText(body_text, 'plain', 'utf-8'))

        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=10)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10)
            server.starttls()

        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()

        print(f"Alert email sent successfully via SMTP to {ALERT_RECIPIENT_EMAIL}!")
        return True
    except Exception as e:
        print(f"Failed to send email alert via SMTP: {e}")
        return False

if __name__ == "__main__":
    send_alert_email(
        subject="[Test Alert] KrishiLoop AgriTech Suite",
        body_text="This is a test notification verifying standard Python SMTP email dispatch."
    )
