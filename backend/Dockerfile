FROM python:3.12-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run with Gunicorn (production-ready WSGI server)
CMD ["gunicorn", "--workers", "4", "--timeout", "120", "--bind", "0.0.0.0:8000", "app:app"]
