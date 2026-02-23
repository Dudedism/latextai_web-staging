# Phase 1: Stripe production keys (BLOCKING)

1. Complete Stripe verification

Boss needs to complete Stripe's business verification process. This requires business details (legal name, address, tax ID), bank account for payouts, and identity verification. Takes 1-2 business days once submitted.

2. Get live Stripe keys

After verification, switch to live mode in Stripe dashboard (exit sandbox). Copy:
- Secret key (`sk_live_...`)
- Publishable key (`pk_live_...`) if needed
- Create a live webhook endpoint for `https://latext.ai/api/stripe/webhook`
- Copy webhook signing secret (`whsec_...`)

3. Update production environment

Update `/opt/latext-site/backend/.env.production` with live keys:
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Then redeploy: `cd /opt/latext-site/backend && ./deploy.sh production`

4. Test with real card

After deploying with live keys, test with a real card (not 4242...). Test card should be rejected in live mode.

# Phase 2: Google Ads conversion tracking (CHECK AFTER 24 HOURS)

Context: Tested conversion tracking on 2026-01-09. Signup conversion fired successfully (saw network request). Status shows "Inactive" but can take up to 24 hours to process.

1. Check if conversions appeared

If still showing "Inactive" with 0 conversions after 24 hours, proceed with debugging below.

2. Use Google Tag Assistant

Install Google Tag Assistant Chrome extension. Visit latext.ai and trigger a conversion. Check for errors in tag firing.

3. Verify conversion IDs match

In Google Ads, click "Troubleshoot" on each conversion action. Verify IDs match code:
- Sign-up: `AW-17841022197/AzBICImqtN8bEPXJobtC`
- Credit Top Up: `AW-17841022197/pKmDCLvgsd8bEPXJobtC`

4. Check conversion action settings

Click each conversion action in Google Ads. Verify "Website" is conversion source. Check counting method and conversion window.

5. Test with fresh Chrome profile

No extensions, no cached data. Complete full signup flow. Check Network tab for successful (not blocked) requests to googleadservices.com.

6. Verify gtag snippet in production

View page source on latext.ai. Confirm gtag script loads with correct ID (`AW-17841022197`).

# Phase 3: SEO optimization (RANK FOR TARGET KEYWORDS)

Target keywords:
- "convert word document to latex"
- "convert word to latex"
- "word to latex"

Competitors:
- docx2latex.com (SEO: 100, Performance: 84)
- vertopal.com (SEO: 100, Performance: 99, Accessibility: 89)

## Quick wins (implement first)

1. Update title tag

Change `<title>Latext AI</title>` to `<title>Convert Word to LaTeX | Latext AI</title>` in index.html.

2. Update meta description

Already added basic description. Consider updating to include more keywords:
`"Convert Word documents to LaTeX instantly. Upload your .docx file and get professionally formatted, publication-ready LaTeX PDFs in minutes."`

3. Add structured data (Schema.org)

Add JSON-LD to index.html:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Latext AI",
  "description": "Convert Word documents to LaTeX",
  "url": "https://latext.ai",
  "applicationCategory": "Document Converter",
  "operatingSystem": "Web"
}
</script>
```

4. Ensure H1 on homepage matches keywords

Main heading should be "Convert Word Documents to LaTeX" or similar.

## Content improvements (medium effort)

5. Add landing page content

Homepage needs 300-500 words explaining the service with keywords naturally included. Competitors have explanatory text that Google can index.

6. Add FAQ section

Create FAQ with questions users search for:
- "How do I convert a Word document to LaTeX?"
- "Is Word to LaTeX conversion free?"
- "What formatting is preserved when converting DOCX to LaTeX?"

FAQ sections can appear as featured snippets in Google.

7. Create dedicated landing pages

Create keyword-targeted URLs:
- `/convert-word-to-latex`
- `/docx-to-latex`

## Technical improvements (ongoing)

8. Improve performance score

Currently at 82, vertopal is at 99. Focus on:
- Reduce unused CSS/JS (tree-shaking)
- Optimize images
- Add preconnect hints for external resources
- Improve First Contentful Paint

9. Add main landmark

Wrap main content in `<main>` tag for accessibility. Currently missing.

## Off-page SEO (longer term)

10. Submit to directories

- AlternativeTo.net
- Product Hunt
- Software directories

11. Build backlinks

- Get listed on "best Word to LaTeX converter" articles
- Academic forums (researchers need this tool)
- LaTeX community sites (tex.stackexchange.com profile, etc.)

12. Google Search Console

- Submit sitemap (already have one)
- Monitor which queries you appear for
- Track impressions and click-through rates
- Identify new keyword opportunities

# Notes

- Firefox and privacy browsers block Google tracking by default. Test with Chrome.
- Production was running Stripe TEST keys (`rk_test_...`) - test cards worked when they shouldn't have.
- Production containers: `latext-backend` (port 8000), `latextai-service` (port 8001)
- Lighthouse reports saved: `latext.ai-20260109T145622.json`, `www.docx2latex.com-20260109T150148.json`
