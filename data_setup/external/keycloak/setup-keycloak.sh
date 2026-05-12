#!/bin/bash
# Đợi Keycloak khởi động xong (Sử dụng kcadm.sh để kiểm tra thay vì curl)
echo "Waiting for Keycloak to start..."
KC_BIN="/opt/keycloak/bin/kcadm.sh"
KC_SERVER="http://localhost:8080"

for i in {1..30}; do
  if $KC_BIN config credentials --server $KC_SERVER --realm master --user $KEYCLOAK_ADMIN --password $KEYCLOAK_ADMIN_PASSWORD > /dev/null 2>&1; then
    echo "Keycloak is up and authenticated!"
    break
  fi
  echo "Still waiting for Admin API... ($i/30)"
  sleep 5
done

# 1. Đăng nhập vào realm master
echo "Step 1: Logging into master realm at $KC_SERVER..."
$KC_BIN config credentials --server $KC_SERVER --realm master --user $KEYCLOAK_ADMIN --password $KEYCLOAK_ADMIN_PASSWORD
sleep 5
echo "=> Step 1: DONE"

# 2. Fix lỗi SSL cho realm master
echo "Step 2: Disabling SSL for master realm..."
$KC_BIN update realms/master -s sslRequired=NONE
echo "=> Step 2: DONE"

# 3. Tạo realm "vms"
if ! $KC_BIN get realms/vms > /dev/null 2>&1; then
  echo "Step 3: Creating realm 'vms'..."
  $KC_BIN create realms -s realm=vms -s enabled=true
  $KC_BIN update realms/vms -s sslRequired=NONE
  echo "=> Step 3: DONE"
else
  echo "Step 3: Realm 'vms' already exists. Skip."
fi

# 4. Tạo user admin cho realm vms
echo "Step 4: Configuring admin user for vms realm..."
VMS_ADMIN_ID=$($KC_BIN get users -r vms -q username=admin --fields id --format csv --noquotes)
if [ -z "$VMS_ADMIN_ID" ]; then
  VMS_ADMIN_ID=$($KC_BIN create users -r vms -s username=admin -s enabled=true -i)
  $KC_BIN set-password -r vms --username admin --new-password Elcom@123
  
  # Gán quyền realm-admin
  CLIENT_UUID=$($KC_BIN get clients -r vms -q clientId=realm-management --fields id --format csv --noquotes)
  ROLE_ID=$($KC_BIN get clients/$CLIENT_UUID/roles/realm-admin -r vms --fields id --format csv --noquotes)
  $KC_BIN add-roles -r vms --uid $VMS_ADMIN_ID --roleid $ROLE_ID --rolename realm-admin
  echo "=> Step 4: Admin user created and roles assigned. DONE"
else
  echo "Step 4: Admin user already exists. Skip."
fi

# 5. Tạo Client vms-backend (Confidential)
echo "Step 5: Configuring vms-backend client..."
BACKEND_UUID=$($KC_BIN get clients -r vms -q clientId=vms-backend --fields id --format csv --noquotes)
if [ -z "$BACKEND_UUID" ]; then
  BACKEND_UUID=$($KC_BIN create clients -r vms -s clientId=vms-backend -s enabled=true -s serviceAccountsEnabled=true -s publicClient=false -s "redirectUris=[\"/*\"]" -s "webOrigins=[\"/*\"]" -i)
fi

# Lấy Client Secret
SECRET=$($KC_BIN get clients/$BACKEND_UUID/client-secret -r vms --fields value --format csv --noquotes)
echo "[SECRET] KeycloakClientSecret: $SECRET"

# Ghi secret ra file để deploy tool đọc được
echo "$SECRET" > /tmp/kc-secret.txt
echo "Secret saved to /tmp/kc-secret.txt"

echo "=> Step 5: DONE"

# 6. Tạo Client vms-frontend (Public)
echo "Step 6: Configuring vms-frontend client with theme..."
FRONTEND_UUID=$($KC_BIN get clients -r vms -q clientId=vms-frontend --fields id --format csv --noquotes)
if [ -z "$FRONTEND_UUID" ]; then
  FRONTEND_UUID=$($KC_BIN create clients -r vms -s clientId=vms-frontend -s enabled=true -s publicClient=true -s "rootUrl=http://*" -s "redirectUris=[\"*\"]" -s "webOrigins=[\"*\"]" -i)
fi

# Cấu hình Theme vms-new (dùng attributes trong Keycloak 22+)
$KC_BIN update clients/$FRONTEND_UUID -r vms -s "attributes.login_theme=vms-new" 2>/dev/null || \
  echo "Note: loginTheme attribute skipped (not supported in this Keycloak version)"
echo "=> Step 6: DONE"

echo "Keycloak auto-configuration FINISHED successfully!"
