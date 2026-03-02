"""
Email service for sending transactional emails via Brevo API.
"""
import html
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
    print(f"\n📧 [EMAIL] Sending verification email...")

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = BREVO_API_KEY

    # Create API instance
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    # Load HTML template
    template_path = os.path.join(os.path.dirname(__file__), 'verification_email.html')

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except Exception as e:
        print(f"❌ [EMAIL] Failed to load template: {e}")
        raise

    # Replace placeholders (escape user-provided values to prevent XSS)
    html_content = html_content.replace('{{USER_NAME}}', html.escape(recipient_name))
    html_content = html_content.replace('{{VERIFICATION_URL}}', verification_url)

    # Create email object
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        subject="Verify your Latext.ai account",
        html_content=html_content
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"✅ [EMAIL] Verification email sent")
        return True
    except ApiException as e:
        print(f"❌ [EMAIL] Brevo API error: {e.status} {e.reason}")
        return False
    except Exception as e:
        print(f"❌ [EMAIL] Error sending email: {e}")
        return False


def send_welcome_email(recipient_email, recipient_name, upload_url, free_credits=750):
    """
    Send welcome email with free credits info after signup.

    Args:
        recipient_email: User's email address
        recipient_name: User's name for personalization
        upload_url: URL to start uploading (e.g. https://latext.ai/papers/new)
        free_credits: Number of free credits the user has (default 750)

    Returns:
        True if email sent successfully, False otherwise
    """
    print(f"\n📧 [EMAIL] Sending welcome email...")

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = BREVO_API_KEY

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    template_path = os.path.join(os.path.dirname(__file__), 'welcome_email.html')

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except Exception as e:
        print(f"❌ [EMAIL] Failed to load template: {e}")
        raise

    html_content = html_content.replace('{{USER_NAME}}', html.escape(recipient_name))
    html_content = html_content.replace('{{UPLOAD_URL}}', upload_url)
    html_content = html_content.replace('{{FREE_CREDITS}}', str(free_credits))
    html_content = html_content.replace('{{FREE_CREDITS_DOLLARS}}', f'${free_credits / 100:.2f}')

    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        subject="Welcome to Latext.ai — your first conversion is free",
        html_content=html_content
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"✅ [EMAIL] Welcome email sent")
        return True
    except ApiException as e:
        print(f"❌ [EMAIL] Brevo API error: {e.status} {e.reason}")
        return False
    except Exception as e:
        print(f"❌ [EMAIL] Error sending email: {e}")
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
    print(f"\n📧 [EMAIL] Sending password reset email...")

    # Configure API key authorization
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = BREVO_API_KEY

    # Create API instance
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    # Load HTML template
    template_path = os.path.join(os.path.dirname(__file__), 'password_reset_email.html')

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except Exception as e:
        print(f"❌ [EMAIL] Failed to load template: {e}")
        raise

    # Replace placeholders (escape user-provided values to prevent XSS)
    html_content = html_content.replace('{{USER_NAME}}', html.escape(recipient_name))
    html_content = html_content.replace('{{RESET_URL}}', reset_url)

    # Create email object
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": recipient_email, "name": recipient_name}],
        sender={"email": BREVO_SENDER_EMAIL, "name": BREVO_SENDER_NAME},
        subject="Reset your Latext.ai password",
        html_content=html_content
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"✅ [EMAIL] Password reset email sent")
        return True
    except ApiException as e:
        print(f"❌ [EMAIL] Brevo API error: {e.status} {e.reason}")
        return False
    except Exception as e:
        print(f"❌ [EMAIL] Error sending email: {e}")
        return False
