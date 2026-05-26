const avatarUrlPattern = /^(https?:\/\/.+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)$/;

function normalizeAvatarUrl(value) {
  const avatarUrl = String(value || "").trim();

  if (!avatarUrl) {
    return "";
  }

  if (avatarUrl.length > 500000) {
    return null;
  }

  return avatarUrlPattern.test(avatarUrl) ? avatarUrl : null;
}

export { normalizeAvatarUrl };
