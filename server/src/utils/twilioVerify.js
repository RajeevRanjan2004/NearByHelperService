import env from "../config/env.js";

const twilioVerifyBaseUrl = "https://verify.twilio.com/v2";

function isTwilioVerifyConfigured() {
  return Boolean(
    env.twilioVerifyServiceSid &&
      ((env.twilioApiKeySid && env.twilioApiKeySecret) ||
        (env.twilioAccountSid && env.twilioAuthToken))
  );
}

function getAuthCandidates() {
  const candidates = [];

  if (env.twilioApiKeySid && env.twilioApiKeySecret) {
    candidates.push({
      label: "api_key",
      username: env.twilioApiKeySid,
      password: env.twilioApiKeySecret,
    });
  }

  if (env.twilioAccountSid && env.twilioAuthToken) {
    candidates.push({
      label: "account_token",
      username: env.twilioAccountSid,
      password: env.twilioAuthToken,
    });
  }

  return candidates;
}

function createBasicAuthHeader({ username, password }) {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function isEmailIdentifier(identifier) {
  return /\S+@\S+\.\S+/.test(String(identifier || "").trim());
}

function normalizePhoneIdentifier(identifier) {
  const trimmed = String(identifier || "").trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return trimmed.replace(/[^\d+]/g, "");
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  const countryCodeDigits = env.otpDefaultCountryCode.replace(/\D/g, "");

  if (digitsOnly.length === 10 && countryCodeDigits) {
    return `+${countryCodeDigits}${digitsOnly}`;
  }

  if (digitsOnly.length > 10 && !trimmed.startsWith("+")) {
    return `+${digitsOnly}`;
  }

  return trimmed;
}

function normalizeVerificationTarget(identifier) {
  const trimmed = String(identifier || "").trim();

  if (!trimmed) {
    return {
      channel: "sms",
      to: "",
    };
  }

  if (isEmailIdentifier(trimmed)) {
    return {
      channel: "email",
      to: trimmed.toLowerCase(),
    };
  }

  return {
    channel: "sms",
    to: normalizePhoneIdentifier(trimmed),
  };
}

async function twilioVerifyRequest(path, body) {
  if (!isTwilioVerifyConfigured()) {
    throw new Error("Twilio Verify is not configured on the server");
  }

  const candidates = getAuthCandidates();
  let lastPayload = null;
  let lastStatus = 0;

  for (const candidate of candidates) {
    const response = await fetch(`${twilioVerifyBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(candidate),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    });

    const payload = await response.json().catch(() => null);

    if (response.ok) {
      return payload;
    }

    lastPayload = payload;
    lastStatus = response.status;

    if (response.status !== 401) {
      break;
    }
  }

  throw new Error(
    lastPayload?.message ||
      lastPayload?.detail ||
      (lastStatus === 401
        ? "Twilio Verify authentication failed"
        : "Twilio Verify request failed")
  );
}

async function startTwilioVerification(identifier) {
  const target = normalizeVerificationTarget(identifier);

  if (!target.to) {
    throw new Error("A valid email or phone number is required for OTP delivery");
  }

  const verification = await twilioVerifyRequest(
    `/Services/${env.twilioVerifyServiceSid}/Verifications`,
    {
      To: target.to,
      Channel: target.channel,
    }
  );

  return {
    provider: "twilio",
    channel: target.channel,
    to: target.to,
    status: verification.status,
    sid: verification.sid,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
  };
}

async function checkTwilioVerification(identifier, code) {
  const target = normalizeVerificationTarget(identifier);

  if (!target.to) {
    return false;
  }

  const verificationCheck = await twilioVerifyRequest(
    `/Services/${env.twilioVerifyServiceSid}/VerificationCheck`,
    {
      To: target.to,
      Code: String(code || "").trim(),
    }
  );

  return verificationCheck.status === "approved" || verificationCheck.valid === true;
}

export {
  checkTwilioVerification,
  isTwilioVerifyConfigured,
  normalizeVerificationTarget,
  startTwilioVerification,
};
