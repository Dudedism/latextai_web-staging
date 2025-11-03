"""
Email service for sending transactional emails via Brevo API.
"""
import os
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from config import BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME


def send_verification_email(recipient_email, recipient_name, verification_url):
    """
    Send email verification email using Brevo.

    Args:
        recipient_email: User's email address
        recipient_name: User's name for personalization
        verification_url: Full verification URL with token

    Returns:
        True if email sent successfully, False otherwise

    Raises:
        ApiException: If Brevo API call fails
    """
    print(f"\n📧 [EMAIL] Attempting to send verification email...")
    print(f"   Recipient: {recipient_email}")
    print(f"   Name: {recipient_name}")
    print(f"   Verification URL: {verification_url}")

    # Configure API key authorization
    print(f"   Configuring Brevo API...")
    print(f"   API Key present: {bool(BREVO_API_KEY)}")
    print(f"   API Key prefix: {BREVO_API_KEY[:20] if BREVO_API_KEY else 'None'}...")
    print(f"   Sender email: {BREVO_SENDER_EMAIL}")
    print(f"   Sender name: {BREVO_SENDER_NAME}")

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = BREVO_API_KEY

    # Create API instance
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    # Load HTML template
    template_path = os.path.join(os.path.dirname(__file__), 'verification_email.html')
    print(f"   Loading HTML template from: {template_path}")
    print(f"   Template exists: {os.path.exists(template_path)}")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        print(f"   Template loaded successfully ({len(html_content)} characters)")
    except Exception as e:
        print(f"❌ [EMAIL] Failed to load template: {e}")
        raise

    # Replace placeholders
    html_content = html_content.replace('{{USER_NAME}}', recipient_name)
    html_content = html_content.replace('{{VERIFICATION_URL}}', verification_url)
    print(f"   Placeholders replaced successfully")

    # Create email object
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        subject="Verify your Latext.ai account",
        html_content=html_content
    )
    print(f"   Email object created successfully")

    try:
        print(f"   Calling Brevo API to send email...")
        # Send the email
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"✅ [EMAIL] Verification email sent successfully!")
        print(f"   Message ID: {api_response.message_id}")
        print(f"   API Response: {api_response}")
        return True
    except ApiException as e:
        print(f"❌ [EMAIL] Brevo API call failed!")
        print(f"   Status code: {e.status}")
        print(f"   Reason: {e.reason}")
        print(f"   Body: {e.body}")
        print(f"   Headers: {e.headers}")
        print(f"   Full error: {e}")
        return False
    except Exception as e:
        print(f"❌ [EMAIL] Unexpected error sending email!")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        return False


def send_password_reset_email(recipient_email, recipient_name, reset_url):
    """
    Send password reset email using Brevo.

    Args:
        recipient_email: User's email address
        recipient_name: User's name for personalization
        reset_url: Full password reset URL with token

    Returns:
        True if email sent successfully, False otherwise

    Raises:
        ApiException: If Brevo API call fails
    """
    print(f"\n📧 [EMAIL] Attempting to send password reset email...")
    print(f"   Recipient: {recipient_email}")
    print(f"   Name: {recipient_name}")
    print(f"   Reset URL: {reset_url}")

    # Configure API key authorization
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = BREVO_API_KEY

    # Create API instance
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    # Load HTML template
    template_path = os.path.join(os.path.dirname(__file__), 'password_reset_email.html')
    print(f"   Loading HTML template from: {template_path}")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        print(f"   Template loaded successfully ({len(html_content)} characters)")
    except Exception as e:
        print(f"❌ [EMAIL] Failed to load template: {e}")
        raise

    # Replace placeholders
    html_content = html_content.replace('{{USER_NAME}}', recipient_name)
    html_content = html_content.replace('{{RESET_URL}}', reset_url)
    print(f"   Placeholders replaced successfully")

    # Create email object
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        subject="Reset your Latext.ai password",
        html_content=html_content
    )
    print(f"   Email object created successfully")

    try:
        print(f"   Calling Brevo API to send email...")
        # Send the email
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"✅ [EMAIL] Password reset email sent successfully!")
        print(f"   Message ID: {api_response.message_id}")
        return True
    except ApiException as e:
        print(f"❌ [EMAIL] Brevo API call failed!")
        print(f"   Status code: {e.status}")
        print(f"   Reason: {e.reason}")
        return False
    except Exception as e:
        print(f"❌ [EMAIL] Unexpected error sending email!")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error message: {str(e)}")
        return False
