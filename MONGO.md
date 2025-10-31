# MongoDB Server Setup Guide

This guide covers setting up MongoDB with TLS encryption on a remote cloud server using Docker and Let's Encrypt certificates.

## Prerequisites

- Cloud server (Ubuntu/Debian recommended)
- Domain name pointing to your server:
  - Staging: `staging.latext.ai`
  - Production: `latext.ai`
- Root or sudo access
- Docker and Docker Compose installed

## Setup Steps

### 1. Initial Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker if not already installed
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y
```

### 2. Configure DNS

Point your domain to the server's IP address:

**Staging:**
```
A Record: staging.latext.ai → YOUR_STAGING_SERVER_IP
```

**Production:**
```
A Record: latext.ai → YOUR_PRODUCTION_SERVER_IP
```

Wait for DNS propagation (check with `dig staging.latext.ai` or `dig latext.ai`)

### 3. Install Certbot and Get TLS Certificate

```bash
# Install Certbot
sudo apt install certbot -y

# Get certificate (ensure port 80 is open and no web server is running)
# For staging server:
sudo certbot certonly --standalone -d staging.latext.ai

# For production server:
sudo certbot certonly --standalone -d latext.ai

# Certbot will create certificates at:
# - /etc/letsencrypt/live/staging.latext.ai/fullchain.pem (staging)
# - /etc/letsencrypt/live/staging.latext.ai/privkey.pem (staging)
# - /etc/letsencrypt/live/latext.ai/fullchain.pem (production)
# - /etc/letsencrypt/live/latext.ai/privkey.pem (production)
```

### 4. Combine Certificates for MongoDB

MongoDB requires a combined certificate file (cert + private key):

**For staging:**
```bash
# Combine fullchain and private key
sudo cat /etc/letsencrypt/live/staging.latext.ai/fullchain.pem \
         /etc/letsencrypt/live/staging.latext.ai/privkey.pem \
         > /etc/letsencrypt/live/staging.latext.ai/mongodb.pem

# Set proper permissions
sudo chmod 644 /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
```

**For production:**
```bash
# Combine fullchain and private key
sudo cat /etc/letsencrypt/live/latext.ai/fullchain.pem \
         /etc/letsencrypt/live/latext.ai/privkey.pem \
         > /etc/letsencrypt/live/latext.ai/mongodb.pem

# Set proper permissions
sudo chmod 644 /etc/letsencrypt/live/latext.ai/mongodb.pem
```

### 5. Set Up Auto-Renewal

Certbot automatically renews certificates, but we need to regenerate the combined file:

```bash
# Create renewal hook script
sudo nano /etc/letsencrypt/renewal-hooks/deploy/mongodb-cert-update.sh
```

Add this content **(adjust domain based on environment)**:

**For staging server:**
```bash
#!/bin/bash
cat /etc/letsencrypt/live/staging.latext.ai/fullchain.pem \
    /etc/letsencrypt/live/staging.latext.ai/privkey.pem \
    > /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
chmod 644 /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
docker restart latext-mongodb
```

**For production server:**
```bash
#!/bin/bash
cat /etc/letsencrypt/live/latext.ai/fullchain.pem \
    /etc/letsencrypt/live/latext.ai/privkey.pem \
    > /etc/letsencrypt/live/latext.ai/mongodb.pem
chmod 644 /etc/letsencrypt/live/latext.ai/mongodb.pem
docker restart latext-mongodb
```

Make it executable:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/mongodb-cert-update.sh
```

Test renewal (dry run):

```bash
sudo certbot renew --dry-run
```

### 6. Deploy MongoDB Container

The MongoDB passwords and configurations are already hardcoded in the docker-compose files.

**For staging:**
```bash
# Clone or pull latest code
git clone <your-repo-url> /opt/latext-site
cd /opt/latext-site

# Deploy staging MongoDB
docker compose -f docker-compose.staging.yml up -d

# Check logs
docker logs latext-mongodb
```

**For production:**
```bash
# Clone or pull latest code
git clone <your-repo-url> /opt/latext-site
cd /opt/latext-site

# Deploy production MongoDB
docker compose up -d

# Check logs
docker logs latext-mongodb
```

### 7. Verify TLS is Enabled

**For staging:**
```bash
docker exec latext-mongodb mongosh --tls \
  --host staging.latext.ai \
  --tlsAllowInvalidCertificates \
  -u admin -p 6364c3b75dfa0a523296bea188de76e696e04d72a023f9d175aad8d407eb9cee \
  --authenticationDatabase admin
```

**For production:**
```bash
docker exec latext-mongodb mongosh --tls \
  --host latext.ai \
  --tlsAllowInvalidCertificates \
  -u admin -p b13aa0e5f6147ca8cb3055c59a15e336591dfb4ad932944b3f397498ee3b9085 \
  --authenticationDatabase admin
```

### 8. Configure Firewall

Allow only necessary ports:

```bash
# Allow SSH (important - don't lock yourself out!)
sudo ufw allow 22

# Allow MongoDB from specific IPs only (recommended)
sudo ufw allow from YOUR_BACKEND_SERVER_IP to any port 27017
sudo ufw allow from YOUR_LATEXTAI_SERVER_IP to any port 27017

# Or allow MongoDB from anywhere (less secure)
sudo ufw allow 27017

# Enable firewall
sudo ufw enable
```

### 9. Test Connection from Client

From your backend or latextai server:

```bash
# Install MongoDB client tools
sudo apt install mongodb-mongosh -y

# Test staging connection
mongosh "mongodb://admin:6364c3b75dfa0a523296bea188de76e696e04d72a023f9d175aad8d407eb9cee@staging.latext.ai:27017/latext_db?tls=true&authSource=admin"

# Test production connection
mongosh "mongodb://admin:b13aa0e5f6147ca8cb3055c59a15e336591dfb4ad932944b3f397498ee3b9085@latext.ai:27017/latext_db?tls=true&authSource=admin"
```

## Security Checklist

- [x] Strong password (64 character hex - already set in docker-compose files)
- [x] TLS encryption enabled (`tls=true` in connection string)
- [ ] Firewall configured (only allow trusted IPs)
- [ ] Auto-renewal configured for certificates
- [x] MongoDB authentication enabled (default in our setup)
- [ ] Regular backups configured
- [ ] Monitor logs for unauthorized access attempts

## Troubleshooting

### Certificate Issues

```bash
# Check certificate validity
sudo certbot certificates

# Manually renew if needed
sudo certbot renew --force-renewal

# Regenerate combined MongoDB certificate (staging)
sudo cat /etc/letsencrypt/live/staging.latext.ai/fullchain.pem \
         /etc/letsencrypt/live/staging.latext.ai/privkey.pem \
         > /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
sudo chmod 644 /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
docker restart latext-mongodb

# Regenerate combined MongoDB certificate (production)
sudo cat /etc/letsencrypt/live/latext.ai/fullchain.pem \
         /etc/letsencrypt/live/latext.ai/privkey.pem \
         > /etc/letsencrypt/live/latext.ai/mongodb.pem
sudo chmod 644 /etc/letsencrypt/live/latext.ai/mongodb.pem
docker restart latext-mongodb
```

### Connection Issues

```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs latext-mongodb --tail 100

# Check if port 27017 is open
sudo netstat -tlnp | grep 27017

# Test DNS resolution
dig staging.latext.ai  # for staging
dig latext.ai          # for production

# Test connection without TLS (from MongoDB server itself)
# Staging:
docker exec latext-mongodb mongosh -u admin -p 6364c3b75dfa0a523296bea188de76e696e04d72a023f9d175aad8d407eb9cee --authenticationDatabase admin

# Production:
docker exec latext-mongodb mongosh -u admin -p b13aa0e5f6147ca8cb3055c59a15e336591dfb4ad932944b3f397498ee3b9085 --authenticationDatabase admin
```

### Permission Issues

```bash
# Fix certificate permissions (staging)
sudo chmod 644 /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
sudo chown root:root /etc/letsencrypt/live/staging.latext.ai/mongodb.pem

# Fix certificate permissions (production)
sudo chmod 644 /etc/letsencrypt/live/latext.ai/mongodb.pem
sudo chown root:root /etc/letsencrypt/live/latext.ai/mongodb.pem

# Restart container
docker restart latext-mongodb
```

## Backup and Restore

### Backup

```bash
# Create backup directory
mkdir -p /opt/mongodb-backups

# Backup all databases
docker exec latext-mongodb mongodump \
  -u admin -p YOUR_PASSWORD --authenticationDatabase admin \
  --out /data/backups/$(date +%Y%m%d)

# Copy backup from container to host
docker cp latext-mongodb:/data/backups /opt/mongodb-backups/
```

### Restore

```bash
# Restore from backup
docker exec latext-mongodb mongorestore \
  -u admin -p YOUR_PASSWORD --authenticationDatabase admin \
  /data/backups/20250131
```

## Monitoring

### Check MongoDB Status

```bash
# Container status
docker ps -a | grep mongodb

# Resource usage
docker stats latext-mongodb

# Database size
docker exec latext-mongodb mongosh -u admin -p YOUR_PASSWORD --authenticationDatabase admin \
  --eval "db.stats()"
```

### Logs

```bash
# Real-time logs
docker logs latext-mongodb -f

# Last 100 lines
docker logs latext-mongodb --tail 100

# Logs from specific time
docker logs latext-mongodb --since 2h
```

## References

- [MongoDB TLS/SSL Configuration](https://www.mongodb.com/docs/manual/tutorial/configure-ssl/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
