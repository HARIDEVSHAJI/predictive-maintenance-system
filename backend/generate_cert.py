"""
Generate self-signed SSL certificate for HTTPS.
Required for phone accelerometer access (Chrome blocks DeviceMotion on HTTP).
Run once: python generate_cert.py
Then start server with: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
"""
try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import datetime, ipaddress, socket

    # Generate key
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Get local IPs for SAN
    hostname = socket.gethostname()
    local_ips = []
    try:
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip not in local_ips and not ip.startswith('127.'):
                local_ips.append(ip)
    except:
        pass

    san_entries = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    ]
    for ip in local_ips:
        try:
            san_entries.append(x509.IPAddress(ipaddress.IPv4Address(ip)))
        except:
            pass

    # Build certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "Predictive Maintenance IoT"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "PDM Project"),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .sign(key, hashes.SHA256())
    )

    # Write files
    with open("key.pem", "wb") as f:
        f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    with open("cert.pem", "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print("[OK] SSL certificate generated!")
    print(f"   cert.pem + key.pem created in current directory")
    print(f"   Local IPs added to certificate: {local_ips}")
    print(f"")
    print(f"   Start server with:")
    print(f"   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem")
    print(f"")
    print(f"   Phone URL: https://YOUR_IP:8000/iot")
    print(f"   Phone will show security warning -> tap Advanced -> Proceed -> sensor will work!")

except ImportError:
    print("[ERROR] 'cryptography' package not found.")
    print("   Install it:  pip install cryptography")
    print("   Then re-run:  python generate_cert.py")
