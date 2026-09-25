/*
 * Brialyns Art Sign - ESP32 + RC522 RFID station
 * ===============================================
 *
 * Reads a tag and POSTs the tap to the Brialyns webhook (Apps Script),
 * which writes the `rfid_events` doc + marks the station online. The app
 * (Production > Sensor tab) beeps, shows the Last scan card and the
 * activity feed; the web header shows the live-activity toast.
 *
 * WIRING (RC522 -> ESP32 DevKit V1, 30-pin)
 * -----------------------------------------
 *   RC522 SDA/SS  -> D5   (GPIO 5)
 *   RC522 SCK     -> D18  (GPIO 18)
 *   RC522 MOSI    -> D23  (GPIO 23)
 *   RC522 MISO    -> D19  (GPIO 19)
 *   RC522 RST     -> D27  (GPIO 27)
 *   RC522 3.3V    -> 3V3
 *   RC522 GND     -> GND
 *   RC522 IRQ     -> not connected
 *
 * RC522 is 3.3V ONLY. 5V/VIN will kill it.
 *
 * ARDUINO IDE (one-time)
 * ----------------------
 *   1. Library Manager -> install "MFRC522" (by GithubCommunity).
 *   2. Boards: "ESP32 Dev Module" (esp32 core 3.x already installed).
 *   3. Fill in WIFI_SSID / WIFI_PASSWORD below, then Upload.
 *      If stuck at "Connecting......" hold the BOOT button while uploading.
 *   4. Serial Monitor @ 115200. On boot you should see the RC522 version
 *      (0x91/0x92), the WiFi IP, and a {"ok":true,...} ping reply.
 *
 * NOTE: the ESP32 only sees 2.4 GHz WiFi (not 5 GHz).
 *
 * BINDING A TAG
 * -------------
 * Tap a tag -> the UID prints here (e.g. 04A3B2C1) -> Firebase console ->
 * Firestore -> inventory -> {variant} -> add field  tag_uid = "04A3B2C1".
 * Tap again -> serial shows "recorded <uid> -> <variant>".
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ---------------- TODO: fill these two in ----------------
const char *WIFI_SSID = "bile ka";
const char *WIFI_PASSWORD = "09865789123aZ";

// Already provisioned for this project - no need to change.
const char *WEBHOOK_URL =
    "https://script.google.com/macros/s/"
    "AKfycbwHoTUX9sPSS6cK0Z3URJdzyJveDCOSMSBOaDEx9NvHXuz4vMSTKsZvSEPzPbdkenM/exec";
const char *WEBHOOK_SECRET = "QlMCpL7iBOIHgtu5wCp84nY9muJvMTr";
const char *SENSOR_ID = "ESP32-01";

// ---------------- RC522 pins (ESP32 VSPI) ----------------
#define RFID_SS_PIN 5
#define RFID_RST_PIN 27
#define STATUS_LED_PIN 2  // most dev boards have the onboard LED here

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

const unsigned long DEDUPE_MS = 5000;  // same tag inside 5s = ignored
String lastUid = "";
unsigned long lastUidAt = 0;

// Heartbeat cadence: keeps `last_seen_at` fresh while the station is
// powered, so the apps can tell "live" (<=90s) from "unplugged".
const unsigned long HEARTBEAT_MS = 30000;
unsigned long lastHeartbeatAt = 0;

// Last HTTP status seen by postJson (302 from Apps Script = script ran).
int lastHttpStatus = 0;

// True when the POST reached Apps Script (2xx/3xx). The script has then
// already recorded the tap - even if the JSON reply can't be fetched,
// which happens on flaky links (the reply URL is one-time and expires).
bool lastRequestDelivered = false;

// ---------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("[boot] Brialyns RFID station");

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  SPI.begin();  // SCK=18, MISO=19, MOSI=23
  rfid.PCD_Init();
  delay(50);
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("[rfid] RC522 version register: 0x%02X\n", version);
  if (version == 0x00 || version == 0xFF) {
    Serial.println(
        "[rfid] WARNING: RC522 not detected. Check wiring (3.3V!), "
        "SDA=D5 SCK=D18 MOSI=D23 MISO=D19 RST=D27.");
  }

  connectWifi();
  pingSensor();
  lastHeartbeatAt = millis();
}

void loop() {
  ensureWifi();

  // Heartbeat: while powered, ping every HEARTBEAT_MS so the dashboard
  // chip stays "live"; unplugging flips it to idle -> offline by itself.
  const unsigned long nowMs = millis();
  if (WiFi.status() == WL_CONNECTED &&
      (nowMs - lastHeartbeatAt) >= HEARTBEAT_MS) {
    lastHeartbeatAt = nowMs;
    pingSensor();
  }

  // Any card present?
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String uid = uidToString(rfid.uid.uidByte, rfid.uid.size);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  unsigned long now = millis();
  if (uid == lastUid && (now - lastUidAt) < DEDUPE_MS) {
    Serial.println("[rfid] duplicate tap ignored: " + uid);
    return;
  }
  lastUid = uid;
  lastUidAt = now;

  Serial.println("[rfid] tap: " + uid);
  blink();
  postTap(uid);
}

String uidToString(byte *buffer, byte size) {
  String out = "";
  for (byte i = 0; i < size; i++) {
    if (buffer[i] < 0x10) out += "0";
    out += String(buffer[i], HEX);
  }
  out.toUpperCase();
  return out;
}

void blink() {
  digitalWrite(STATUS_LED_PIN, HIGH);
  delay(60);
  digitalWrite(STATUS_LED_PIN, LOW);
}

// ---------------- WiFi ----------------

void connectWifi() {
  Serial.printf("[wifi] connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[wifi] connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[wifi] not connected yet - retrying in the background.");
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  static unsigned long lastTry = 0;
  if (millis() - lastTry < 10000) return;
  lastTry = millis();
  Serial.println("[wifi] reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ---------------- HTTP ----------------

/**
 * POSTs the JSON payload to the Apps Script webhook. Apps Script answers
 * with a 302 to script.googleusercontent.com; that redirect is followed
 * manually with a GET (the same trick the mobile app needed), because
 * re-POSTing the redirect would lose the JSON reply.
 */
String postJson(const String &payload) {
  lastHttpStatus = 0;
  lastRequestDelivered = false;

  WiFiClientSecure client;
  client.setInsecure();  // demo: both hosts are Google HTTPS

  HTTPClient http;
  if (!http.begin(client, WEBHOOK_URL)) return "";
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");
  const char *headerKeys[] = {"Location"};
  http.collectHeaders(headerKeys, 1);
  int code = http.POST(payload);
  String body = http.getString();
  String location = http.header("Location");
  location.trim();  // Google sometimes pads the header - begin() rejects it
  http.end();
  if (code > 0) lastHttpStatus = code;
  if (code >= 200 && code < 400) lastRequestDelivered = true;

  // Follow up to 4 redirect hops - Apps Script can chain more than one on
  // a busy link, and the hop URL is one-time-use (expired = 404 page).
  for (int hop = 0; hop < 4; hop++) {
    if (!(code == 301 || code == 302 || code == 303 || code == 307 ||
          code == 308)) {
      break;  // final response
    }
    if (location.isEmpty()) break;
    WiFiClientSecure clientN;
    clientN.setInsecure();
    HTTPClient httpN;
    if (!httpN.begin(clientN, location)) break;
    httpN.setTimeout(15000);
    const char *hk[] = {"Location"};
    httpN.collectHeaders(hk, 1);
    code = httpN.GET();
    body = httpN.getString();
    location = httpN.header("Location");
    location.trim();
    httpN.end();
    if (code > 0) lastHttpStatus = code;
    Serial.printf("[http] hop %d -> %d\n", hop + 1, code);
  }

  if (code > 0 && code < 400 && body.indexOf("<html") < 0 &&
      body.indexOf("<!DOCTYPE") < 0) {
    return body;
  }
  return "";
}

void postTap(const String &uid) {
  String payload = "{\"secret\":\"" + String(WEBHOOK_SECRET) +
                   "\",\"action\":\"record_rfid\",\"tag_uid\":\"" + uid +
                   "\",\"sensor_id\":\"" + String(SENSOR_ID) + "\"}";

  String reply = postJson(payload);
  if (reply.isEmpty()) {
    if (lastRequestDelivered) {
      Serial.println(
          "[http] tap received by the server (reply unreadable this time - "
          "it is one-time-use; check the app Sensor feed).");
    } else {
      Serial.println("[http] no reply (offline?)");
    }
    return;
  }
  Serial.println("[http] reply: " + reply);

  bool ok = reply.indexOf("\"ok\":true") >= 0;
  String variant = jsonStringValue(reply, "material_variant_id");
  if (ok && variant.length() > 0) {
    Serial.printf("[rfid] recorded %s -> %s\n", uid.c_str(), variant.c_str());
  } else if (ok) {
    Serial.println(
        "[rfid] recorded, but no inventory item is bound to this tag yet.");
  } else {
    Serial.println("[rfid] server rejected the tap - check the secret.");
  }
}

void pingSensor() {
  String payload = "{\"secret\":\"" + String(WEBHOOK_SECRET) +
                   "\",\"action\":\"sensor_ping\",\"sensor_id\":\"" +
                   String(SENSOR_ID) + "\"}";
  Serial.println("[http] ping: " + postJson(payload));
}

/** Minimal extractor for {"key":"value"} in a compact JSON reply. */
String jsonStringValue(const String &json, const String &key) {
  String needle = "\"" + key + "\":\"";
  int i = json.indexOf(needle);
  if (i < 0) return "";
  int start = i + needle.length();
  int end = json.indexOf("\"", start);
  if (end < 0) return "";
  return json.substring(start, end);
}
